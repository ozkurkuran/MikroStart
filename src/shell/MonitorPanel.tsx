import { useEffect, useMemo, useState } from "preact/hooks";

import { useI18n } from "../platform/i18n";
import type { ExtensionCommand, ExtensionResponse } from "../platform/messages";
import { requestMonitorPermissions } from "../platform/permissionBroker";
import {
  listJsonWatches,
  listWatchHistory,
  normalizeJsonWatch,
  type JsonWatch,
  type JsonWatchConfig,
  type WatchCondition,
  type WatchHistoryEntry,
  type WatchInterval,
} from "../platform/watchStore";

async function sendCommand(command: ExtensionCommand): Promise<ExtensionResponse> {
  return chrome.runtime.sendMessage(command) as Promise<ExtensionResponse>;
}

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export function MonitorPanel() {
  const { locale, t } = useI18n();
  const [watches, setWatches] = useState<JsonWatch[]>([]);
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [path, setPath] = useState("$");
  const [intervalMinutes, setIntervalMinutes] = useState<WatchInterval>(60);
  const [condition, setCondition] = useState<WatchCondition>("changed");
  const [conditionValue, setConditionValue] = useState("");
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();

  async function reload() {
    const [nextWatches, nextHistory] = await Promise.all([listJsonWatches(), listWatchHistory()]);
    setWatches(nextWatches);
    setHistory(nextHistory);
    setSelectedId((current) => current && nextWatches.some((watch) => watch.id === current) ? current : nextWatches[0]?.id);
  }

  useEffect(() => { void reload(); }, []);

  const selected = watches.find((watch) => watch.id === selectedId);
  const selectedHistory = useMemo(() => history.filter((entry) => entry.watchId === selectedId), [history, selectedId]);

  async function saveWatch() {
    setBusy(true);
    setStatus(undefined);
    try {
      const normalized = normalizeJsonWatch({
        id: crypto.randomUUID(), title, url, path, intervalMinutes,
        condition, conditionValue, notify, enabled: true, addedAt: new Date().toISOString(),
      });
      const config: JsonWatchConfig = {
        id: normalized.id, title: normalized.title, url: normalized.url, path: normalized.path,
        intervalMinutes: normalized.intervalMinutes, condition: normalized.condition,
        conditionValue: normalized.conditionValue, notify: normalized.notify,
      };
      if (!(await requestMonitorPermissions(config.url, config.notify))) {
        setStatus(t("monitor.permissionDenied"));
        return;
      }
      const response = await sendCommand({ type: "SAVE_JSON_WATCH", watch: config });
      if (!response.ok) throw new Error(response.error);
      await reload();
      setSelectedId(config.id);
      setTitle(""); setUrl(""); setPath("$"); setConditionValue("");
      setStatus(t("monitor.saved"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("monitor.failed"));
    } finally { setBusy(false); }
  }

  async function runWatch(watchId: string) {
    setBusy(true); setStatus(undefined);
    try {
      const response = await sendCommand({ type: "RUN_JSON_WATCH", watchId });
      if (!response.ok) throw new Error(response.error);
      await reload(); setSelectedId(watchId); setStatus(t("monitor.refreshed"));
    } catch (error) { setStatus(error instanceof Error ? error.message : t("monitor.failed")); }
    finally { setBusy(false); }
  }

  async function removeWatch(watchId: string) {
    setBusy(true); setStatus(undefined);
    try {
      const response = await sendCommand({ type: "REMOVE_JSON_WATCH", watchId });
      if (!response.ok) throw new Error(response.error);
      await reload(); setStatus(t("monitor.removed"));
    } catch (error) { setStatus(error instanceof Error ? error.message : t("monitor.failed")); }
    finally { setBusy(false); }
  }

  function exportHistory(kind: "json" | "csv") {
    if (!selected) return;
    const base = `benchtab-monitor-${selected.title.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-") || "history"}`;
    if (kind === "json") download(`${base}.json`, JSON.stringify({ schema: "benchtab.monitor-history", version: 1, monitor: selected, history: selectedHistory }, null, 2), "application/json");
    else {
      const rows = [["checkedAt", "changed", "triggered", "previous", "current"], ...selectedHistory.map((entry) => [entry.checkedAt, entry.changed, entry.triggered, entry.previous ?? "", entry.current])];
      download(`${base}.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), "text/csv");
    }
  }

  return <article class="widget monitor-panel">
    <div class="widget__heading"><span class="widget__eyebrow">{t("monitor.eyebrow")}</span><span class="module-count">{watches.length}</span></div>
    <h2>{t("monitor.title")}</h2>
    <p class="widget__description">{t("monitor.description")}</p>

    <details class="feed-config" open>
      <summary>{t("monitor.new")}</summary>
      <form class="monitor-form" onSubmit={(event) => { event.preventDefault(); void saveWatch(); }}>
        <label>{t("monitor.name")}<input required maxlength={100} value={title} onInput={(event) => setTitle(event.currentTarget.value)} placeholder={t("monitor.namePlaceholder")} /></label>
        <label>{t("monitor.url")}<input required type="url" pattern="https://.*" value={url} onInput={(event) => setUrl(event.currentTarget.value)} placeholder="https://example.org/status.json" /></label>
        <label>{t("monitor.path")}<input maxlength={240} value={path} onInput={(event) => setPath(event.currentTarget.value)} placeholder="releases.0.version" /></label>
        <div class="monitor-form__row">
          <label>{t("monitor.interval")}<select value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.currentTarget.value) as WatchInterval)}>{[30, 60, 180, 360, 720, 1440].map((minutes) => <option value={minutes} key={minutes}>{t("monitor.minutes", { count: minutes })}</option>)}</select></label>
          <label>{t("monitor.condition")}<select value={condition} onChange={(event) => setCondition(event.currentTarget.value as WatchCondition)}>{(["changed", "contains", "not-contains", "number-above", "number-below"] as const).map((kind) => <option value={kind} key={kind}>{t(`monitor.condition.${kind}`)}</option>)}</select></label>
        </div>
        {condition !== "changed" && <label>{t("monitor.conditionValue")}<input required maxlength={240} value={conditionValue} onInput={(event) => setConditionValue(event.currentTarget.value)} /></label>}
        <label class="check-row"><input type="checkbox" checked={notify} onChange={(event) => setNotify(event.currentTarget.checked)} />{t("monitor.notify")}</label>
        <small>{t("monitor.privacy")}</small>
        <button class="button button--small" type="submit" disabled={busy}>{t("monitor.save")}</button>
      </form>
    </details>

    {watches.length > 0 && <div class="monitor-list" role="list">{watches.map((watch) => <button type="button" role="listitem" key={watch.id} aria-pressed={selectedId === watch.id} onClick={() => setSelectedId(watch.id)}><strong>{watch.title}</strong><small class={watch.lastError ? "source-error" : ""}>{watch.lastError ?? (watch.lastCheckedAt ? t("monitor.checked", { date: new Date(watch.lastCheckedAt).toLocaleString(locale) }) : t("monitor.waiting"))}</small></button>)}</div>}

    {selected && <section class="monitor-history">
      <header><div><p class="overline">{t("monitor.history")}</p><h3>{selected.title}</h3></div><div><button type="button" disabled={busy} onClick={() => void runWatch(selected.id)}>↻ {t("monitor.checkNow")}</button><button type="button" onClick={() => exportHistory("json")}>JSON</button><button type="button" onClick={() => exportHistory("csv")}>CSV</button><button type="button" disabled={busy} onClick={() => void removeWatch(selected.id)}>×</button></div></header>
      {selected.lastValue !== undefined && <pre>{selected.lastValue}</pre>}
      <ol>{selectedHistory.slice(0, 8).map((entry) => <li key={entry.id} data-changed={entry.changed || undefined}><time>{new Date(entry.checkedAt).toLocaleString(locale)}</time><span>{entry.changed ? t("monitor.changed") : t("monitor.unchanged")}{entry.triggered ? ` · ${t("monitor.triggered")}` : ""}</span>{entry.changed && entry.previous !== undefined && <details><summary>{t("monitor.diff")}</summary><del>{entry.previous}</del><ins>{entry.current}</ins></details>}</li>)}</ol>
    </section>}
    {status && <p class="inline-status" role="status">{status}</p>}
  </article>;
}
