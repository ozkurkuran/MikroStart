import {
  mergeDuplicateFeedItems,
  type NormalizedFeedItem,
} from "../features/feeds";

const DATABASE_NAME = "benchtab-feeds";
const DATABASE_VERSION = 1;
const ITEM_STORE = "items";
const SUBSCRIPTION_KEY = "feeds.subscriptions.v1";

export interface FeedSubscription {
  id: string;
  title: string;
  url: string;
  origin: string;
  connectorId: "rss-atom";
  enabled: boolean;
  addedAt: string;
  lastSuccessAt?: string;
  lastError?: string;
  etag?: string;
  lastModified?: string;
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
    const database = request.result;
    if (!database.objectStoreNames.contains(ITEM_STORE)) {
      const store = database.createObjectStore(ITEM_STORE, { keyPath: "id" });
      store.createIndex("byRetrievedAt", "retrievedAt");
      store.createIndex("bySourceId", "sourceId");
    }
  });
  return requestResult(request);
}

export async function listFeedSubscriptions(): Promise<FeedSubscription[]> {
  const result = await chrome.storage.local.get(SUBSCRIPTION_KEY);
  const value = result[SUBSCRIPTION_KEY];
  return Array.isArray(value) ? (value as FeedSubscription[]) : [];
}

export async function getFeedSubscription(
  sourceId: string,
): Promise<FeedSubscription | undefined> {
  return (await listFeedSubscriptions()).find((item) => item.id === sourceId);
}

export async function upsertFeedSubscription(
  subscription: FeedSubscription,
): Promise<void> {
  const subscriptions = await listFeedSubscriptions();
  const index = subscriptions.findIndex((item) => item.id === subscription.id);
  if (index >= 0) subscriptions[index] = subscription;
  else subscriptions.push(subscription);
  await chrome.storage.local.set({ [SUBSCRIPTION_KEY]: subscriptions });
}

export async function removeFeedSubscription(sourceId: string): Promise<void> {
  const subscriptions = (await listFeedSubscriptions()).filter(
    (item) => item.id !== sourceId,
  );
  await chrome.storage.local.set({ [SUBSCRIPTION_KEY]: subscriptions });

  await removeFeedItemsBySource(sourceId);
}

export async function removeFeedItemsBySource(sourceId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(ITEM_STORE, "readwrite");
  const store = transaction.objectStore(ITEM_STORE);
  const records = await requestResult<NormalizedFeedItem[]>(store.getAll());
  for (const record of records) {
    const remainingSources = record.provenance.sources.filter(
      (source) => source.sourceId !== sourceId,
    );
    if (remainingSources.length === 0) {
      store.delete(record.id);
    } else if (remainingSources.length !== record.provenance.sources.length) {
      store.put({
        ...record,
        sourceId: remainingSources[0].sourceId,
        connectorId: remainingSources[0].connectorId,
        provenance: { sources: remainingSources },
      });
    }
  }
  await transactionDone(transaction);
  database.close();
}

export async function putFeedItems(items: NormalizedFeedItem[]): Promise<void> {
  if (items.length === 0) return;
  const database = await openDatabase();
  const transaction = database.transaction(ITEM_STORE, "readwrite");
  const store = transaction.objectStore(ITEM_STORE);
  const existing = await requestResult<NormalizedFeedItem[]>(store.getAll());
  const merged = mergeDuplicateFeedItems([...existing, ...items]).slice(0, 500);
  store.clear();
  for (const item of merged) store.put(item);
  await transactionDone(transaction);
  database.close();
}

export async function replaceFeedItemsForSource(
  sourceId: string,
  items: NormalizedFeedItem[],
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(ITEM_STORE, "readwrite");
  const store = transaction.objectStore(ITEM_STORE);
  const existing = await requestResult<NormalizedFeedItem[]>(store.getAll());
  const retained = existing.flatMap((record) => {
    const sources = record.provenance.sources.filter((source) => source.sourceId !== sourceId);
    if (sources.length === 0) return [];
    if (sources.length === record.provenance.sources.length) return [record];
    return [{
      ...record,
      sourceId: sources[0].sourceId,
      connectorId: sources[0].connectorId,
      provenance: { sources },
    }];
  });
  const merged = mergeDuplicateFeedItems([...retained, ...items]).slice(0, 500);
  store.clear();
  for (const item of merged) store.put(item);
  await transactionDone(transaction);
  database.close();
}

export async function listLatestFeedItems(limit = 40): Promise<NormalizedFeedItem[]> {
  const database = await openDatabase();
  const transaction = database.transaction(ITEM_STORE, "readonly");
  const records = await requestResult<NormalizedFeedItem[]>(
    transaction.objectStore(ITEM_STORE).getAll(),
  );
  await transactionDone(transaction);
  database.close();
  return records
    .sort((left, right) => {
      const leftDate = left.publishedAt ?? left.updatedAt ?? left.retrievedAt;
      const rightDate = right.publishedAt ?? right.updatedAt ?? right.retrievedAt;
      return rightDate.localeCompare(leftDate);
    })
    .slice(0, Math.max(0, limit));
}

export async function clearFeedCache(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(ITEM_STORE, "readwrite");
  transaction.objectStore(ITEM_STORE).clear();
  await transactionDone(transaction);
  database.close();
}
