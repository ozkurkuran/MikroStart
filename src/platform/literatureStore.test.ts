import { describe, expect, it } from "vitest";

import {
  isLiteratureStreamStale,
  normalizeStoredLiteratureStream,
} from "./literatureStore";

describe("stored literature streams", () => {
  it("normalizes valid records and discards invalid records", () => {
    expect(normalizeStoredLiteratureStream({
      id: "xrd",
      title: "XRD",
      query: "x-ray diffraction",
      providers: ["arxiv", "unknown"],
      blockedTerms: [],
      sort: "newest",
      pageSize: 20,
      enabled: true,
      addedAt: "2026-08-25T10:00:00Z",
      lastResultCount: 999,
    })).toMatchObject({
      id: "xrd",
      providers: ["arxiv"],
      lastResultCount: 20,
    });
    expect(normalizeStoredLiteratureStream({ id: "bad", query: "", providers: [] })).toBeUndefined();
  });

  it("treats a cached stream as fresh for one hour", () => {
    const stream = normalizeStoredLiteratureStream({
      id: "xrd", title: "XRD", query: "x-ray diffraction", providers: ["crossref"], blockedTerms: [],
      sort: "newest", pageSize: 20, enabled: true, addedAt: "2026-08-25T10:00:00Z", lastSuccessAt: "2026-08-25T11:00:00Z",
    })!;
    expect(isLiteratureStreamStale(stream, Date.parse("2026-08-25T11:59:59Z"))).toBe(false);
    expect(isLiteratureStreamStale(stream, Date.parse("2026-08-25T12:00:00Z"))).toBe(true);
  });
});
