import {
  normalizeLiteratureStream,
  type LiteratureStreamConfig,
} from "../features/feeds";

const STORAGE_KEY = "literature.streams.v1";
export const LITERATURE_CACHE_TTL_MS = 60 * 60_000;

export interface LiteratureStream extends LiteratureStreamConfig {
  enabled: boolean;
  addedAt: string;
  lastSuccessAt?: string;
  lastError?: string;
  lastResultCount?: number;
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export function normalizeStoredLiteratureStream(value: unknown): LiteratureStream | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Partial<LiteratureStream>;
  try {
    const config = normalizeLiteratureStream(record);
    const addedAt = normalizeDate(record.addedAt) ?? new Date().toISOString();
    const lastSuccessAt = normalizeDate(record.lastSuccessAt);
    const lastError = typeof record.lastError === "string" ? record.lastError.slice(0, 500) : undefined;
    const lastResultCount = Number.isFinite(record.lastResultCount)
      ? Math.max(0, Math.min(Math.trunc(record.lastResultCount!), config.pageSize))
      : undefined;
    return {
      ...config,
      enabled: record.enabled !== false,
      addedAt,
      ...(lastSuccessAt ? { lastSuccessAt } : {}),
      ...(lastError ? { lastError } : {}),
      ...(lastResultCount !== undefined ? { lastResultCount } : {}),
    };
  } catch {
    return undefined;
  }
}

export async function listLiteratureStreams(): Promise<LiteratureStream[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    const stream = normalizeStoredLiteratureStream(value);
    return stream ? [stream] : [];
  }).slice(0, 30);
}

export async function getLiteratureStream(id: string): Promise<LiteratureStream | undefined> {
  return (await listLiteratureStreams()).find((stream) => stream.id === id);
}

export async function upsertLiteratureStream(stream: LiteratureStream): Promise<void> {
  const normalized = normalizeStoredLiteratureStream(stream);
  if (!normalized) throw new Error("The literature stream is invalid.");
  const streams = await listLiteratureStreams();
  const index = streams.findIndex((candidate) => candidate.id === normalized.id);
  if (index >= 0) streams[index] = normalized;
  else {
    if (streams.length >= 30) throw new Error("At most 30 literature streams can be saved.");
    streams.push(normalized);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: streams });
}

export async function removeLiteratureStream(id: string): Promise<void> {
  const streams = (await listLiteratureStreams()).filter((stream) => stream.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: streams });
}

export function isLiteratureStreamStale(stream: LiteratureStream, now = Date.now()): boolean {
  if (!stream.lastSuccessAt) return true;
  const lastSuccess = Date.parse(stream.lastSuccessAt);
  return !Number.isFinite(lastSuccess) || now - lastSuccess >= LITERATURE_CACHE_TTL_MS;
}
