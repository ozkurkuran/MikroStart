import {
  IndexedDbNotebookRepository,
  previewNotebookImport,
  type NotebookExportConflictIndex,
  type NotebookExportEnvelope,
} from "../features/notebook";
import { saveBackupSnapshot } from "./backupSnapshots";

export const FULL_BACKUP_FORMAT = "benchtab-full-backup" as const;
export const FULL_BACKUP_SCHEMA_VERSION = 1 as const;
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const META_KEY = "backup.meta.v1";
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export interface BenchTabBackupEnvelope {
  format: typeof FULL_BACKUP_FORMAT;
  schemaVersion: typeof FULL_BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  appVersion: string;
  data: {
    chromeLocal: Record<string, unknown>;
    chromeSync: Record<string, unknown>;
    localStorage: Record<string, string>;
    notebook: NotebookExportEnvelope;
  };
}

export interface BackupMeta {
  lastBackupAt?: string;
  lastRestoreAt?: string;
}

export interface FullBackupPreview {
  valid: boolean;
  issues: string[];
  conflicts: string[];
  counts: {
    localKeys: number;
    syncKeys: number;
    browserValues: number;
    notes: number;
    references: number;
    calculations: number;
    sourceLinks: number;
  };
  envelope?: BenchTabBackupEnvelope;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSafeJson(value: unknown, path = "$", depth = 0): void {
  if (depth > 24) throw new Error(`${path} exceeds the nesting limit.`);
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number.`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 20_000) throw new Error(`${path} contains too many items.`);
    value.forEach((item, index) => assertSafeJson(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (!isRecord(value)) throw new Error(`${path} contains an unsupported value.`);
  for (const [key, item] of Object.entries(value)) {
    if (!key || key.length > 240 || FORBIDDEN_KEYS.has(key)) throw new Error(`${path} contains an unsafe key.`);
    assertSafeJson(item, `${path}.${key}`, depth + 1);
  }
}

function safeRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
  assertSafeJson(value, path);
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function safeStringRecord(value: unknown, path: string): Record<string, string> {
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!key || key.length > 240 || FORBIDDEN_KEYS.has(key) || typeof item !== "string") throw new Error(`${path} contains an invalid browser-storage entry.`);
    output[key] = item;
  }
  return output;
}

function localStorageRecord(storage: Storage): Record<string, string> {
  const output: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    const value = storage.getItem(key);
    if (value !== null) output[key] = value;
  }
  return output;
}

function withoutBackupMeta(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== META_KEY));
}

async function collectFullBackup(appVersion: string, storage: Storage): Promise<BenchTabBackupEnvelope> {
  const repository = new IndexedDbNotebookRepository();
  try {
    const [chromeLocal, chromeSync, notebook] = await Promise.all([
      chrome.storage.local.get(null),
      chrome.storage.sync ? chrome.storage.sync.get(null) : Promise.resolve({}),
      repository.exportData(appVersion),
    ]);
    return {
      format: FULL_BACKUP_FORMAT,
      schemaVersion: FULL_BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion,
      data: {
        chromeLocal: withoutBackupMeta(chromeLocal),
        chromeSync,
        localStorage: localStorageRecord(storage),
        notebook,
      },
    };
  } finally { repository.close(); }
}

export function parseFullBackup(input: string | unknown): BenchTabBackupEnvelope {
  let value: unknown = input;
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).byteLength > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 20 MiB size limit.");
    try { value = JSON.parse(input); } catch { throw new Error("Backup is not valid JSON."); }
  }
  if (!isRecord(value)) throw new Error("Backup envelope is invalid.");
  const allowed = new Set(["format", "schemaVersion", "exportedAt", "appVersion", "data"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("Backup envelope contains unknown fields.");
  if (value.format !== FULL_BACKUP_FORMAT || value.schemaVersion !== FULL_BACKUP_SCHEMA_VERSION) throw new Error("Backup schema is not supported.");
  if (typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) throw new Error("Backup export date is invalid.");
  if (typeof value.appVersion !== "string" || !value.appVersion || value.appVersion.length > 40) throw new Error("Backup app version is invalid.");
  if (!isRecord(value.data)) throw new Error("Backup data is invalid.");
  const dataAllowed = new Set(["chromeLocal", "chromeSync", "localStorage", "notebook"]);
  if (Object.keys(value.data).some((key) => !dataAllowed.has(key))) throw new Error("Backup data contains unknown fields.");
  const notebookPreview = previewNotebookImport(value.data.notebook);
  if (!notebookPreview.valid || !notebookPreview.envelope) throw new Error(notebookPreview.issues[0]?.message ?? "Notebook backup is invalid.");
  const envelope: BenchTabBackupEnvelope = {
    format: FULL_BACKUP_FORMAT,
    schemaVersion: FULL_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(value.exportedAt).toISOString(),
    appVersion: value.appVersion,
    data: {
      chromeLocal: withoutBackupMeta(safeRecord(value.data.chromeLocal, "$.data.chromeLocal")),
      chromeSync: safeRecord(value.data.chromeSync, "$.data.chromeSync"),
      localStorage: safeStringRecord(value.data.localStorage, "$.data.localStorage"),
      notebook: notebookPreview.envelope,
    },
  };
  if (new TextEncoder().encode(JSON.stringify(envelope)).byteLength > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 20 MiB size limit.");
  return envelope;
}

export async function createFullBackup(storage: Storage = window.localStorage): Promise<BenchTabBackupEnvelope> {
  const envelope = await collectFullBackup(chrome.runtime.getManifest().version, storage);
  const sanitized = parseFullBackup(envelope);
  await Promise.all([
    saveBackupSnapshot(sanitized, "download"),
    chrome.storage.local.set({ [META_KEY]: { ...(await loadBackupMeta()), lastBackupAt: sanitized.exportedAt } }),
  ]);
  return sanitized;
}

export function downloadBackupEnvelope(envelope: BenchTabBackupEnvelope): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `benchtab-full-backup-${envelope.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function loadBackupMeta(): Promise<BackupMeta> {
  const result = await chrome.storage.local.get(META_KEY);
  const value = isRecord(result[META_KEY]) ? result[META_KEY] : {};
  const valid = (candidate: unknown) => typeof candidate === "string" && Number.isFinite(Date.parse(candidate)) ? new Date(candidate).toISOString() : undefined;
  return { lastBackupAt: valid(value.lastBackupAt), lastRestoreAt: valid(value.lastRestoreAt) };
}

function conflictIndex(notebook: NotebookExportEnvelope): NotebookExportConflictIndex {
  return {
    noteIds: new Set(notebook.data.notes.map((record) => record.id)),
    referenceIds: new Set(notebook.data.references.map((record) => record.id)),
    calculationIds: new Set(notebook.data.calculations.map((record) => record.id)),
    sourceLinkIds: new Set(notebook.data.sourceLinks.map((record) => record.id)),
  };
}

export async function previewFullBackup(input: string | unknown, storage: Storage = window.localStorage): Promise<FullBackupPreview> {
  try {
    const envelope = parseFullBackup(input);
    const repository = new IndexedDbNotebookRepository();
    try {
      const [local, sync, currentNotebook] = await Promise.all([
        chrome.storage.local.get(null),
        chrome.storage.sync ? chrome.storage.sync.get(null) : Promise.resolve({}),
        repository.exportData(chrome.runtime.getManifest().version),
      ]);
      const notebookPreview = previewNotebookImport(envelope.data.notebook, conflictIndex(currentNotebook));
      const conflicts = [
        ...Object.keys(envelope.data.chromeLocal).filter((key) => key !== META_KEY && Object.prototype.hasOwnProperty.call(local, key)).map((key) => `local:${key}`),
        ...Object.keys(envelope.data.chromeSync).filter((key) => Object.prototype.hasOwnProperty.call(sync, key)).map((key) => `sync:${key}`),
        ...Object.keys(envelope.data.localStorage).filter((key) => storage.getItem(key) !== null).map((key) => `browser:${key}`),
        ...notebookPreview.conflicts.map((conflict) => `notebook:${conflict.entity}:${conflict.id}`),
      ];
      return {
        valid: true, issues: [], conflicts, envelope,
        counts: {
          localKeys: Object.keys(envelope.data.chromeLocal).length,
          syncKeys: Object.keys(envelope.data.chromeSync).length,
          browserValues: Object.keys(envelope.data.localStorage).length,
          ...notebookPreview.counts,
        },
      };
    } finally { repository.close(); }
  } catch (error) {
    return { valid: false, issues: [error instanceof Error ? error.message : "Backup validation failed."], conflicts: [], counts: { localKeys: 0, syncKeys: 0, browserValues: 0, notes: 0, references: 0, calculations: 0, sourceLinks: 0 } };
  }
}

export async function restoreFullBackup(
  envelopeInput: BenchTabBackupEnvelope,
  mode: "merge" | "replace",
  storage: Storage = window.localStorage,
): Promise<void> {
  const envelope = parseFullBackup(envelopeInput);
  const preview = await previewFullBackup(envelope, storage);
  if (!preview.valid) throw new Error(preview.issues[0] ?? "Backup is invalid.");
  if (mode === "merge" && preview.conflicts.length > 0) throw new Error("Merge is blocked until import conflicts are resolved.");
  const repository = new IndexedDbNotebookRepository();
  try {
    if (mode === "replace") {
      const safety = parseFullBackup(await collectFullBackup(chrome.runtime.getManifest().version, storage));
      await saveBackupSnapshot(safety, "pre-restore");
      await repository.deleteAllData();
      await chrome.storage.local.clear();
      if (chrome.storage.sync) await chrome.storage.sync.clear();
      storage.clear();
    }
    if (Object.keys(envelope.data.chromeLocal).length) await chrome.storage.local.set(envelope.data.chromeLocal);
    if (chrome.storage.sync && Object.keys(envelope.data.chromeSync).length) await chrome.storage.sync.set(envelope.data.chromeSync);
    for (const [key, value] of Object.entries(envelope.data.localStorage)) storage.setItem(key, value);
    await repository.importData(envelope.data.notebook);
    await chrome.storage.local.set({ [META_KEY]: { ...(await loadBackupMeta()), lastRestoreAt: new Date().toISOString() } });
  } finally { repository.close(); }
}
