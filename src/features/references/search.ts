import { CODATA_CONSTANTS } from "./codata";
import { E_SERIES } from "./e-series";
import { PERIODIC_ELEMENTS } from "./elements";
import type { ReferenceSearchResult } from "./types";

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreText(needle: string, primary: string, secondary: readonly string[]): number {
  if (needle === primary) return 120;
  if (secondary.includes(needle)) return 110;
  if (primary.startsWith(needle)) return 90;
  if (secondary.some((value) => value.startsWith(needle))) return 80;
  if (primary.includes(needle)) return 65;
  if (secondary.some((value) => value.includes(needle))) return 55;

  const tokens = needle.split(" ").filter(Boolean);
  const haystack = [primary, ...secondary].join(" ");
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token)) ? 35 : 0;
}

export interface SearchReferencesOptions {
  limit?: number;
  kinds?: readonly ReferenceSearchResult["kind"][];
}

export function searchReferences(
  query: string,
  options: SearchReferencesOptions = {},
): ReferenceSearchResult[] {
  const needle = normalize(query);
  const limit = Math.max(0, Math.min(options.limit ?? 20, 100));
  const kinds = new Set(options.kinds ?? ["constant", "element", "e-series"]);
  if (needle === "" || limit === 0) return [];

  const results: ReferenceSearchResult[] = [];

  if (kinds.has("constant")) {
    for (const item of CODATA_CONSTANTS) {
      const score = scoreText(needle, normalize(item.name), [
        normalize(item.symbol),
        normalize(item.id),
        ...item.aliases.map(normalize),
      ]);
      if (score > 0) results.push({ kind: "constant", score, item });
    }
  }

  if (kinds.has("element")) {
    for (const item of PERIODIC_ELEMENTS) {
      const score =
        needle === String(item.atomicNumber)
          ? 125
          : scoreText(needle, normalize(item.name), [
              normalize(item.symbol),
              normalize(item.category),
              `element ${item.atomicNumber}`,
              `atomic number ${item.atomicNumber}`,
            ]);
      if (score > 0) results.push({ kind: "element", score, item });
    }
  }

  if (kinds.has("e-series")) {
    for (const item of Object.values(E_SERIES)) {
      const score = scoreText(needle, normalize(item.name), [
        "resistor",
        "capacitor",
        "preferred value",
        `${item.nominalTolerancePercent} percent`,
      ]);
      if (score > 0) results.push({ kind: "e-series", score, item });
    }
  }

  return results
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const leftOrder = left.kind === "element" ? left.item.atomicNumber : 0;
      const rightOrder = right.kind === "element" ? right.item.atomicNumber : 0;
      return leftOrder - rightOrder;
    })
    .slice(0, limit);
}
