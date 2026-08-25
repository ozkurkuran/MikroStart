import {
  buildStableFeedItemId,
  normalizeDoi,
  stableHash,
} from "./identifiers";
import { mergeDuplicateFeedItems } from "./merge";
import {
  canonicalizeHttpsUrl,
  normalizeIsoDate,
  normalizeLanguage,
  toPlainText,
} from "./safety";
import type {
  FeedSourceProvenance,
  NormalizedFeedItem,
  PersonName,
} from "./types";

export const LITERATURE_PROVIDERS = ["arxiv", "crossref"] as const;
export type LiteratureProvider = (typeof LITERATURE_PROVIDERS)[number];
export type LiteratureSort = "newest" | "relevance";
export type LiteraturePageSize = 10 | 20 | 30 | 50;

export interface LiteratureStreamConfig {
  id: string;
  title: string;
  query: string;
  providers: LiteratureProvider[];
  blockedTerms: string[];
  sort: LiteratureSort;
  pageSize: LiteraturePageSize;
}

export const LITERATURE_PROVIDER_ENDPOINTS: Readonly<Record<LiteratureProvider, string>> = {
  arxiv: "https://export.arxiv.org/api/query",
  crossref: "https://api.crossref.org/works",
};

const PAGE_SIZES = new Set<LiteraturePageSize>([10, 20, 30, 50]);
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_CROSSREF_ITEMS = 100;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function firstText(value: unknown, limit: number): string {
  for (const candidate of asArray(value)) {
    const text = toPlainText(candidate, limit);
    if (text) return text;
  }
  return "";
}

function parseCrossrefAuthors(value: unknown): PersonName[] {
  const seen = new Set<string>();
  const authors: PersonName[] = [];
  for (const candidate of asArray(value).slice(0, 50)) {
    const record = asRecord(candidate);
    if (!record) continue;
    const name = toPlainText(
      [record.given, record.family].filter((part) => typeof part === "string").join(" ") || record.name,
      200,
    );
    const key = name.toLocaleLowerCase("en-US");
    if (name && !seen.has(key)) {
      seen.add(key);
      authors.push({ name });
    }
  }
  return authors;
}

function dateFromParts(value: unknown): string | undefined {
  const parts = asRecord(value)?.["date-parts"];
  const first = Array.isArray(parts) ? parts[0] : undefined;
  if (!Array.isArray(first)) return undefined;
  const [year, month = 1, day = 1] = first.map(Number);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return undefined;
  const date = new Date(Date.UTC(year, Math.max(1, Math.min(month, 12)) - 1, Math.max(1, Math.min(day, 31))));
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function crossrefDate(record: JsonRecord): string | undefined {
  for (const key of ["published-print", "published-online", "published", "issued"]) {
    const date = dateFromParts(record[key]);
    if (date) return date;
  }
  const timestamp = asRecord(record.created)?.["date-time"];
  return normalizeIsoDate(timestamp);
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function normalizeLiteratureStream(input: Partial<LiteratureStreamConfig>): LiteratureStreamConfig {
  const query = toPlainText(input.query, 240);
  if (query.length < 2) throw new Error("A literature query must contain at least two characters.");
  const id = toPlainText(input.id, 128);
  if (!id) throw new Error("The literature stream identifier is invalid.");
  const providers = [...new Set(asArray(input.providers).filter(
    (provider): provider is LiteratureProvider =>
      typeof provider === "string" && LITERATURE_PROVIDERS.includes(provider as LiteratureProvider),
  ))];
  if (providers.length === 0) throw new Error("Select at least one literature provider.");
  const blockedTerms = [...new Set(asArray(input.blockedTerms)
    .map((term) => toPlainText(term, 80))
    .filter(Boolean))].slice(0, 20);
  return {
    id,
    title: toPlainText(input.title, 100) || query,
    query,
    providers,
    blockedTerms,
    sort: input.sort === "relevance" ? "relevance" : "newest",
    pageSize: PAGE_SIZES.has(input.pageSize as LiteraturePageSize)
      ? input.pageSize as LiteraturePageSize
      : 20,
  };
}

function arxivSearchExpression(query: string): string {
  return query
    .split(/\s+/)
    .map((term) => term.replace(/["\\]/g, "").trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((term) => `all:${term}`)
    .join(" AND ");
}

export function buildLiteratureProviderUrl(
  provider: LiteratureProvider,
  stream: LiteratureStreamConfig,
): string {
  const endpoint = new URL(LITERATURE_PROVIDER_ENDPOINTS[provider]);
  if (provider === "arxiv") {
    endpoint.searchParams.set("search_query", arxivSearchExpression(stream.query));
    endpoint.searchParams.set("start", "0");
    endpoint.searchParams.set("max_results", String(stream.pageSize));
    endpoint.searchParams.set("sortBy", stream.sort === "newest" ? "submittedDate" : "relevance");
    endpoint.searchParams.set("sortOrder", "descending");
  } else {
    endpoint.searchParams.set("query.bibliographic", stream.query);
    endpoint.searchParams.set("rows", String(stream.pageSize));
    endpoint.searchParams.set("sort", stream.sort === "newest" ? "published" : "relevance");
    endpoint.searchParams.set("order", "desc");
    endpoint.searchParams.set(
      "select",
      "DOI,title,author,published,published-print,published-online,issued,created,URL,abstract,type",
    );
  }
  return endpoint.href;
}

export interface CrossrefParseOptions {
  sourceId: string;
  retrievedAt: string;
  requestUrl: string;
  maxItems?: number;
  maxInputBytes?: number;
}

export function parseCrossrefWorks(body: string, options: CrossrefParseOptions): NormalizedFeedItem[] {
  if (!body.trim()) throw new Error("The Crossref response is empty.");
  if (utf8ByteLength(body) > Math.min(options.maxInputBytes ?? MAX_JSON_BYTES, MAX_JSON_BYTES)) {
    throw new Error("The Crossref response is larger than the safety limit.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("The Crossref response is not valid JSON.");
  }
  const root = asRecord(parsed);
  const message = asRecord(root?.message);
  const rawItems = message?.items;
  if (!Array.isArray(rawItems)) throw new Error("The Crossref response does not contain works.");
  const maxItems = Math.max(1, Math.min(Math.trunc(options.maxItems ?? 50), MAX_CROSSREF_ITEMS));
  if (rawItems.length > maxItems) throw new Error("The Crossref response contains too many works.");

  const retrievedAt = normalizeIsoDate(options.retrievedAt) ?? new Date().toISOString();
  const requestUrl = canonicalizeHttpsUrl(options.requestUrl) ?? LITERATURE_PROVIDER_ENDPOINTS.crossref;
  return rawItems.flatMap((candidate) => {
    const record = asRecord(candidate);
    if (!record) return [];
    const doi = normalizeDoi(record.DOI);
    const title = firstText(record.title, 500) || "Untitled item";
    const authors = parseCrossrefAuthors(record.author);
    const canonicalUrl = doi
      ? `https://doi.org/${doi}`
      : canonicalizeHttpsUrl(typeof record.URL === "string" ? record.URL : undefined);
    const publishedAt = crossrefDate(record);
    const description = toPlainText(record.abstract, 4_000);
    const identifiers = { ...(doi ? { doi } : {}) };
    const connectorId = "crossref-api";
    const id = buildStableFeedItemId({ identifiers, canonicalUrl, connectorId, title, authors, publishedAt });
    const provenance: FeedSourceProvenance = {
      sourceId: options.sourceId,
      connectorId,
      retrievedAt,
      feedUrl: requestUrl,
      ...(canonicalUrl ? { itemUrl: canonicalUrl } : {}),
      ...(doi ? { externalId: doi } : {}),
    };
    return [{
      id,
      sourceId: options.sourceId,
      connectorId,
      ...(canonicalUrl ? { canonicalUrl } : {}),
      title,
      authors,
      ...(publishedAt ? { publishedAt } : {}),
      retrievedAt,
      identifiers,
      ...(description ? { sourceDescription: description } : {}),
      ...(normalizeLanguage(record.language) ? { language: normalizeLanguage(record.language) } : {}),
      provenance: { sources: [provenance] },
      contentHash: stableHash(JSON.stringify({ title, authors, publishedAt, doi, description })),
    } satisfies NormalizedFeedItem];
  });
}

function fold(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US");
}

function relevanceScore(item: NormalizedFeedItem, query: string): number {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  const title = fold(item.title);
  const body = fold([item.sourceDescription ?? "", ...item.authors.map((author) => author.name)].join(" "));
  let score = title.includes(fold(query)) ? 100 : 0;
  for (const term of terms) {
    if (title.includes(term)) score += 12;
    else if (body.includes(term)) score += 3;
  }
  return score;
}

export function filterAndRankLiteratureItems(
  items: NormalizedFeedItem[],
  stream: LiteratureStreamConfig,
): NormalizedFeedItem[] {
  const blocked = stream.blockedTerms.map(fold).filter(Boolean);
  const merged = mergeDuplicateFeedItems(items).filter((item) => {
    const haystack = fold([item.title, item.sourceDescription ?? "", ...item.authors.map((author) => author.name)].join(" "));
    return !blocked.some((term) => haystack.includes(term));
  });
  return merged.sort((left, right) => {
    if (stream.sort === "relevance") {
      const difference = relevanceScore(right, stream.query) - relevanceScore(left, stream.query);
      if (difference) return difference;
    }
    const leftDate = left.publishedAt ?? left.updatedAt ?? left.retrievedAt;
    const rightDate = right.publishedAt ?? right.updatedAt ?? right.retrievedAt;
    return rightDate.localeCompare(leftDate) || left.id.localeCompare(right.id);
  }).slice(0, stream.pageSize);
}
