export type ReadingStatus = "later" | "read";

export interface ReadingEntry {
  itemId: string;
  status: ReadingStatus;
  updatedAt: string;
}

const STORAGE_KEY = "feeds.reading.v1";
const MAX_ENTRIES = 1_000;

export function normalizeReadingEntries(value: unknown): ReadingEntry[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, ReadingEntry>();
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const record = candidate as Partial<ReadingEntry>;
    if (typeof record.itemId !== "string" || !record.itemId || record.itemId.length > 256) continue;
    if (record.status !== "later" && record.status !== "read") continue;
    if (typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt))) continue;
    const entry = { itemId: record.itemId, status: record.status, updatedAt: new Date(record.updatedAt).toISOString() };
    const existing = byId.get(entry.itemId);
    if (!existing || entry.updatedAt > existing.updatedAt) byId.set(entry.itemId, entry);
  }
  return [...byId.values()]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_ENTRIES);
}

export async function listReadingEntries(): Promise<ReadingEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeReadingEntries(result[STORAGE_KEY]);
}

export async function setReadingStatus(itemId: string, status?: ReadingStatus): Promise<void> {
  if (!itemId || itemId.length > 256) throw new Error("The reading item identifier is invalid.");
  const entries = (await listReadingEntries()).filter((entry) => entry.itemId !== itemId);
  if (status) entries.unshift({ itemId, status, updatedAt: new Date().toISOString() });
  await chrome.storage.local.set({ [STORAGE_KEY]: entries.slice(0, MAX_ENTRIES) });
}

export async function clearReadingEntries(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
