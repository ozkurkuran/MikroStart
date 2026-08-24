const DATABASE_NAME = "benchtab-jobs";
const DATABASE_VERSION = 1;
const STORE = "jobs";
const LEASE_MS = 25_000;

export interface RefreshSourceJob {
  id: string;
  type: "refresh-source";
  sourceId: string;
  status: "queued" | "leased" | "retry";
  attempt: number;
  nextAttemptAt: number;
  leaseUntil?: number;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed.")),
      { once: true },
    );
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed.")),
      { once: true },
    );
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction aborted.")),
      { once: true },
    );
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.addEventListener("upgradeneeded", () => {
    if (!request.result.objectStoreNames.contains(STORE)) {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    }
  });
  return requestResult(request);
}

export async function enqueueSourceRefresh(
  sourceId: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  const id = `refresh:${sourceId}`;
  const existing = await requestResult<RefreshSourceJob | undefined>(store.get(id));
  const now = Date.now();
  if (
    existing &&
    ((existing.status === "leased" && (existing.leaseUntil ?? 0) > now) ||
      (!options.force && existing.status === "retry" && existing.nextAttemptAt > now))
  ) {
    await transactionDone(transaction);
    database.close();
    return;
  }

  store.put({
    id,
    type: "refresh-source",
    sourceId,
    status: "queued",
    attempt: 0,
    nextAttemptAt: now,
  } satisfies RefreshSourceJob);
  await transactionDone(transaction);
  database.close();
}

export async function claimNextRefreshJob(): Promise<RefreshSourceJob | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  const jobs = await requestResult<RefreshSourceJob[]>(store.getAll());
  const now = Date.now();
  const job = jobs
    .filter(
      (candidate) =>
        candidate.nextAttemptAt <= now &&
        (candidate.status !== "leased" || (candidate.leaseUntil ?? 0) <= now),
    )
    .sort((left, right) => left.nextAttemptAt - right.nextAttemptAt)[0];
  if (!job) {
    await transactionDone(transaction);
    database.close();
    return undefined;
  }
  const claimed: RefreshSourceJob = {
    ...job,
    status: "leased",
    leaseUntil: now + LEASE_MS,
  };
  store.put(claimed);
  await transactionDone(transaction);
  database.close();
  return claimed;
}

export async function completeRefreshJob(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).delete(id);
  await transactionDone(transaction);
  database.close();
}

export async function retryRefreshJob(job: RefreshSourceJob): Promise<void> {
  const attempt = job.attempt + 1;
  const delay = Math.min(6 * 60 * 60_000, 30_000 * 2 ** Math.min(attempt, 8));
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).put({
    ...job,
    status: "retry",
    attempt,
    leaseUntil: undefined,
    nextAttemptAt: Date.now() + delay,
  } satisfies RefreshSourceJob);
  await transactionDone(transaction);
  database.close();
}

export async function clearJobQueue(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).clear();
  await transactionDone(transaction);
  database.close();
}
