export {
  ABSOLUTE_MAX_FEED_BYTES,
  ABSOLUTE_MAX_FEED_ITEMS,
  DEFAULT_MAX_FEED_BYTES,
  DEFAULT_MAX_FEED_ITEMS,
  detectFeedFormat,
  getFeedParseErrorForUi,
  isFeedParseError,
  parseFeed,
} from "./parser";
export {
  buildStableFeedItemId,
  extractArxivId,
  extractDoi,
  identityAliases,
  normalizeArxivId,
  normalizeDoi,
  stableHash,
} from "./identifiers";
export { mergeDuplicateFeedItems } from "./merge";
export {
  LITERATURE_PROVIDERS,
  LITERATURE_PROVIDER_ENDPOINTS,
  buildLiteratureProviderUrl,
  filterAndRankLiteratureItems,
  normalizeLiteratureStream,
  parseCrossrefWorks,
  type LiteraturePageSize,
  type LiteratureProvider,
  type LiteratureSort,
  type LiteratureStreamConfig,
} from "./literatureSearch";
export { canonicalizeHttpsUrl, normalizeIsoDate, normalizeLanguage, toPlainText } from "./safety";
export {
  FeedParseError,
  type FeedFormat,
  type FeedIdentifiers,
  type FeedParseErrorCode,
  type FeedParseOptions,
  type FeedParseResult,
  type FeedSourceProvenance,
  type NormalizedFeedItem,
  type PersonName,
  type SourceProvenance,
} from "./types";
