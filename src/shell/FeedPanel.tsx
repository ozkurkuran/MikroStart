import { useEffect, useState } from "preact/hooks";

import { localeTag, useI18n } from "../platform/i18n";
import type { NormalizedFeedItem } from "../features/feeds";
import { IndexedDbNotebookRepository } from "../features/notebook";
import {
  listFeedSubscriptions,
  listLatestFeedItems,
  type FeedSubscription,
} from "../platform/feedStore";
import type { ExtensionCommand, ExtensionResponse } from "../platform/messages";
import {
  requestSourcePermission,
  revokeSourcePermission,
} from "../platform/permissionBroker";

const DEFAULT_FEED = "https://rss.arxiv.org/rss/cond-mat.mtrl-sci";
const FEED_PRESETS = [
  {
    label: "arXiv · Materials Science",
    url: "https://rss.arxiv.org/rss/cond-mat.mtrl-sci",
  },
  {
    label: "arXiv · Applied Physics",
    url: "https://rss.arxiv.org/rss/physics.app-ph",
  },
  {
    label: "arXiv · Instrumentation",
    url: "https://rss.arxiv.org/rss/physics.ins-det",
  },
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
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function FeedPanel({ onSelectionChange }: FeedPanelProps) {
  const { locale, t } = useI18n();
  const [feedUrl, setFeedUrl] = useState(DEFAULT_FEED);
  const [subscriptions, setSubscriptions] = useState<FeedSubscription[]>([]);
  const [items, setItems] = useState<NormalizedFeedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  async function reload() {
    const [nextSubscriptions, nextItems] = await Promise.all([
      listFeedSubscriptions(),
      listLatestFeedItems(80),
    ]);
    setSubscriptions(nextSubscriptions);
    setItems(nextItems);
  }

  useEffect(() => {
    void reload().catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : t("feed.msg.cacheFailed")),
    );
  }, []);

  const visibleItems = items
    .filter((item) => {
      const needle = query.trim().toLocaleLowerCase(localeTag(locale));
      if (!needle) return true;
      return [
        item.title,
        item.sourceDescription ?? "",
        item.identifiers.doi ?? "",
        item.identifiers.arxiv ?? "",
        ...item.authors.map((author) => author.name),
      ]
        .join(" ")
        .toLocaleLowerCase(localeTag(locale))
        .includes(needle);
    })
    .slice(0, 20);

  function toggleAiSelection(item: NormalizedFeedItem) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else if (next.size < 8) next.add(item.id);
      onSelectionChange?.(items.filter((candidate) => next.has(candidate.id)));
      return next;
    });
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
        source: {
          id: crypto.randomUUID(),
          title: sourceTitleFromUrl(url),
          url: url.href,
        },
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
      if (
        removedSource &&
        !remaining.some((source) => source.origin === removedSource.origin)
      ) {
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
          id: item.id,
          sourceId: item.sourceId,
          connectorId: item.connectorId,
          canonicalUrl: item.canonicalUrl,
          title: item.title,
          authors: item.authors.map((author) => ({ literal: author.name })),
          publishedAt: item.publishedAt,
          retrievedAt: item.retrievedAt,
          doi: item.identifiers.doi,
          contentHash: item.contentHash,
          referenceType: item.identifiers.arxiv ? "preprint" : "article",
        },
        newNote: {
          title: item.title,
          markdown: `[${t("feed.openSourceMarkdown")}](${item.canonicalUrl})`,
          tags: ["literature"],
        },
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
        <span class="module-count">{t("feed.sourceCount", { count: subscriptions.length })}</span>
      </div>
      <h2>{t("feed.title")}</h2>

      <div class="preset-row" aria-label={t("feed.presetsAria")}>
        {FEED_PRESETS.map((preset) => (
          <button key={preset.url} type="button" onClick={() => setFeedUrl(preset.url)}>
            {preset.label}
          </button>
        ))}
      </div>

      <form
        class="source-form"
        onSubmit={(event) => {
          event.preventDefault();
          void addSource();
        }}
      >
        <label for="feed-url">{t("feed.urlLabel")}</label>
        <div>
          <input
            id="feed-url"
            type="url"
            required
            pattern="https://.*"
            value={feedUrl}
            onInput={(event) => setFeedUrl(event.currentTarget.value)}
            aria-describedby="feed-permission-help"
          />
          <button class="button button--small" type="submit" disabled={busy}>{t("feed.add")}</button>
        </div>
        <small id="feed-permission-help">{t("feed.permissionHelp")}</small>
      </form>

      {subscriptions.length > 0 && (
        <ul class="source-list" aria-label={t("feed.sourcesAria")}>
          {subscriptions.map((source) => (
            <li key={source.id}>
              <span>
                <strong>{source.title}</strong>
                <small class={source.lastError ? "source-error" : ""}>
                  {source.lastError ?? (source.lastSuccessAt ? t("feed.cachedLocally") : t("feed.waitingFirstRefresh"))}
                </small>
              </span>
              <span class="source-actions">
                <button type="button" onClick={() => void refreshSource(source.id)} disabled={busy} aria-label={t("feed.refresh")}>↻</button>
                <button type="button" onClick={() => void removeSource(source.id)} disabled={busy} aria-label={t("feed.remove")}>×</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {message && <p class="inline-status" role="status">{message}</p>}

      {items.length > 0 && (
        <label class="feed-search">
          <span>{t("feed.searchLabel")}</span>
          <input
            type="search"
            value={query}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder={t("feed.searchPlaceholder")}
          />
        </label>
      )}

      <div class="feed-items" aria-live="polite">
        {items.length === 0 ? (
          <p class="empty-state">{t("feed.empty")}</p>
        ) : (
          visibleItems.map((item) => (
            <article class="feed-item" key={item.id}>
              <p>
                {item.identifiers.arxiv ? "arXiv" : item.identifiers.doi ? "DOI" : "FEED"}
                <span>·</span>{formatDate(item.publishedAt ?? item.updatedAt, localeTag(locale), t("feed.dateUnavailable"))}
              </p>
              <h3>{item.title}</h3>
              {item.authors.length > 0 && <small>{item.authors.slice(0, 3).map((author) => author.name).join(", ")}</small>}
              <div class="feed-item__actions">
                {item.canonicalUrl && <a href={item.canonicalUrl} target="_blank" rel="noreferrer">{t("feed.openSource")}</a>}
                <button type="button" onClick={() => void saveToNotebook(item)} disabled={busy || !item.canonicalUrl}>{t("feed.saveToNotebook")}</button>
                <label class="ai-select">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleAiSelection(item)}
                    disabled={!selectedIds.has(item.id) && selectedIds.size >= 8}
                  />
                  {t("feed.aiContext")}
                </label>
              </div>
            </article>
          ))
        )}
      </div>
    </article>
  );
}
