import { stableHash } from "../features/feeds";

export type WatchCondition = "changed" | "contains" | "not-contains" | "number-above" | "number-below";
export type WatchInterval = 30 | 60 | 180 | 360 | 720 | 1440;

export interface JsonWatchConfig {
  id: string;
  title: string;
  url: string;
  path: string;
  intervalMinutes: WatchInterval;
  condition: WatchCondition;
  conditionValue: string;
  notify: boolean;
}

export interface JsonWatch extends JsonWatchConfig {
  enabled: boolean;
  addedAt: string;
  lastCheckedAt?: string;
  lastChangedAt?: string;
  lastValue?: string;
  lastValueHash?: string;
  lastError?: string;
}

export interface WatchHistoryEntry {
  id: string;
  watchId: string;
  checkedAt: string;
  changed: boolean;
  triggered: boolean;
  previous?: string;
  current: string;
}

const WATCH_KEY = "monitors.json.v1";
const HISTORY_KEY = "monitors.history.v1";
const INTERVALS = new Set<WatchInterval>([30, 60, 180, 360, 720, 1440]);
const CONDITIONS = new Set<WatchCondition>(["changed", "contains", "not-contains", "number-above", "number-below"]);
const MAX_WATCHES = 30;
const MAX_HISTORY_PER_WATCH = 30;
const MAX_VALUE_LENGTH = 8_000;
const FORBIDDEN_PATH_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function cleanText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, limit) : "";
}

function normalizeDate(value: unknown): string | undefined {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}

export function normalizeJsonWatch(value: Partial<JsonWatch>): JsonWatch {
  const id = cleanText(value.id, 128);
  const title = cleanText(value.title, 100);
  if (!id || !title) throw new Error("Monitor name and identifier are required.");
  let url: URL;
  try { url = new URL(String(value.url)); } catch { throw new Error("The monitor URL is invalid."); }
  if (url.protocol !== "https:") throw new Error("Only HTTPS JSON sources are supported.");
  const path = cleanText(value.path, 240) || "$";
  const segments = parseJsonPath(path);
  if (segments.some((segment) => FORBIDDEN_PATH_KEYS.has(segment))) throw new Error("The JSON path contains a forbidden key.");
  const condition = CONDITIONS.has(value.condition as WatchCondition) ? value.condition as WatchCondition : "changed";
  const conditionValue = cleanText(value.conditionValue, 240);
  if (condition !== "changed" && !conditionValue) throw new Error("This monitor condition requires a comparison value.");
  if ((condition === "number-above" || condition === "number-below") && !Number.isFinite(Number(conditionValue.replace(",", ".")))) {
    throw new Error("The numeric monitor condition requires a finite number.");
  }
  const addedAt = normalizeDate(value.addedAt) ?? new Date().toISOString();
  const lastCheckedAt = normalizeDate(value.lastCheckedAt);
  const lastChangedAt = normalizeDate(value.lastChangedAt);
  const hasLastValue = typeof value.lastValue === "string";
  const lastValue = cleanText(value.lastValue, MAX_VALUE_LENGTH);
  const lastValueHash = cleanText(value.lastValueHash, 128);
  const lastError = cleanText(value.lastError, 500);
  return {
    id, title, url: url.href, path,
    intervalMinutes: INTERVALS.has(value.intervalMinutes as WatchInterval) ? value.intervalMinutes as WatchInterval : 60,
    condition, conditionValue, notify: value.notify === true, enabled: value.enabled !== false, addedAt,
    ...(lastCheckedAt ? { lastCheckedAt } : {}),
    ...(lastChangedAt ? { lastChangedAt } : {}),
    ...(hasLastValue ? { lastValue } : {}),
    ...(lastValueHash ? { lastValueHash } : {}),
    ...(lastError ? { lastError } : {}),
  };
}

export function parseJsonPath(path: string): string[] {
  const normalized = path.trim();
  if (!normalized || normalized === "$" || normalized === "/") return [];
  if (normalized.startsWith("/")) return normalized.slice(1).split("/").filter(Boolean).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  return normalized.replace(/^\$\.?/, "").split(".").filter(Boolean);
}

export function extractJsonWatchValue(document: unknown, path: string): string {
  let current: unknown = document;
  for (const segment of parseJsonPath(path)) {
    if (FORBIDDEN_PATH_KEYS.has(segment) || current === null || typeof current !== "object") throw new Error(`JSON path was not found: ${path}`);
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) throw new Error(`JSON path was not found: ${path}`);
      current = current[index];
    } else if (Object.prototype.hasOwnProperty.call(current, segment)) {
      current = (current as Record<string, unknown>)[segment];
    } else throw new Error(`JSON path was not found: ${path}`);
  }
  const serialized = typeof current === "string" ? current : JSON.stringify(current, null, 2);
  if (serialized === undefined) throw new Error("The selected JSON value cannot be represented as text.");
  return serialized.trim().slice(0, MAX_VALUE_LENGTH);
}

export function evaluateWatchCondition(condition: WatchCondition, expected: string, current: string, changed: boolean): boolean {
  if (condition === "changed") return changed;
  if (condition === "contains") return current.toLocaleLowerCase("en-US").includes(expected.toLocaleLowerCase("en-US"));
  if (condition === "not-contains") return !current.toLocaleLowerCase("en-US").includes(expected.toLocaleLowerCase("en-US"));
  const actualNumber = Number(current.replace(",", "."));
  const expectedNumber = Number(expected.replace(",", "."));
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
  return condition === "number-above" ? actualNumber > expectedNumber : actualNumber < expectedNumber;
}

export function monitorValueHash(value: string): string { return stableHash(value); }

export function isWatchDue(watch: JsonWatch, now = Date.now()): boolean {
  if (!watch.lastCheckedAt) return true;
  return now - Date.parse(watch.lastCheckedAt) >= watch.intervalMinutes * 60_000;
}

export async function listJsonWatches(): Promise<JsonWatch[]> {
  const result = await chrome.storage.local.get(WATCH_KEY);
  if (!Array.isArray(result[WATCH_KEY])) return [];
  return result[WATCH_KEY].flatMap((candidate: unknown) => {
    try { return [normalizeJsonWatch(candidate as Partial<JsonWatch>)]; } catch { return []; }
  }).slice(0, MAX_WATCHES);
}

export async function getJsonWatch(id: string): Promise<JsonWatch | undefined> {
  return (await listJsonWatches()).find((watch) => watch.id === id);
}

export async function upsertJsonWatch(watch: JsonWatch): Promise<void> {
  const normalized = normalizeJsonWatch(watch);
  const watches = await listJsonWatches();
  const index = watches.findIndex((candidate) => candidate.id === normalized.id);
  if (index >= 0) watches[index] = normalized;
  else {
    if (watches.length >= MAX_WATCHES) throw new Error(`At most ${MAX_WATCHES} monitors can be saved.`);
    watches.push(normalized);
  }
  await chrome.storage.local.set({ [WATCH_KEY]: watches });
}

export async function removeJsonWatch(id: string): Promise<void> {
  const watches = (await listJsonWatches()).filter((watch) => watch.id !== id);
  const history = (await listWatchHistory()).filter((entry) => entry.watchId !== id);
  await chrome.storage.local.set({ [WATCH_KEY]: watches, [HISTORY_KEY]: history });
}

export async function listWatchHistory(watchId?: string): Promise<WatchHistoryEntry[]> {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  if (!Array.isArray(result[HISTORY_KEY])) return [];
  return result[HISTORY_KEY].flatMap((candidate: unknown) => {
    if (typeof candidate !== "object" || candidate === null) return [];
    const entry = candidate as Partial<WatchHistoryEntry>;
    const id = cleanText(entry.id, 128);
    const entryWatchId = cleanText(entry.watchId, 128);
    const checkedAt = normalizeDate(entry.checkedAt);
    if (!id || !entryWatchId || !checkedAt || (watchId && entryWatchId !== watchId)) return [];
    return [{
      id, watchId: entryWatchId, checkedAt,
      changed: entry.changed === true, triggered: entry.triggered === true,
      ...(typeof entry.previous === "string" ? { previous: cleanText(entry.previous, MAX_VALUE_LENGTH) } : {}),
      current: cleanText(entry.current, MAX_VALUE_LENGTH),
    } satisfies WatchHistoryEntry];
  }).sort((left, right) => right.checkedAt.localeCompare(left.checkedAt));
}

export async function addWatchHistory(entry: WatchHistoryEntry): Promise<void> {
  const history = await listWatchHistory();
  const next = [entry, ...history].filter((candidate, index, all) =>
    all.slice(0, index).filter((earlier) => earlier.watchId === candidate.watchId).length < MAX_HISTORY_PER_WATCH
  );
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
}
