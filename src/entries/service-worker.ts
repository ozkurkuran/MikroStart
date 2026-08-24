import {
  isExtensionCommand,
  type ExtensionResponse,
} from "../platform/messages";
import { parseFeed } from "../features/feeds";
import { fetchPublicSource } from "../platform/fetchBroker";
import {
  getFeedSubscription,
  listFeedSubscriptions,
  putFeedItems,
  removeFeedSubscription,
  upsertFeedSubscription,
  type FeedSubscription,
} from "../platform/feedStore";
import {
  claimNextRefreshJob,
  completeRefreshJob,
  enqueueSourceRefresh,
  retryRefreshJob,
} from "../platform/jobQueue";

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

async function processRefreshQueue(maxJobs = 4): Promise<void> {
  for (let processed = 0; processed < maxJobs; processed += 1) {
    const job = await claimNextRefreshJob();
    if (!job) return;
    const subscription = await getFeedSubscription(job.sourceId);
    if (!subscription || !subscription.enabled) {
      await completeRefreshJob(job.id);
      continue;
    }

    try {
      await refreshSource(subscription);
      await completeRefreshJob(job.id);
    } catch (error) {
      await upsertFeedSubscription({
        ...subscription,
        lastError: error instanceof Error ? error.message : "Feed refresh failed.",
      });
      await retryRefreshJob(job);
    }
  }
}

async function scheduleAllSources(): Promise<void> {
  const subscriptions = await listFeedSubscriptions();
  for (const subscription of subscriptions) {
    if (subscription.enabled) await enqueueSourceRefresh(subscription.id);
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
