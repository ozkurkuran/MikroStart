import { XMLParser, XMLValidator } from "fast-xml-parser";

import { buildStableFeedItemId, extractArxivId, extractDoi, stableHash } from "./identifiers";
import { canonicalizeHttpsUrl, normalizeIsoDate, normalizeLanguage, toPlainText } from "./safety";
import {
  FeedParseError,
  type FeedFormat,
  type FeedParseOptions,
  type FeedParseResult,
  type FeedSourceProvenance,
  type NormalizedFeedItem,
  type PersonName,
} from "./types";

export const DEFAULT_MAX_FEED_BYTES = 2 * 1024 * 1024;
export const DEFAULT_MAX_FEED_ITEMS = 200;
export const ABSOLUTE_MAX_FEED_BYTES = 5 * 1024 * 1024;
export const ABSOLUTE_MAX_FEED_ITEMS = 500;

type XmlRecord = Record<string, unknown>;

const parser = new XMLParser({
  allowBooleanAttributes: false,
  attributeNamePrefix: "@",
  cdataPropName: "#text",
  htmlEntities: false,
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  preserveOrder: false,
  processEntities: false,
  removeNSPrefix: true,
  textNodeName: "#text",
  trimValues: false,
});

function asRecord(value: unknown): XmlRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as XmlRecord)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function xmlText(value: unknown, depth = 0): string {
  if (depth > 8) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => xmlText(item, depth + 1)).join(" ");

  const record = asRecord(value);
  if (!record) return "";
  return Object.entries(record)
    .filter(([key]) => !key.startsWith("@"))
    .map(([, item]) => xmlText(item, depth + 1))
    .join(" ");
}

function getText(record: XmlRecord, keys: string[], limit: number): string {
  for (const key of keys) {
    const text = toPlainText(xmlText(record[key]), limit);
    if (text) return text;
  }
  return "";
}

function getRawText(record: XmlRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const text = xmlText(record[key]).trim();
    if (text) return text;
  }
  return undefined;
}

function textAttribute(record: XmlRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return undefined;
}

function pickSafeLink(value: unknown, baseUrl?: string): string | undefined {
  const candidates = asArray(value);
  const preferred = candidates.filter((candidate) => {
    const record = asRecord(candidate);
    const relation = record ? textAttribute(record, "@rel", "rel") : undefined;
    return !relation || relation.toLowerCase() === "alternate";
  });

  for (const candidate of [...preferred, ...candidates]) {
    const record = asRecord(candidate);
    const raw = record
      ? textAttribute(record, "@href", "href") ?? xmlText(record["#text"])
      : xmlText(candidate);
    const url = canonicalizeHttpsUrl(raw, baseUrl);
    if (url) return url;
  }

  return undefined;
}

function normalizeAuthors(...values: unknown[]): PersonName[] {
  const seen = new Set<string>();
  const authors: PersonName[] = [];

  for (const candidate of values.flatMap(asArray)) {
    const record = asRecord(candidate);
    const raw = record ? getRawText(record, ["name", "#text"]) : xmlText(candidate);
    const name = toPlainText(raw, 200);
    const key = name.toLocaleLowerCase("en-US");
    if (name && !seen.has(key) && authors.length < 50) {
      seen.add(key);
      authors.push({ name });
    }
  }

  return authors;
}

function boundedInteger(value: number | undefined, fallback: number, ceiling: number): number {
  return Number.isFinite(value)
    ? Math.max(1, Math.min(Math.trunc(value!), ceiling))
    : fallback;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function countEntryTags(xml: string, stopAfter: number): number {
  const pattern = /<(?:[a-z_][\w.-]*:)?(?:item|entry)(?:\s|>)/gi;
  let count = 0;
  while (pattern.exec(xml)) {
    count += 1;
    if (count > stopAfter) break;
  }
  return count;
}

function validateInput(xml: string, maxInputBytes: number, maxItems: number): void {
  if (!xml.trim()) {
    throw new FeedParseError("EMPTY_INPUT", "The feed is empty.");
  }
  if (utf8ByteLength(xml) > maxInputBytes) {
    throw new FeedParseError("INPUT_TOO_LARGE", "The feed is larger than the configured safety limit.");
  }
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) {
    throw new FeedParseError("UNSAFE_XML", "The feed uses an unsupported XML declaration.");
  }
  if (countEntryTags(xml, maxItems) > maxItems) {
    throw new FeedParseError("TOO_MANY_ITEMS", "The feed contains more items than the configured safety limit.");
  }

  let validation: true | object;
  try {
    validation = XMLValidator.validate(xml, { allowBooleanAttributes: false }) as true | object;
  } catch {
    validation = {};
  }
  if (validation !== true) {
    throw new FeedParseError("INVALID_XML", "The feed is not valid XML.");
  }
}

interface ItemFields {
  title: string;
  description?: string;
  authors: PersonName[];
  publishedAt?: string;
  updatedAt?: string;
  link?: string;
  externalId?: string;
  language?: string;
  identifierCandidates: string[];
}

function createItem(fields: ItemFields, options: RequiredPick): NormalizedFeedItem {
  const identifiers = {
    doi: extractDoi(...fields.identifierCandidates, fields.link, fields.title, fields.description),
    arxiv: extractArxivId(...fields.identifierCandidates, fields.link),
  };
  const stableInput = {
    identifiers,
    canonicalUrl: fields.link,
    connectorId: options.connectorId,
    title: fields.title,
    authors: fields.authors,
    publishedAt: fields.publishedAt,
  };
  const provenanceEntry: FeedSourceProvenance = {
    sourceId: options.sourceId,
    connectorId: options.connectorId,
    retrievedAt: options.retrievedAt,
    ...(options.feedUrl ? { feedUrl: options.feedUrl } : {}),
    ...(fields.link ? { itemUrl: fields.link } : {}),
    ...(fields.externalId ? { externalId: toPlainText(fields.externalId, 1_000) } : {}),
  };
  const contentHash = stableHash(
    JSON.stringify({
      title: fields.title,
      authors: fields.authors.map(({ name }) => name),
      description: fields.description ?? "",
      link: fields.link ?? "",
      publishedAt: fields.publishedAt ?? "",
      updatedAt: fields.updatedAt ?? "",
      identifiers,
    }),
  );

  return {
    id: buildStableFeedItemId(stableInput),
    sourceId: options.sourceId,
    connectorId: options.connectorId,
    ...(fields.link ? { canonicalUrl: fields.link } : {}),
    title: fields.title || "Untitled item",
    authors: fields.authors,
    ...(fields.publishedAt ? { publishedAt: fields.publishedAt } : {}),
    ...(fields.updatedAt ? { updatedAt: fields.updatedAt } : {}),
    retrievedAt: options.retrievedAt,
    identifiers,
    ...(fields.description ? { sourceDescription: fields.description } : {}),
    ...(fields.language ? { language: fields.language } : {}),
    provenance: { sources: [provenanceEntry] },
    contentHash,
  };
}

interface RequiredPick {
  sourceId: string;
  connectorId: string;
  retrievedAt: string;
  feedUrl?: string;
}

function parseRss(root: XmlRecord, options: RequiredPick, maxItems: number): FeedParseResult {
  const channel = asRecord(root.channel);
  if (!channel) {
    throw new FeedParseError("INVALID_XML", "The RSS feed does not contain a channel.");
  }

  const homePageUrl = pickSafeLink(channel.link, options.feedUrl);
  const language = normalizeLanguage(getRawText(channel, ["language"]));
  const rawItems = asArray(channel.item);
  if (rawItems.length > maxItems) {
    throw new FeedParseError("TOO_MANY_ITEMS", "The feed contains more items than the configured safety limit.");
  }

  const items = rawItems.flatMap((candidate) => {
    const item = asRecord(candidate);
    if (!item) return [];
    const title = getText(item, ["title"], 500);
    const description = getText(item, ["description", "encoded", "summary", "content"], 4_000);
    const externalId = getRawText(item, ["guid", "id"]);
    const link = pickSafeLink(item.link, options.feedUrl ?? homePageUrl);

    return [
      createItem(
        {
          title,
          ...(description ? { description } : {}),
          authors: normalizeAuthors(item.creator, item.author),
          publishedAt: normalizeIsoDate(getRawText(item, ["pubDate", "published", "date"])),
          updatedAt: normalizeIsoDate(getRawText(item, ["updated", "modified"])),
          ...(link ? { link } : {}),
          ...(externalId ? { externalId } : {}),
          ...(language ? { language } : {}),
          identifierCandidates: [
            getRawText(item, ["doi", "identifier"]) ?? "",
            externalId ?? "",
          ],
        },
        options,
      ),
    ];
  });

  return {
    format: "rss2",
    title: getText(channel, ["title"], 500) || undefined,
    ...(homePageUrl ? { homePageUrl } : {}),
    items,
  };
}

function parseAtom(root: XmlRecord, options: RequiredPick, maxItems: number): FeedParseResult {
  const homePageUrl = pickSafeLink(root.link, options.feedUrl);
  const feedLanguage = normalizeLanguage(textAttribute(root, "@lang", "@xml:lang"));
  const rawEntries = asArray(root.entry);
  if (rawEntries.length > maxItems) {
    throw new FeedParseError("TOO_MANY_ITEMS", "The feed contains more items than the configured safety limit.");
  }

  const items = rawEntries.flatMap((candidate) => {
    const entry = asRecord(candidate);
    if (!entry) return [];
    const title = getText(entry, ["title"], 500);
    const description = getText(entry, ["summary", "content"], 4_000);
    const externalId = getRawText(entry, ["id"]);
    const link = pickSafeLink(entry.link, options.feedUrl ?? homePageUrl);

    return [
      createItem(
        {
          title,
          ...(description ? { description } : {}),
          authors: normalizeAuthors(entry.author, entry.contributor),
          publishedAt: normalizeIsoDate(getRawText(entry, ["published", "issued", "created"])),
          updatedAt: normalizeIsoDate(getRawText(entry, ["updated", "modified"])),
          ...(link ? { link } : {}),
          ...(externalId ? { externalId } : {}),
          language: normalizeLanguage(textAttribute(entry, "@lang", "@xml:lang")) ?? feedLanguage,
          identifierCandidates: [
            getRawText(entry, ["doi", "identifier"]) ?? "",
            externalId ?? "",
          ],
        },
        options,
      ),
    ];
  });

  return {
    format: "atom",
    title: getText(root, ["title"], 500) || undefined,
    ...(homePageUrl ? { homePageUrl } : {}),
    items,
  };
}

export function parseFeed(xml: string, options: FeedParseOptions): FeedParseResult {
  const maxInputBytes = boundedInteger(
    options.maxInputBytes,
    DEFAULT_MAX_FEED_BYTES,
    ABSOLUTE_MAX_FEED_BYTES,
  );
  const maxItems = boundedInteger(options.maxItems, DEFAULT_MAX_FEED_ITEMS, ABSOLUTE_MAX_FEED_ITEMS);
  validateInput(xml, maxInputBytes, maxItems);

  const required: RequiredPick = {
    sourceId: toPlainText(options.sourceId, 200) || "unknown-source",
    connectorId: toPlainText(options.connectorId, 200) || "rss-atom",
    retrievedAt: normalizeIsoDate(options.retrievedAt) ?? new Date().toISOString(),
    ...(canonicalizeHttpsUrl(options.feedUrl) ? { feedUrl: canonicalizeHttpsUrl(options.feedUrl) } : {}),
  };

  let document: XmlRecord;
  try {
    document = parser.parse(xml) as XmlRecord;
  } catch {
    throw new FeedParseError("INVALID_XML", "The feed could not be parsed.");
  }

  const rss = asRecord(document.rss);
  if (rss) return parseRss(rss, required, maxItems);
  const atom = asRecord(document.feed);
  if (atom) return parseAtom(atom, required, maxItems);

  throw new FeedParseError("UNSUPPORTED_FORMAT", "Only RSS 2.0 and Atom feeds are supported.");
}

export function isFeedParseError(error: unknown): error is FeedParseError {
  return error instanceof FeedParseError;
}

export function getFeedParseErrorForUi(error: unknown): FeedParseError {
  return isFeedParseError(error)
    ? error
    : new FeedParseError("INVALID_XML", "The feed could not be parsed.");
}

export function detectFeedFormat(xml: string): FeedFormat | undefined {
  const prefix = xml.slice(0, 2_048);
  if (/<(?:[a-z_][\w.-]*:)?rss(?:\s|>)/i.test(prefix)) return "rss2";
  if (/<(?:[a-z_][\w.-]*:)?feed(?:\s|>)/i.test(prefix)) return "atom";
  return undefined;
}
