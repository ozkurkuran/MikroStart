import { describe, expect, it } from "vitest";

import {
  buildLiteratureProviderUrl,
  filterAndRankLiteratureItems,
  normalizeLiteratureStream,
  parseCrossrefWorks,
} from "./literatureSearch";

const stream = normalizeLiteratureStream({
  id: "stream-1",
  title: "Thin films",
  query: "thin film",
  providers: ["arxiv", "crossref", "arxiv"],
  blockedTerms: ["conference", "conference", ""],
  sort: "newest",
  pageSize: 20,
});

describe("literature stream configuration", () => {
  it("normalizes bounded providers and blocked terms", () => {
    expect(stream.providers).toEqual(["arxiv", "crossref"]);
    expect(stream.blockedTerms).toEqual(["conference"]);
    expect(() => normalizeLiteratureStream({ ...stream, query: "x" })).toThrow("two characters");
    expect(() => normalizeLiteratureStream({ ...stream, providers: [] })).toThrow("provider");
  });

  it("builds provider-scoped, bounded query URLs", () => {
    const arxiv = new URL(buildLiteratureProviderUrl("arxiv", stream));
    expect(arxiv.origin).toBe("https://export.arxiv.org");
    expect(arxiv.searchParams.get("search_query")).toBe("all:thin AND all:film");
    expect(arxiv.searchParams.get("max_results")).toBe("20");

    const crossref = new URL(buildLiteratureProviderUrl("crossref", stream));
    expect(crossref.origin).toBe("https://api.crossref.org");
    expect(crossref.searchParams.get("query.bibliographic")).toBe("thin film");
    expect(crossref.searchParams.get("rows")).toBe("20");
  });
});

describe("Crossref normalization", () => {
  it("turns bounded public metadata into source-preserving feed items", () => {
    const items = parseCrossrefWorks(JSON.stringify({
      status: "ok",
      message: { items: [{
        DOI: "10.1000/EXAMPLE",
        title: ["<b>Thin-film result</b>"],
        author: [{ given: "Ada", family: "Researcher" }],
        published: { "date-parts": [[2026, 8, 20]] },
        abstract: "<jats:p>A useful abstract.</jats:p>",
        language: "en",
      }] },
    }), {
      sourceId: "stream-1",
      retrievedAt: "2026-08-25T10:00:00.000Z",
      requestUrl: "https://api.crossref.org/works?query=film",
      maxItems: 20,
    });

    expect(items[0]).toMatchObject({
      id: "doi:10.1000/example",
      canonicalUrl: "https://doi.org/10.1000/example",
      title: "Thin-film result",
      authors: [{ name: "Ada Researcher" }],
      publishedAt: "2026-08-20T00:00:00.000Z",
      connectorId: "crossref-api",
    });
    expect(items[0].sourceDescription).toBe("A useful abstract.");
  });

  it("rejects malformed, oversized, and over-populated responses", () => {
    const options = { sourceId: "s", retrievedAt: "2026-08-25T10:00:00Z", requestUrl: "https://api.crossref.org/works", maxItems: 1 };
    expect(() => parseCrossrefWorks("not json", options)).toThrow("valid JSON");
    expect(() => parseCrossrefWorks(JSON.stringify({ message: { items: [{}, {}] } }), options)).toThrow("too many");
    expect(() => parseCrossrefWorks("x".repeat(100), { ...options, maxInputBytes: 10 })).toThrow("safety limit");
  });
});

describe("literature filtering and ranking", () => {
  it("removes blocked terms and ranks title matches deterministically", () => {
    const base = {
      sourceId: "stream-1", connectorId: "crossref-api", authors: [], retrievedAt: "2026-08-25T10:00:00.000Z",
      identifiers: {}, provenance: { sources: [] }, contentHash: "hash",
    };
    const items = [
      { ...base, id: "1", title: "Conference announcement", publishedAt: "2026-08-25T00:00:00Z" },
      { ...base, id: "2", title: "Thin film deposition", publishedAt: "2026-08-24T00:00:00Z" },
      { ...base, id: "3", title: "Deposition method", sourceDescription: "thin film", publishedAt: "2026-08-23T00:00:00Z" },
    ];
    const ranked = filterAndRankLiteratureItems(items, { ...stream, sort: "relevance" });
    expect(ranked.map((item) => item.title)).toEqual([
      "Thin film deposition",
      "Deposition method",
    ]);
  });
});
