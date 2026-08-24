export type FeedFormat = "rss2" | "atom";

export interface PersonName {
  name: string;
}

export interface FeedIdentifiers {
  doi?: string;
  arxiv?: string;
}

export interface FeedSourceProvenance {
  sourceId: string;
  connectorId: string;
  retrievedAt: string;
  feedUrl?: string;
  itemUrl?: string;
  externalId?: string;
}

export interface SourceProvenance {
  sources: FeedSourceProvenance[];
}

export interface NormalizedFeedItem {
  id: string;
  sourceId: string;
  connectorId: string;
  canonicalUrl?: string;
  title: string;
  authors: PersonName[];
  publishedAt?: string;
  updatedAt?: string;
  retrievedAt: string;
  identifiers: FeedIdentifiers;
  sourceDescription?: string;
  language?: string;
  provenance: SourceProvenance;
  contentHash: string;
}

export interface FeedParseOptions {
  sourceId: string;
  connectorId: string;
  retrievedAt?: string;
  feedUrl?: string;
  maxInputBytes?: number;
  maxItems?: number;
}

export interface FeedParseResult {
  format: FeedFormat;
  title?: string;
  homePageUrl?: string;
  items: NormalizedFeedItem[];
}

export type FeedParseErrorCode =
  | "EMPTY_INPUT"
  | "INPUT_TOO_LARGE"
  | "TOO_MANY_ITEMS"
  | "UNSAFE_XML"
  | "INVALID_XML"
  | "UNSUPPORTED_FORMAT";

/**
 * An error whose message is deliberately safe to display in the extension UI.
 * Parser internals and excerpts from untrusted input are never included.
 */
export class FeedParseError extends Error {
  readonly name = "FeedParseError";

  constructor(
    readonly code: FeedParseErrorCode,
    message: string,
  ) {
    super(message);
  }
}
