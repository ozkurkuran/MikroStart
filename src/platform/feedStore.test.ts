import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import type { NormalizedFeedItem } from "../features/feeds";
import { listLatestFeedItems, putFeedItems, replaceFeedItemsForSource } from "./feedStore";

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function item(sourceId: string, retrievedAt: string): NormalizedFeedItem {
  return {
    id: "doi:10.1000/example",
    sourceId,
    connectorId: "rss-atom",
    canonicalUrl: "https://doi.org/10.1000/example",
    title: "A reproducible thin-film result",
    authors: [{ name: "Ada Researcher" }],
    publishedAt: "2026-08-20T00:00:00.000Z",
    retrievedAt,
    identifiers: { doi: "10.1000/example" },
    provenance: {
      sources: [
        {
          sourceId,
          connectorId: "rss-atom",
          retrievedAt,
          feedUrl: `https://${sourceId}.example/feed.xml`,
        },
      ],
    },
    contentHash: `hash-${sourceId}`,
  };
}

beforeEach(async () => {
  await deleteDatabase("benchtab-feeds");
});

describe("feedStore", () => {
  it("merges duplicate records without losing source provenance", async () => {
    await putFeedItems([item("source-a", "2026-08-21T10:00:00.000Z")]);
    await putFeedItems([item("source-b", "2026-08-22T10:00:00.000Z")]);

    const records = await listLatestFeedItems();
    expect(records).toHaveLength(1);
    expect(records[0].provenance.sources.map((source) => source.sourceId)).toEqual([
      "source-a",
      "source-b",
    ]);
    expect(records[0].retrievedAt).toBe("2026-08-22T10:00:00.000Z");
  });

  it("atomically replaces one saved stream without removing shared provenance", async () => {
    await putFeedItems([item("stream-a", "2026-08-21T10:00:00.000Z")]);
    await putFeedItems([item("stream-b", "2026-08-22T10:00:00.000Z")]);
    await replaceFeedItemsForSource("stream-a", []);

    const records = await listLatestFeedItems();
    expect(records).toHaveLength(1);
    expect(records[0].provenance.sources.map((source) => source.sourceId)).toEqual(["stream-b"]);
  });
});
