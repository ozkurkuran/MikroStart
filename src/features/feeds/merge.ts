import { buildStableFeedItemId, identityAliases, stableHash } from "./identifiers";
import type {
  FeedIdentifiers,
  FeedSourceProvenance,
  NormalizedFeedItem,
  PersonName,
} from "./types";

function earliest(values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => Boolean(value)).sort()[0];
}

function latest(values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1);
}

function preferredText(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length || left.localeCompare(right))[0];
}

function preferredUrl(values: Array<string | undefined>): string | undefined {
  const score = (url: string): number =>
    /^https:\/\/(?:dx\.)?doi\.org\//i.test(url)
      ? 3
      : /^https:\/\/(?:www\.)?arxiv\.org\/abs\//i.test(url)
        ? 2
        : 1;
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => score(right) - score(left) || left.localeCompare(right))[0];
}

function mergeAuthors(items: NormalizedFeedItem[]): PersonName[] {
  const names = new Map<string, string>();
  for (const { name } of items.flatMap((item) => item.authors)) {
    const key = name.toLocaleLowerCase("en-US");
    const existing = names.get(key);
    if (!existing || name.length > existing.length) names.set(key, name);
  }
  return [...names.values()].sort((left, right) => left.localeCompare(right)).map((name) => ({ name }));
}

function mergeIdentifiers(items: NormalizedFeedItem[]): FeedIdentifiers {
  return {
    doi: earliest(items.map((item) => item.identifiers.doi)),
    arxiv: earliest(items.map((item) => item.identifiers.arxiv)),
  };
}

function mergeProvenance(items: NormalizedFeedItem[]): FeedSourceProvenance[] {
  const entries = new Map<string, FeedSourceProvenance>();
  for (const source of items.flatMap((item) => item.provenance.sources)) {
    const key = [
      source.sourceId,
      source.connectorId,
      source.feedUrl ?? "",
      source.itemUrl ?? "",
      source.externalId ?? "",
    ].join("\u001f");
    const existing = entries.get(key);
    if (!existing || source.retrievedAt > existing.retrievedAt) entries.set(key, source);
  }
  return [...entries.values()].sort((left, right) =>
    [left.sourceId, left.connectorId, left.itemUrl ?? ""].join("\u001f").localeCompare(
      [right.sourceId, right.connectorId, right.itemUrl ?? ""].join("\u001f"),
    ),
  );
}

function mergeGroup(items: NormalizedFeedItem[]): NormalizedFeedItem {
  const identifiers = mergeIdentifiers(items);
  const authors = mergeAuthors(items);
  const provenance = mergeProvenance(items);
  const canonicalUrl = preferredUrl(items.map((item) => item.canonicalUrl));
  const title = preferredText(items.map((item) => item.title)) ?? "Untitled item";
  const publishedAt = earliest(items.map((item) => item.publishedAt));
  const updatedAt = latest(items.map((item) => item.updatedAt));
  const retrievedAt = latest(items.map((item) => item.retrievedAt))!;
  const sourceDescription = preferredText(items.map((item) => item.sourceDescription));
  const language = earliest(items.map((item) => item.language));
  const primarySource = provenance[0] ?? {
    sourceId: items[0].sourceId,
    connectorId: items[0].connectorId,
    retrievedAt,
  };
  const id = buildStableFeedItemId({
    identifiers,
    canonicalUrl,
    connectorId: primarySource.connectorId,
    title,
    authors,
    publishedAt,
  });
  const contentHash = stableHash(
    JSON.stringify({
      title,
      authors: authors.map(({ name }) => name),
      canonicalUrl: canonicalUrl ?? "",
      publishedAt: publishedAt ?? "",
      updatedAt: updatedAt ?? "",
      sourceDescription: sourceDescription ?? "",
      identifiers,
    }),
  );

  return {
    id,
    sourceId: primarySource.sourceId,
    connectorId: primarySource.connectorId,
    ...(canonicalUrl ? { canonicalUrl } : {}),
    title,
    authors,
    ...(publishedAt ? { publishedAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    retrievedAt,
    identifiers,
    ...(sourceDescription ? { sourceDescription } : {}),
    ...(language ? { language } : {}),
    provenance: { sources: provenance },
    contentHash,
  };
}

/** Merges transitive DOI, arXiv, URL, and fallback-ID duplicates. */
export function mergeDuplicateFeedItems(items: NormalizedFeedItem[]): NormalizedFeedItem[] {
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
  };

  const aliasOwner = new Map<string, number>();
  items.forEach((item, index) => {
    const aliases = identityAliases({
      identifiers: item.identifiers,
      canonicalUrl: item.canonicalUrl,
      connectorId: item.connectorId,
      title: item.title,
      authors: item.authors,
      publishedAt: item.publishedAt,
    });
    for (const alias of aliases) {
      const owner = aliasOwner.get(alias);
      if (owner === undefined) aliasOwner.set(alias, index);
      else union(index, owner);
    }
  });

  const groups = new Map<number, NormalizedFeedItem[]>();
  items.forEach((item, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), item]);
  });

  return [...groups.values()]
    .map(mergeGroup)
    .sort((left, right) =>
      (right.publishedAt ?? right.updatedAt ?? "").localeCompare(
        left.publishedAt ?? left.updatedAt ?? "",
      ) || left.id.localeCompare(right.id),
    );
}
