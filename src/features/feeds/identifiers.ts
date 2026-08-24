import type { FeedIdentifiers, PersonName } from "./types";
import { canonicalizeHttpsUrl, toPlainText } from "./safety";

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:a-z0-9]+/i;
const ARXIV_PATTERN = /(?:[a-z-]+(?:\.[a-z]{2})?\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?/i;

function safelyDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeDoi(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const decoded = safelyDecode(value.trim())
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  const match = decoded.match(DOI_PATTERN)?.[0];
  if (!match) return undefined;

  const normalized = match.replace(/[\s\])},.;:]+$/g, "").toLowerCase();
  return DOI_PATTERN.test(normalized) ? normalized : undefined;
}

export function extractDoi(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = normalizeDoi(value) ?? normalizeDoi(value.match(DOI_PATTERN)?.[0]);
    if (normalized) return normalized;
  }
  return undefined;
}

export function normalizeArxivId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const decoded = safelyDecode(value.trim())
    .replace(/^arxiv:\s*/i, "")
    .replace(/^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\//i, "")
    .replace(/\.pdf(?:\?.*)?$/i, "");
  const match = decoded.match(ARXIV_PATTERN)?.[0];
  if (!match) return undefined;
  return match.replace(/v\d+$/i, "").toLowerCase();
}

export function extractArxivId(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = normalizeArxivId(value) ?? normalizeArxivId(value.match(ARXIV_PATTERN)?.[0]);
    if (normalized) return normalized;
  }
  return undefined;
}

/** A small deterministic non-cryptographic hash used for local identity keys. */
export function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }

  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}

export interface StableIdInput {
  identifiers: FeedIdentifiers;
  canonicalUrl?: string;
  connectorId: string;
  title: string;
  authors: PersonName[];
  publishedAt?: string;
}

export function buildStableFeedItemId(input: StableIdInput): string {
  const doi = normalizeDoi(input.identifiers.doi);
  if (doi) return `doi:${doi}`;
  const arxiv = normalizeArxivId(input.identifiers.arxiv);
  if (arxiv) return `arxiv:${arxiv}`;

  const canonicalUrl = canonicalizeHttpsUrl(input.canonicalUrl);
  if (canonicalUrl) return `url:${stableHash(canonicalUrl)}`;

  const fallback = [
    toPlainText(input.connectorId, 200).toLowerCase(),
    toPlainText(input.title, 500).toLocaleLowerCase("en-US"),
    input.authors.map(({ name }) => toPlainText(name, 200).toLocaleLowerCase("en-US")).join("|"),
    input.publishedAt ?? "",
  ].join("\u001f");
  return `fallback:${stableHash(fallback)}`;
}

export function identityAliases(input: StableIdInput): string[] {
  const aliases: string[] = [];
  const doi = normalizeDoi(input.identifiers.doi);
  const arxiv = normalizeArxivId(input.identifiers.arxiv);
  if (doi) aliases.push(`doi:${doi}`);
  if (arxiv) aliases.push(`arxiv:${arxiv}`);
  const canonicalUrl = canonicalizeHttpsUrl(input.canonicalUrl);
  if (canonicalUrl) aliases.push(`url:${stableHash(canonicalUrl)}`);
  aliases.push(buildStableFeedItemId(input));
  return [...new Set(aliases)];
}
