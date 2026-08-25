import { useEffect, useState } from "preact/hooks";

import {
  LITERATURE_PROVIDER_ENDPOINTS,
  normalizeLiteratureStream,
  type LiteraturePageSize,
  type LiteratureProvider,
  type LiteratureSort,
  type NormalizedFeedItem,
} from "../features/feeds";
import { IndexedDbNotebookRepository } from "../features/notebook";
import {
  listFeedSubscriptions,
  listLatestFeedItems,
  type FeedSubscription,
} from "../platform/feedStore";
import { localeTag, useI18n } from "../platform/i18n";
import { listLiteratureStreams, type LiteratureStream } from "../platform/literatureStore";
import type { ExtensionCommand, ExtensionResponse } from "../platform/messages";
import {
  requestSourcePermission,
  requestSourcePermissions,
  revokeSourcePermission,
} from "../platform/permissionBroker";

const DEFAULT_FEED = "https://rss.arxiv.org/rss/cond-mat.mtrl-sci";
const FEED_PRESETS = [
  { label: "arXiv · Materials Science", url: "https://rss.arxiv.org/rss/cond-mat.mtrl-sci" },
  { label: "arXiv · Applied Physics", url: "https://rss.arxiv.org/rss/physics.app-ph" },
  { label: "arXiv · Instrumentation", url: "https://rss.arxiv.org/rss/physics.ins-det" },
] as const;

interface FeedPanelProps {
  onSelectionChange?: (items: NormalizedFeedItem[]) => void;
}

async function sendCommand(command: ExtensionCommand): Promise<ExtensionResponse> {
  return chrome.runtime.sendMessage(command) as Promise<ExtensionResponse>;
}

function sourceTitleFromUrl(url: URL): string {
  return url.hostname.replace(/^www\./, "");
}

function formatDate(value: string | undefined, tag: string, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return fallback;
  return new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function parseBlockedTerms(value: string): string[] {
  return value.split(/[,;\n]/).map((term) => term.trim()).filter(Boolean);
}

function itemProviderLabel(item: NormalizedFeedItem): string {
  const connectors = new Set(item.provenance.sources.map((source) => source.connectorId));
  const labels = [
    connectors.has("arxiv-api") || item.identifiers.arxiv ? "arXiv" : undefined,
    connectors.has("crossref-api") || item.identifiers.doi ? "Crossref" : undefined,
  ].filter(Boolean);
  return labels.length ? labels.join(" + ") : "RSS";
}

export function FeedPanel({ onSelectionChange }: FeedPanelProps) {
  const { locale, t } = useI18n();
  const [feedUrl, setFeedUrl] = useState(DEFAULT_FEED);
  const [subscriptions, setSubscriptions] = useState<FeedSubscription[]>([]);
  const [streams, setStreams] = useState<LiteratureStream[]>([]);
  const [items, setItems] = useState<NormalizedFeedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [query, setQuery] = useState("");
  const [activeSourceId, setActiveSourceId] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [streamTitle, setStreamTitle] = useState("");
  const [streamQuery, setStreamQuery] = useState("");
  const [streamProviders, setStreamProviders] = useState<Set<LiteratureProvider>>(
    () => new Set(["arxiv", "crossref"]),
  );
  const [streamBlocked, setStreamBlocked] = useState("");
  const [streamSort, setStreamSort] = useState<LiteratureSort>("newest");
  const [streamPageSize, setStreamPageSize] = useState<LiteraturePageSize>(20);

  async function reload() {
    const [nextSubscriptions, nextStreams, nextItems] = await Promise.all([
      listFeedSubscriptions(),
      listLiteratureStreams(),
      listLatestFeedItems(160),
    ]);
    setSubscriptions(nextSubscriptions);
    setStreams(nextStreams);
    setItems(nextItems);
    if (
      activeSourceId !== "all" &&
      !nextSubscriptions.some((source) => source.id === activeSourceId) &&
      !nextStreams.some((stream) => stream.id === activeSourceId)
    ) setActiveSourceId("all");
  }

  useEffect(() => {
    void reload().catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : t("feed.msg.cacheFailed")),
    );
  }, []);

  const visibleItems = items
    .filter((item) => activeSourceId === "all" || item.provenance.sources.some((source) => source.sourceId === activeSourceId))
    .filter((item) => {
      const needle = query.trim().toLocaleLowerCase(localeTag(locale));
      if (!needle) return true;
      return [item.title, item.sourceDescription ?? "", item.identifiers.doi ?? "", item.identifiers.arxiv ?? "", ...item.authors.map((author) => author.name)]
        .join(" ").toLocaleLowerCase(localeTag(locale)).includes(needle);
    })
    .slice(0, 30);

  function toggleProvider(provider: LiteratureProvider) {
    setStreamProviders((current) => {
      const next = new Set(current);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  }

  function toggleAiSelection(item: NormalizedFeedItem) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else if (next.size < 8) next.add(item.id);
      onSelectionChange?.(items.filter((candidate) => next.has(candidate.id)));
      return next;
    });
  }

  async function saveLiteratureStream() {
    setBusy(true);
    setMessage(undefined);
    try {
      const config = normalizeLiteratureStream({
        id: crypto.randomUUID(), title: streamTitle, query: streamQuery,
        providers: [...streamProviders], blockedTerms: parseBlockedTerms(streamBlocked),
        sort: streamSort, pageSize: streamPageSize,
      });
      const decisions = await requestSourcePermissions(
        config.providers.map((provider) => LITERATURE_PROVIDER_ENDPOINTS[provider]),
      );
      if (decisions.some((decision) => !decision.granted)) {
        setMessage(t("feed.msg.permissionDenied"));
        return;
      }
      const response = await sendCommand({ type: "SAVE_LITERATURE_STREAM", stream: config });
      if (!response.ok) throw new Error(response.error);
      await reload();
      setActiveSourceId(config.id);
      setStreamTitle("");
      setStreamQuery("");
      setStreamBlocked("");
      setMessage(t("feed.msg.streamSaved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("feed.msg.streamSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function runLiteratureStream(streamId: string) {
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await sendCommand({ type: "RUN_LITERATURE_STREAM", streamId });
      if (!response.ok) throw new Error(response.error);
      await reload();
      setActiveSourceId(streamId);
      setMessage(t("feed.msg.streamRefreshed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("feed.msg.streamRefreshFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeSavedStream(streamId: string) {
    setBusy(true);
    setMessage(undefined);
    try {
      const removed = streams.find((stream) => stream.id === streamId);
      const response = await sendCommand({ type: "REMOVE_LITERATURE_STREAM", streamId });
      if (!response.ok) throw new Error(response.error);
      const remaining = await listLiteratureStreams();
      for (const provider of removed?.providers ?? []) {
        if (!remaining.some((stream) => stream.providers.includes(provider))) {
          await revokeSourcePermission(LITERATURE_PROVIDER_ENDPOINTS[provider]);
        }
      }
      await reload();
      setMessage(t("feed.msg.streamRemoved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("feed.msg.streamRemoveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addSource() {
    setBusy(true);
    setMessage(undefined);
    try {
      const url = new URL(feedUrl);
      const permission = await requestSourcePermission(url.href);
      if (!permission.granted) {
        setMessage(t("feed.msg.permissionDenied"));
        return;
      }
      const response = await sendCommand({
        type: "ADD_RSS_SOURCE",
        source: { id: crypto.randomUUID(), title: sourceTitleFromUrl(url), url: url.href },
      });
      if (!response.ok) throw new Error(response.error);
      await reload();
      setMessage(t("feed.msg.added"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("feed.msg.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function refreshSource(sourceId: string) {
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await sendCommand({ type: "SCHEDULE_SOURCE_REFRESH", sourceId });
      if (!response.ok) throw new Error(response.error);
      await reload();
      setActiveSourceId(sourceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("feed.msg.refreshFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeSource(sourceId: string) {
    setBusy(true);
    try {
      const removedSource = subscriptions.find((source) => source.id === sourceId);
      const response = await sendCommand({ type: "REMOVE_SOURCE", sourceId });
      if (!response.ok) throw new Error(response.error);
      const remaining = await listFeedSubscriptions();
      if (removedSource && !remaining.some((source) => source.origin === removedSource.origin)) {
        await revokeSourcePermission(removedSource.url);
      }
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("feed.msg.removeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveToNotebook(item: NormalizedFeedItem) {
    if (!item.canonicalUrl) return;
    setBusy(true);
    setMessage(undefined);
    const notebook = new IndexedDbNotebookRepository();
    try {
      await notebook.saveFeedItemToNote({
        item: {
          id: item.id, sourceId: item.sourceId, connectorId: item.connectorId,
          canonicalUrl: item.canonicalUrl, title: item.title,
          authors: item.authors.map((author) => ({ literal: author.name })),
          publishedAt: item.publishedAt, retrievedAt: item.retrievedAt,
          doi: item.identifiers.doi, contentHash: item.contentHash,
          referenceType: item.identifiers.arxiv ? "preprint" : "article",
        },
        newNote: { title: item.title, markdown: `[${t("feed.openSourceMarkdown")}](${item.canonicalUrl})`, tags: ["literature"] },
      });
      window.dispatchEvent(new Event("benchtab:notebook-changed"));
      setMessage(t("feed.msg.saved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("feed.msg.saveFailed"));
    } finally {
      notebook.close();
      setBusy(false);
    }
  }

  return (
    <article class="widget feed-panel">
      <div class="widget__heading">
        <span class="widget__eyebrow">{t("feed.eyebrow")}</span>
        <span class="module-count">{t("feed.sourceCount", { count: subscriptions.length + streams.length })}</span>
      </div>
      <h2>{t("feed.title")}</h2>

      <details class="feed-config" open>
        <summary>{t("feed.streamsHeading")} <span>{streams.length}</span></summary>
        <form class="literature-form" onSubmit={(event) => { event.preventDefault(); void saveLiteratureStream(); }}>
          <label>{t("feed.streamQueryLabel")}
            <input required minlength={2} maxlength={240} value={streamQuery} onInput={(event) => setStreamQuery(event.currentTarget.value)} placeholder={t("feed.streamQueryPlaceholder")} />
          </label>
          <label>{t("feed.streamTitleLabel")}
            <input maxlength={100} value={streamTitle} onInput={(event) => setStreamTitle(event.currentTarget.value)} placeholder={t("feed.streamTitlePlaceholder")} />
          </label>
          <fieldset class="provider-picker">
            <legend>{t("feed.providersLabel")}</legend>
            <label><input type="checkbox" checked={streamProviders.has("arxiv")} onChange={() => toggleProvider("arxiv")} /> arXiv</label>
            <label><input type="checkbox" checked={streamProviders.has("crossref")} onChange={() => toggleProvider("crossref")} /> Crossref</label>
          </fieldset>
          <label>{t("feed.blockedTermsLabel")}
            <input value={streamBlocked} onInput={(event) => setStreamBlocked(event.currentTarget.value)} placeholder={t("feed.blockedTermsPlaceholder")} />
          </label>
          <div class="literature-form__options">
            <label>{t("feed.sortLabel")}<select value={streamSort} onChange={(event) => setStreamSort(event.currentTarget.value as LiteratureSort)}><option value="newest">{t("feed.sortNewest")}</option><option value="relevance">{t("feed.sortRelevance")}</option></select></label>
            <label>{t("feed.pageSizeLabel")}<select value={streamPageSize} onChange={(event) => setStreamPageSize(Number(event.currentTarget.value) as LiteraturePageSize)}>{[10, 20, 30, 50].map((size) => <option value={size} key={size}>{size}</option>)}</select></label>
          </div>
          <button class="button button--small" type="submit" disabled={busy || streamProviders.size === 0}>{t("feed.saveAndSearch")}</button>
          <small>{t("feed.directRequestPrivacy")}</small>
        </form>
        {streams.length > 0 && <ul class="source-list" aria-label={t("feed.streamsAria")}>{streams.map((stream) => <li key={stream.id}>
          <button class="source-list__select" type="button" onClick={() => setActiveSourceId(stream.id)} aria-pressed={activeSourceId === stream.id}>
            <strong>{stream.title}</strong><small class={stream.lastError ? "source-error" : ""}>{stream.providers.join(" + ")} · {stream.lastError ?? (stream.lastSuccessAt ? t("feed.resultCount", { count: stream.lastResultCount ?? 0 }) : t("feed.waitingFirstRefresh"))}</small>
          </button>
          <span class="source-actions"><button type="button" onClick={() => void runLiteratureStream(stream.id)} disabled={busy} aria-label={t("feed.refresh")}>↻</button><button type="button" onClick={() => void removeSavedStream(stream.id)} disabled={busy} aria-label={t("feed.remove")}>×</button></span>
        </li>)}</ul>}
      </details>

      <details class="feed-config">
        <summary>{t("feed.rssHeading")} <span>{subscriptions.length}</span></summary>
        <div class="preset-row" aria-label={t("feed.presetsAria")}>{FEED_PRESETS.map((preset) => <button key={preset.url} type="button" onClick={() => setFeedUrl(preset.url)}>{preset.label}</button>)}</div>
        <form class="source-form" onSubmit={(event) => { event.preventDefault(); void addSource(); }}>
          <label for="feed-url">{t("feed.urlLabel")}</label>
          <div><input id="feed-url" type="url" required pattern="https://.*" value={feedUrl} onInput={(event) => setFeedUrl(event.currentTarget.value)} aria-describedby="feed-permission-help" /><button class="button button--small" type="submit" disabled={busy}>{t("feed.add")}</button></div>
          <small id="feed-permission-help">{t("feed.permissionHelp")}</small>
        </form>
        {subscriptions.length > 0 && <ul class="source-list" aria-label={t("feed.sourcesAria")}>{subscriptions.map((source) => <li key={source.id}>
          <button class="source-list__select" type="button" onClick={() => setActiveSourceId(source.id)} aria-pressed={activeSourceId === source.id}><strong>{source.title}</strong><small class={source.lastError ? "source-error" : ""}>{source.lastError ?? (source.lastSuccessAt ? t("feed.cachedLocally") : t("feed.waitingFirstRefresh"))}</small></button>
          <span class="source-actions"><button type="button" onClick={() => void refreshSource(source.id)} disabled={busy} aria-label={t("feed.refresh")}>↻</button><button type="button" onClick={() => void removeSource(source.id)} disabled={busy} aria-label={t("feed.remove")}>×</button></span>
        </li>)}</ul>}
      </details>

      {message && <p class="inline-status" role="status">{message}</p>}
      {items.length > 0 && <>
        <div class="feed-scope" role="group" aria-label={t("feed.scopeAria")}><button type="button" aria-pressed={activeSourceId === "all"} onClick={() => setActiveSourceId("all")}>{t("feed.allResults")}</button>{streams.map((stream) => <button type="button" key={stream.id} aria-pressed={activeSourceId === stream.id} onClick={() => setActiveSourceId(stream.id)}>{stream.title}</button>)}</div>
        <label class="feed-search"><span>{t("feed.searchLabel")}</span><input type="search" value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder={t("feed.searchPlaceholder")} /></label>
      </>}
      <div class="feed-items" aria-live="polite">
        {visibleItems.length === 0 ? <p class="empty-state">{t("feed.empty")}</p> : visibleItems.map((item) => <article class="feed-item" key={item.id}>
          <p>{itemProviderLabel(item)} <span>·</span>{formatDate(item.publishedAt ?? item.updatedAt, localeTag(locale), t("feed.dateUnavailable"))}</p>
          <h3>{item.title}</h3>
          {item.authors.length > 0 && <small>{item.authors.slice(0, 3).map((author) => author.name).join(", ")}</small>}
          <div class="feed-item__actions">{item.canonicalUrl && <a href={item.canonicalUrl} target="_blank" rel="noreferrer">{t("feed.openSource")}</a>}<button type="button" onClick={() => void saveToNotebook(item)} disabled={busy || !item.canonicalUrl}>{t("feed.saveToNotebook")}</button><label class="ai-select"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleAiSelection(item)} disabled={!selectedIds.has(item.id) && selectedIds.size >= 8} />{t("feed.aiContext")}</label></div>
        </article>)}
      </div>
    </article>
  );
}
