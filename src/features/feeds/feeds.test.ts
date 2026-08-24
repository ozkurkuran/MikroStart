import { describe, expect, it } from "vitest";

import { ATOM_FIXTURE, MALICIOUS_ATOM_FIXTURE } from "./__fixtures__/atom";
import { RSS_DUPLICATE_FIXTURE, RSS_FIXTURE } from "./__fixtures__/rss";
import {
  FeedParseError,
  canonicalizeHttpsUrl,
  getFeedParseErrorForUi,
  mergeDuplicateFeedItems,
  parseFeed,
} from "./index";

const RETRIEVED_AT = "2026-08-24T12:00:00.000Z";

describe("RSS 2.0 normalization", () => {
  it("normalizes source metadata, identifiers, dates, text, and URLs", () => {
    const result = parseFeed(RSS_FIXTURE, {
      sourceId: "journal-feed",
      connectorId: "rss-atom",
      feedUrl: "https://journal.example.org/feed.xml",
      retrievedAt: RETRIEVED_AT,
    });

    expect(result.format).toBe("rss2");
    expect(result.title).toBe("Materials & Interfaces");
    expect(result.homePageUrl).toBe("https://journal.example.org/");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "doi:10.1234/thin.film.42",
      canonicalUrl: "https://journal.example.org/articles/42?a=1&b=2",
      title: "Thin-film growth study",
      authors: [{ name: "Ada Researcher" }],
      publishedAt: "2026-08-24T09:00:00.000Z",
      retrievedAt: RETRIEVED_AT,
      identifiers: { doi: "10.1234/thin.film.42" },
      sourceDescription: "A source-backed abstract.",
      language: "en-us",
    });
    expect(result.items[0].provenance.sources).toHaveLength(1);
  });
});

describe("Atom normalization", () => {
  it("normalizes authors and a version-independent arXiv identifier", () => {
    const result = parseFeed(ATOM_FIXTURE, {
      sourceId: "arxiv",
      connectorId: "rss-atom",
      feedUrl: "https://export.arxiv.org/api/query",
      retrievedAt: RETRIEVED_AT,
    });

    expect(result.format).toBe("atom");
    expect(result.items[0]).toMatchObject({
      id: "arxiv:2608.12345",
      canonicalUrl: "https://arxiv.org/abs/2608.12345v2",
      authors: [{ name: "Deniz Scientist" }, { name: "Elif Engineer" }],
      identifiers: { arxiv: "2608.12345" },
      publishedAt: "2026-08-23T08:00:00.000Z",
      updatedAt: "2026-08-24T10:30:00.000Z",
    });
  });
});

describe("untrusted content", () => {
  it("returns plain text and rejects executable URL schemes", () => {
    const [item] = parseFeed(MALICIOUS_ATOM_FIXTURE, {
      sourceId: "untrusted",
      connectorId: "rss-atom",
      retrievedAt: RETRIEVED_AT,
    }).items;

    expect(item.title).toBe("Safe title");
    expect(item.sourceDescription).toBe("Useful text");
    expect(item.authors).toEqual([{ name: "Researcher" }]);
    expect(item.canonicalUrl).toBeUndefined();
    expect(JSON.stringify(item)).not.toMatch(/javascript:|onerror|document\.cookie|<script/i);
  });

  it("only accepts credential-free HTTPS URLs", () => {
    expect(canonicalizeHttpsUrl("javascript:alert(1)")).toBeUndefined();
    expect(canonicalizeHttpsUrl("data:text/html,bad")).toBeUndefined();
    expect(canonicalizeHttpsUrl("http://example.org/article")).toBeUndefined();
    expect(canonicalizeHttpsUrl("https://user:pass@example.org/article")).toBeUndefined();
    expect(canonicalizeHttpsUrl("https://EXAMPLE.org/a/?utm_source=x&z=2&a=1#part")).toBe(
      "https://example.org/a?a=1&z=2",
    );
  });

  it("rejects DTD/entity declarations", () => {
    expect(() =>
      parseFeed('<!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss version="2.0"/>', {
        sourceId: "bad",
        connectorId: "rss-atom",
      }),
    ).toThrowError(expect.objectContaining({ code: "UNSAFE_XML" }));
  });
});

describe("duplicate merging", () => {
  it("merges duplicate items while preserving every source provenance record", () => {
    const first = parseFeed(RSS_FIXTURE, {
      sourceId: "journal-feed",
      connectorId: "rss-atom",
      retrievedAt: RETRIEVED_AT,
    }).items;
    const second = parseFeed(RSS_DUPLICATE_FIXTURE, {
      sourceId: "institute-feed",
      connectorId: "rss-atom",
      retrievedAt: "2026-08-24T13:00:00.000Z",
    }).items;

    const merged = mergeDuplicateFeedItems([...first, ...second]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("doi:10.1234/thin.film.42");
    expect(merged[0].title).toBe("Thin-film growth study — extended title");
    expect(merged[0].provenance.sources.map(({ sourceId }) => sourceId)).toEqual([
      "institute-feed",
      "journal-feed",
    ]);
  });
});

describe("resource bounds and UI-safe errors", () => {
  it("rejects an oversized input without exposing its contents", () => {
    const secret = "DO_NOT_DISPLAY";
    let error: unknown;
    try {
      parseFeed(`<rss><channel>${secret.repeat(100)}</channel></rss>`, {
        sourceId: "oversized",
        connectorId: "rss-atom",
        maxInputBytes: 100,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(FeedParseError);
    expect(error).toMatchObject({ code: "INPUT_TOO_LARGE" });
    expect((error as Error).message).not.toContain(secret);
  });

  it("rejects an excessive number of entries", () => {
    const items = Array.from({ length: 3 }, (_, index) => `<item><title>${index}</title></item>`).join("");
    expect(() =>
      parseFeed(`<rss version="2.0"><channel>${items}</channel></rss>`, {
        sourceId: "busy-feed",
        connectorId: "rss-atom",
        maxItems: 2,
      }),
    ).toThrowError(expect.objectContaining({ code: "TOO_MANY_ITEMS" }));
  });

  it("maps unknown parser failures to a fixed public message", () => {
    expect(getFeedParseErrorForUi(new Error("secret parser state"))).toMatchObject({
      code: "INVALID_XML",
      message: "The feed could not be parsed.",
    });
  });
});
