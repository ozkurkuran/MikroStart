import type { Translate } from "../platform/i18n";
import { MODULE_IDS, type ModuleId } from "../platform/layoutPreferences";

/**
 * Module families. Each owns an accent so a board of seventeen cards stays
 * scannable: colour carries meaning here rather than decoration.
 */
export const MODULE_CATEGORIES = ["measure", "literature", "reference", "workflow", "record"] as const;

export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

export const CATEGORY_ACCENT: Readonly<Record<ModuleCategory, string>> = {
  measure: "var(--accent-measure)",
  literature: "var(--accent-literature)",
  reference: "var(--accent-reference)",
  workflow: "var(--accent-workflow)",
  record: "var(--accent-record)",
};

export function categoryLabel(t: Translate, category: ModuleCategory): string {
  return t(`category.${category}`);
}

export interface ModuleMeta {
  readonly id: ModuleId;
  readonly category: ModuleCategory;
  /**
   * Extra terms matched by the workbench filter but never shown. Kept
   * untranslated on purpose: they exist so a Turkish user finds a module by
   * its English name and vice versa.
   */
  readonly keywords: readonly string[];
}

export const MODULE_CATALOG: Readonly<Record<ModuleId, ModuleMeta>> = {
  "bragg-spacing": {
    id: "bragg-spacing",
    category: "measure",
    keywords: ["xrd", "difraksiyon", "diffraction", "d-spacing", "d-aralığı", "lattice", "düzlem"],
  },
  "scherrer-size": {
    id: "scherrer-size",
    category: "measure",
    keywords: ["xrd", "fwhm", "tane", "grain", "crystallite", "kristalit", "genişleme"],
  },
  "sheet-resistance": {
    id: "sheet-resistance",
    category: "measure",
    keywords: ["dört nokta", "four point", "probe", "prob", "özdirenç", "resistivity"],
  },
  "hall-measurement": {
    id: "hall-measurement",
    category: "measure",
    keywords: ["mobilite", "mobility", "taşıyıcı", "carrier", "manyetik", "magnetic"],
  },
  "vacuum-kinetics": {
    id: "vacuum-kinetics",
    category: "measure",
    keywords: ["ortalama serbest yol", "mean free path", "monolayer", "tek tabaka", "basınç", "pressure"],
  },
  "research-feed": {
    id: "research-feed",
    category: "literature",
    keywords: ["rss", "atom", "arxiv", "makale", "paper", "feed", "akış", "doi"],
  },
  "on-device-ai": {
    id: "on-device-ai",
    category: "literature",
    keywords: ["ai", "yapay zeka", "özet", "summarize", "digest", "rerank", "gemini nano"],
  },
  "translation-tools": {
    id: "translation-tools",
    category: "literature",
    keywords: ["translate", "çeviri", "dil", "language"],
  },
  "tureng-dictionary": {
    id: "tureng-dictionary",
    category: "literature",
    keywords: ["sözlük", "dictionary", "terim", "term", "tureng"],
  },
  "codata-constants": {
    id: "codata-constants",
    category: "reference",
    keywords: ["sabit", "constant", "planck", "boltzmann", "fizik", "physics"],
  },
  "periodic-table": {
    id: "periodic-table",
    category: "reference",
    keywords: ["element", "atom", "kütle", "mass", "periodic", "periyodik", "sembol"],
  },
  "component-series": {
    id: "component-series",
    category: "reference",
    keywords: ["e6", "e12", "e24", "direnç", "resistor", "iec"],
  },
  "countdown-timers": {
    id: "countdown-timers",
    category: "workflow",
    keywords: ["timer", "süre", "alarm", "fırın", "furnace", "tavlama", "anneal"],
  },
  stopwatch: {
    id: "stopwatch",
    category: "workflow",
    keywords: ["stopwatch", "kronometre", "tur", "lap", "süre"],
  },
  "sample-id": {
    id: "sample-id",
    category: "workflow",
    keywords: ["sample", "numune", "id", "kod", "etiket", "label"],
  },
  "quick-note": {
    id: "quick-note",
    category: "workflow",
    keywords: ["not", "note", "kayıt", "zaman damgası", "timestamp"],
  },
  "lab-notebook": {
    id: "lab-notebook",
    category: "record",
    keywords: ["notebook", "defter", "kaynakça", "bibtex", "ris", "export", "dışa aktar"],
  },
};

export function moduleAccent(id: ModuleId): string {
  return CATEGORY_ACCENT[MODULE_CATALOG[id].category];
}

export function moduleTitle(t: Translate, id: ModuleId): string {
  return t(`module.${id}.title`);
}

export function moduleKind(t: Translate, id: ModuleId): string {
  return t(`module.${id}.kind`);
}

/** Card eyebrow text: the specific kind, then the family it belongs to. */
export function moduleEyebrow(t: Translate, id: ModuleId): string {
  return `${moduleKind(t, id)} · ${categoryLabel(t, MODULE_CATALOG[id].category)}`;
}

/**
 * Case- and diacritic-insensitive match over the translated label plus the
 * hidden keywords. Turkish dotted/dotless i is folded so "cihaz ici" finds
 * "içi", and the keyword list keeps cross-language lookups working.
 */
export function matchesModuleQuery(t: Translate, id: ModuleId, query: string): boolean {
  const needle = foldForSearch(query);
  if (!needle) return true;
  const meta = MODULE_CATALOG[id];
  const haystack = foldForSearch(
    [
      moduleTitle(t, id),
      moduleKind(t, id),
      categoryLabel(t, meta.category),
      ...meta.keywords,
    ].join(" "),
  );
  return haystack.includes(needle);
}

function foldForSearch(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .trim();
}

/** Ordered catalog entries, useful for grouped rendering. */
export const MODULE_LIST: readonly ModuleMeta[] = MODULE_IDS.map((id) => MODULE_CATALOG[id]);
