import type { BenchTabBackupEnvelope } from "./backup";

const DATABASE_NAME = "benchtab-backups";
const DATABASE_VERSION = 1;
const STORE = "snapshots";
const MAX_SNAPSHOTS = 3;

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  sizeBytes: number;
  reason: "download" | "pre-restore";
  envelope: BenchTabBackupEnvelope;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("Backup snapshot request failed.")), { once: true });
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Backup snapshot transaction failed.")), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("Backup snapshot transaction aborted.")), { once: true });
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.addEventListener("upgradeneeded", () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
  });
  return requestResult(request);
}

export async function saveBackupSnapshot(envelope: BenchTabBackupEnvelope, reason: BackupSnapshot["reason"]): Promise<void> {
  const serialized = JSON.stringify(envelope);
  const snapshot: BackupSnapshot = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(),
    sizeBytes: new TextEncoder().encode(serialized).byteLength, reason, envelope,
  };
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  const existing = await requestResult<BackupSnapshot[]>(store.getAll());
  store.put(snapshot);
  for (const stale of existing.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(MAX_SNAPSHOTS - 1)) store.delete(stale.id);
  await transactionDone(transaction);
  database.close();
}

export async function listBackupSnapshots(): Promise<BackupSnapshot[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readonly");
  const snapshots = await requestResult<BackupSnapshot[]>(transaction.objectStore(STORE).getAll());
  await transactionDone(transaction);
  database.close();
  return snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getBackupSnapshot(id: string): Promise<BackupSnapshot | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readonly");
  const snapshot = await requestResult<BackupSnapshot | undefined>(transaction.objectStore(STORE).get(id));
  await transactionDone(transaction);
  database.close();
  return snapshot;
}

export async function clearBackupSnapshots(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).clear();
  await transactionDone(transaction);
  database.close();
}
