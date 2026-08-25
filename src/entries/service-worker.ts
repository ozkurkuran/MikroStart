import {
  isExtensionCommand,
  type ExtensionResponse,
} from "../platform/messages";
import {
  buildLiteratureProviderUrl,
  filterAndRankLiteratureItems,
  normalizeLiteratureStream,
  parseCrossrefWorks,
  parseFeed,
  type LiteratureProvider,
  type NormalizedFeedItem,
} from "../features/feeds";
import { fetchPublicSource } from "../platform/fetchBroker";
import {
  getFeedSubscription,
  listFeedSubscriptions,
  putFeedItems,
  removeFeedItemsBySource,
  removeFeedSubscription,
  replaceFeedItemsForSource,
  upsertFeedSubscription,
  type FeedSubscription,
} from "../platform/feedStore";
import {
  getLiteratureStream,
  isLiteratureStreamStale,
  listLiteratureStreams,
  removeLiteratureStream,
  upsertLiteratureStream,
  type LiteratureStream,
} from "../platform/literatureStore";
import {
  claimNextRefreshJob,
  completeRefreshJob,
  enqueueSourceRefresh,
  retryRefreshJob,
} from "../platform/jobQueue";
import {
  addWatchHistory,
  evaluateWatchCondition,
  extractJsonWatchValue,
  getJsonWatch,
  isWatchDue,
  listJsonWatches,
  monitorValueHash,
  normalizeJsonWatch,
  removeJsonWatch,
  upsertJsonWatch,
  type JsonWatch,
} from "../platform/watchStore";

const REFRESH_ALARM = "benchtab.refresh-sources";
const COUNTDOWN_ALARM_PREFIX = "benchtab.countdown.";
const OFFSCREEN_DOCUMENT_PATH = "pages/offscreen.html";
const IS_DASHBOARD_EDITION =
  !chrome.runtime.getManifest().chrome_url_overrides?.newtab;

async function ensureRefreshAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(REFRESH_ALARM);
  if (!existing) {
    await chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 30 });
  }
}

function countdownAlarmName(countdownId: string): string {
  return `${COUNTDOWN_ALARM_PREFIX}${countdownId}`;
}

let creatingOffscreenDocument: Promise<void> | undefined;

async function hasOffscreenDocument(): Promise<boolean> {
  if (typeof chrome.offscreen.hasDocument === "function") {
    return chrome.offscreen.hasDocument();
  }
  if (typeof chrome.runtime.getContexts === "function") {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    return contexts.length > 0;
  }
  return false;
}

async function ensureOffscreenAudioDocument(): Promise<void> {
  if (await hasOffscreenDocument()) return;
  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play an alarm tone for a countdown explicitly enabled by the user.",
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes("single offscreen")) throw error;
      })
      .finally(() => {
        creatingOffscreenDocument = undefined;
      });
  }
  await creatingOffscreenDocument;
}

let lastAlarmPlaybackAt = 0;

async function playAlarm(): Promise<void> {
  const now = Date.now();
  if (now - lastAlarmPlaybackAt < 1_500) return;
  lastAlarmPlaybackAt = now;
  await ensureOffscreenAudioDocument();
  await chrome.runtime.sendMessage({ target: "offscreen", type: "PLAY_ALARM" });
}

async function clearCountdownAlarms(): Promise<void> {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((alarm) => alarm.name.startsWith(COUNTDOWN_ALARM_PREFIX))
      .map((alarm) => chrome.alarms.clear(alarm.name)),
  );
}

function permissionOrigin(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Only HTTPS feeds are supported.");
  return `${parsed.origin}/*`;
}

async function refreshSource(subscription: FeedSubscription): Promise<void> {
  const hasPermission = await chrome.permissions.contains({
    origins: [permissionOrigin(subscription.url)],
  });
  if (!hasPermission) throw new Error("Source permission is missing.");

  const response = await fetchPublicSource(
    subscription.url,
    {
      allowedOrigins: [subscription.origin],
      acceptedContentTypes: ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml", "text/plain"],
    },
    { etag: subscription.etag, lastModified: subscription.lastModified },
  );

  if ("notModified" in response) {
    await upsertFeedSubscription({
      ...subscription,
      lastSuccessAt: new Date().toISOString(),
      lastError: undefined,
    });
    return;
  }

  const parsed = parseFeed(response.body, {
    sourceId: subscription.id,
    connectorId: subscription.connectorId,
    feedUrl: subscription.url,
    retrievedAt: new Date().toISOString(),
  });
  await putFeedItems(parsed.items);
  await upsertFeedSubscription({
    ...subscription,
    title: parsed.title || subscription.title,
    lastSuccessAt: new Date().toISOString(),
    lastError: undefined,
    etag: response.etag,
    lastModified: response.lastModified,
  });
}

function literatureProviderOrigin(provider: LiteratureProvider): string {
  return provider === "arxiv" ? "https://export.arxiv.org" : "https://api.crossref.org";
}

async function refreshLiteratureStream(stream: LiteratureStream): Promise<void> {
  const retrievedAt = new Date().toISOString();
  const collected: NormalizedFeedItem[] = [];
  const errors: string[] = [];

  // Crossref's public pool permits one concurrent request; keeping every
  // provider sequential also makes service-worker network load predictable.
  for (const provider of stream.providers) {
    const origin = literatureProviderOrigin(provider);
    const hasPermission = await chrome.permissions.contains({ origins: [`${origin}/*`] });
    if (!hasPermission) {
      errors.push(`${provider}: permission is missing`);
      continue;
    }
    const url = buildLiteratureProviderUrl(provider, stream);
    try {
      const response = await fetchPublicSource(url, {
        allowedOrigins: [origin],
        acceptedContentTypes: provider === "arxiv"
          ? ["application/atom+xml", "application/xml", "text/xml", "text/plain"]
          : ["application/json"],
        maxBytes: 2 * 1024 * 1024,
      });
      if ("notModified" in response) continue;
      if (provider === "arxiv") {
        collected.push(...parseFeed(response.body, {
          sourceId: stream.id,
          connectorId: "arxiv-api",
          feedUrl: url,
          retrievedAt,
          maxItems: stream.pageSize,
        }).items);
      } else {
        collected.push(...parseCrossrefWorks(response.body, {
          sourceId: stream.id,
          retrievedAt,
          requestUrl: url,
          maxItems: stream.pageSize,
        }));
      }
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  if (collected.length === 0 && errors.length > 0) throw new Error(errors.join(" · "));
  const items = filterAndRankLiteratureItems(collected, stream);
  await replaceFeedItemsForSource(stream.id, items);
  await upsertLiteratureStream({
    ...stream,
    lastSuccessAt: retrievedAt,
    lastResultCount: items.length,
    lastError: errors.length ? errors.join(" · ") : undefined,
  });
}

async function notifyWatchChange(watch: JsonWatch, current: string): Promise<void> {
  if (!watch.notify || !(await chrome.permissions.contains({ permissions: ["notifications"] }))) return;
  await chrome.notifications.create(`watch:${watch.id}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon-128.svg"),
    title: `BenchTab · ${watch.title}`,
    message: current.slice(0, 240) || "The selected JSON value changed.",
    contextMessage: "Local source monitor",
  });
}

async function refreshJsonWatch(watch: JsonWatch): Promise<void> {
  const url = new URL(watch.url);
  const granted = await chrome.permissions.contains({ origins: [`${url.origin}/*`] });
  if (!granted) throw new Error("Monitor source permission is missing.");
  const response = await fetchPublicSource(watch.url, {
    allowedOrigins: [url.origin],
    acceptedContentTypes: ["application/json", "application/ld+json", "text/json", "text/plain"],
    maxBytes: 1024 * 1024,
  });
  if ("notModified" in response) return;
  let document: unknown;
  try { document = JSON.parse(response.body); } catch { throw new Error("The monitor response is not valid JSON."); }
  const current = extractJsonWatchValue(document, watch.path);
  const currentHash = monitorValueHash(current);
  const hasBaseline = Boolean(watch.lastValueHash);
  const changed = hasBaseline && currentHash !== watch.lastValueHash;
  const triggered = changed && evaluateWatchCondition(watch.condition, watch.conditionValue, current, changed);
  const checkedAt = new Date().toISOString();
  await addWatchHistory({
    id: crypto.randomUUID(), watchId: watch.id, checkedAt, changed, triggered,
    ...(watch.lastValue !== undefined ? { previous: watch.lastValue } : {}), current,
  });
  await upsertJsonWatch({
    ...watch,
    lastCheckedAt: checkedAt,
    ...(changed ? { lastChangedAt: checkedAt } : {}),
    lastValue: current,
    lastValueHash: currentHash,
    lastError: undefined,
  });
  if (triggered) await notifyWatchChange(watch, current).catch(() => undefined);
}

async function processRefreshQueue(maxJobs = 4): Promise<void> {
  for (let processed = 0; processed < maxJobs; processed += 1) {
    const job = await claimNextRefreshJob();
    if (!job) return;
    const subscription = await getFeedSubscription(job.sourceId);
    const literatureStream = subscription ? undefined : await getLiteratureStream(job.sourceId);
    const jsonWatch = subscription || literatureStream ? undefined : await getJsonWatch(job.sourceId);
    if ((!subscription || !subscription.enabled) && (!literatureStream || !literatureStream.enabled) && (!jsonWatch || !jsonWatch.enabled)) {
      await completeRefreshJob(job.id);
      continue;
    }

    try {
      if (subscription) await refreshSource(subscription);
      else if (literatureStream) await refreshLiteratureStream(literatureStream);
      else await refreshJsonWatch(jsonWatch!);
      await completeRefreshJob(job.id);
    } catch (error) {
      const lastError = error instanceof Error ? error.message : "Source refresh failed.";
      if (subscription) await upsertFeedSubscription({ ...subscription, lastError });
      else if (literatureStream) await upsertLiteratureStream({ ...literatureStream, lastError });
      else if (jsonWatch) await upsertJsonWatch({ ...jsonWatch, lastError });
      await retryRefreshJob(job);
    }
  }
}

async function scheduleAllSources(): Promise<void> {
  const subscriptions = await listFeedSubscriptions();
  for (const subscription of subscriptions) {
    if (subscription.enabled) await enqueueSourceRefresh(subscription.id);
  }
  const streams = await listLiteratureStreams();
  for (const stream of streams) {
    if (stream.enabled && isLiteratureStreamStale(stream)) {
      await enqueueSourceRefresh(stream.id);
    }
  }
  const watches = await listJsonWatches();
  for (const watch of watches) {
    if (watch.enabled && isWatchDue(watch)) await enqueueSourceRefresh(watch.id);
  }
  await processRefreshQueue();
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureRefreshAlarm();
  void chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: !IS_DASHBOARD_EDITION,
  });
  void processRefreshQueue();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureRefreshAlarm();
  void processRefreshQueue();
});

chrome.action.onClicked.addListener(() => {
  if (IS_DASHBOARD_EDITION) {
    void chrome.tabs.create({ url: chrome.runtime.getURL("pages/dashboard.html") });
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith("watch:")) return;
  void getJsonWatch(notificationId.slice(6)).then((watch) => {
    if (watch) return chrome.tabs.create({ url: watch.url });
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    void scheduleAllSources();
  } else if (alarm.name.startsWith(COUNTDOWN_ALARM_PREFIX)) {
    void playAlarm();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isExtensionCommand(message)) {
    sendResponse({ ok: false, error: "Invalid command." } satisfies ExtensionResponse);
    return false;
  }

  if (message.type === "PING") {
    sendResponse({ ok: true, data: { version: 1 } } satisfies ExtensionResponse);
    return false;
  }

  if (message.type === "OPEN_DASHBOARD") {
    void chrome.tabs
      .create({ url: chrome.runtime.getURL("pages/dashboard.html") })
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unable to open dashboard.",
        } satisfies ExtensionResponse),
      );
    return true;
  }

  if (message.type === "SCHEDULE_COUNTDOWN_ALARM") {
    const when = Date.parse(message.targetAt);
    void chrome.alarms
      .create(countdownAlarmName(message.countdownId), { when })
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unable to schedule countdown alarm.",
        } satisfies ExtensionResponse),
      );
    return true;
  }

  if (message.type === "CANCEL_COUNTDOWN_ALARM") {
    void chrome.alarms
      .clear(countdownAlarmName(message.countdownId))
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse));
    return true;
  }

  if (message.type === "CANCEL_ALL_COUNTDOWN_ALARMS") {
    void clearCountdownAlarms()
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unable to clear countdown alarms.",
        } satisfies ExtensionResponse),
      );
    return true;
  }

  if (message.type === "PLAY_ALARM_PREVIEW") {
    void playAlarm()
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unable to play alarm.",
        } satisfies ExtensionResponse),
      );
    return true;
  }

  if (message.type === "ADD_RSS_SOURCE") {
    void (async () => {
      const url = new URL(message.source.url);
      if (url.protocol !== "https:") throw new Error("Only HTTPS feeds are supported.");
      const granted = await chrome.permissions.contains({
        origins: [`${url.origin}/*`],
      });
      if (!granted) throw new Error("Source permission was not granted.");
      const existingSources = await listFeedSubscriptions();
      if (existingSources.some((source) => source.url === url.href)) {
        throw new Error("This feed source is already enabled.");
      }

      await upsertFeedSubscription({
        id: message.source.id,
        title: message.source.title,
        url: url.href,
        origin: url.origin,
        connectorId: "rss-atom",
        enabled: true,
        addedAt: new Date().toISOString(),
      });
      await enqueueSourceRefresh(message.source.id);
      await processRefreshQueue(1);
    })()
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unable to add source.",
        } satisfies ExtensionResponse),
      );
    return true;
  }

  if (message.type === "SCHEDULE_SOURCE_REFRESH") {
    void enqueueSourceRefresh(message.sourceId, { force: true })
      .then(() => processRefreshQueue(1))
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unable to refresh source.",
        } satisfies ExtensionResponse),
      );
    return true;
  }

  if (message.type === "SAVE_LITERATURE_STREAM") {
    void (async () => {
      const config = normalizeLiteratureStream(message.stream);
      const existing = await getLiteratureStream(config.id);
      const duplicate = (await listLiteratureStreams()).find(
        (stream) => stream.id !== config.id && stream.query === config.query &&
          stream.providers.join(",") === config.providers.join(","),
      );
      if (duplicate) throw new Error("An equivalent literature stream already exists.");
      for (const provider of config.providers) {
        const origin = literatureProviderOrigin(provider);
        const granted = await chrome.permissions.contains({ origins: [`${origin}/*`] });
        if (!granted) throw new Error(`Permission for ${provider} was not granted.`);
      }
      await upsertLiteratureStream({
        ...config,
        enabled: true,
        addedAt: existing?.addedAt ?? new Date().toISOString(),
      });
      await enqueueSourceRefresh(config.id, { force: true });
      await processRefreshQueue(1);
    })()
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse))
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to save literature stream.",
      } satisfies ExtensionResponse));
    return true;
  }

  if (message.type === "RUN_LITERATURE_STREAM") {
    void enqueueSourceRefresh(message.streamId, { force: true })
      .then(() => processRefreshQueue(1))
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse))
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to run literature stream.",
      } satisfies ExtensionResponse));
    return true;
  }

  if (message.type === "REMOVE_LITERATURE_STREAM") {
    void Promise.all([
      removeLiteratureStream(message.streamId),
      removeFeedItemsBySource(message.streamId),
    ])
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse))
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to remove literature stream.",
      } satisfies ExtensionResponse));
    return true;
  }

  if (message.type === "SAVE_JSON_WATCH") {
    void (async () => {
      const normalized = normalizeJsonWatch({ ...message.watch, enabled: true, addedAt: new Date().toISOString() });
      const url = new URL(normalized.url);
      const granted = await chrome.permissions.contains({ origins: [`${url.origin}/*`] });
      if (!granted) throw new Error("Monitor source permission was not granted.");
      const duplicate = (await listJsonWatches()).find((watch) => watch.id !== normalized.id && watch.url === normalized.url && watch.path === normalized.path);
      if (duplicate) throw new Error("This JSON value is already monitored.");
      await upsertJsonWatch(normalized);
      await enqueueSourceRefresh(normalized.id, { force: true });
      await processRefreshQueue(1);
    })().then(() => sendResponse({ ok: true } satisfies ExtensionResponse)).catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to save monitor." } satisfies ExtensionResponse));
    return true;
  }

  if (message.type === "RUN_JSON_WATCH") {
    void enqueueSourceRefresh(message.watchId, { force: true }).then(() => processRefreshQueue(1)).then(() => sendResponse({ ok: true } satisfies ExtensionResponse)).catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to run monitor." } satisfies ExtensionResponse));
    return true;
  }

  if (message.type === "REMOVE_JSON_WATCH") {
    void removeJsonWatch(message.watchId).then(() => sendResponse({ ok: true } satisfies ExtensionResponse)).catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to remove monitor." } satisfies ExtensionResponse));
    return true;
  }

  if (message.type === "REMOVE_SOURCE") {
    void removeFeedSubscription(message.sourceId)
      .then(() => sendResponse({ ok: true } satisfies ExtensionResponse))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unable to remove source.",
        } satisfies ExtensionResponse),
      );
    return true;
  }

  sendResponse({ ok: false, error: "Unsupported command." } satisfies ExtensionResponse);
  return false;
});
