import { describe, expect, it } from "vitest";

import { normalizeReadingEntries } from "./readingStore";

describe("readingStore", () => {
  it("normalizes, deduplicates and keeps the newest item state", () => {
    expect(normalizeReadingEntries([
      { itemId: "paper-1", status: "later", updatedAt: "2026-08-20T10:00:00Z" },
      { itemId: "paper-1", status: "read", updatedAt: "2026-08-21T10:00:00Z" },
      { itemId: "paper-2", status: "unknown", updatedAt: "2026-08-21T10:00:00Z" },
      null,
    ])).toEqual([{ itemId: "paper-1", status: "read", updatedAt: "2026-08-21T10:00:00.000Z" }]);
  });

  it("rejects malformed identifiers and dates", () => {
    expect(normalizeReadingEntries([
      { itemId: "", status: "later", updatedAt: "2026-08-21T10:00:00Z" },
      { itemId: "paper", status: "later", updatedAt: "not-a-date" },
    ])).toEqual([]);
  });
});
