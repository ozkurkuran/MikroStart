import { MODULE_IDS, type ModuleId } from "../platform/layoutPreferences";

/**
 * Module families. Each owns an accent so a board of seventeen cards stays
 * scannable: colour carries meaning here rather than decoration.
 */
export const MODULE_CATEGORIES = ["measure", "literature", "reference", "workflow", "record"] as const;

export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

export interface ModuleCategoryMeta {
  readonly id: ModuleCategory;
  readonly label: string;
  readonly accent: string;
}

export const CATEGORY_META: Readonly<Record<ModuleCategory, ModuleCategoryMeta>> = {
  measure: { id: "measure", label: "Hesaplama", accent: "var(--accent-measure)" },
  literature: { id: "literature", label: "Literatür", accent: "var(--accent-literature)" },
  reference: { id: "reference", label: "Referans", accent: "var(--accent-reference)" },
  workflow: { id: "workflow", label: "Akış", accent: "var(--accent-workflow)" },
  record: { id: "record", label: "Kayıt", accent: "var(--accent-record)" },
};

export interface ModuleMeta {
  readonly id: ModuleId;
  readonly title: string;
  readonly kind: string;
  readonly category: ModuleCategory;
  /** Extra terms matched by the workbench filter but not shown in the UI. */
  readonly keywords: readonly string[];
}

export const MODULE_CATALOG: Readonly<Record<ModuleId, ModuleMeta>> = {
  "bragg-spacing": {
    id: "bragg-spacing",
    title: "Bragg / d-aralığı",
    kind: "Kırınım",
    category: "measure",
    keywords: ["xrd", "difraksiyon", "d-spacing", "lattice", "düzlem"],
  },
  "scherrer-size": {
    id: "scherrer-size",
    title: "Scherrer kristalit boyutu",
    kind: "Kırınım",
    category: "measure",
    keywords: ["xrd", "fwhm", "tane", "crystallite", "genişleme"],
  },
  "sheet-resistance": {
    id: "sheet-resistance",
    title: "Yüzey direnci",
    kind: "Elektriksel",
    category: "measure",
    keywords: ["dört nokta", "four point", "probe", "özdirenç", "resistivity"],
  },
  "hall-measurement": {
    id: "hall-measurement",
    title: "Hall ölçümü",
    kind: "Taşınım",
    category: "measure",
    keywords: ["mobilite", "taşıyıcı", "carrier", "mobility", "manyetik"],
  },
  "vacuum-kinetics": {
    id: "vacuum-kinetics",
    title: "Vakum kinetiği",
    kind: "Vakum",
    category: "measure",
    keywords: ["ortalama serbest yol", "mean free path", "monolayer", "basınç"],
  },
  "research-feed": {
    id: "research-feed",
    title: "Araştırma akışı",
    kind: "Yayın akışı",
    category: "literature",
    keywords: ["rss", "atom", "arxiv", "makale", "feed", "doi"],
  },
  "on-device-ai": {
    id: "on-device-ai",
    title: "Cihaz içi yapay zekâ",
    kind: "Analiz",
    category: "literature",
    keywords: ["ai", "özet", "summarize", "digest", "rerank", "gemini nano"],
  },
  "translation-tools": {
    id: "translation-tools",
    title: "Çeviri",
    kind: "Dil aracı",
    category: "literature",
    keywords: ["translate", "çeviri", "dil", "language"],
  },
  "tureng-dictionary": {
    id: "tureng-dictionary",
    title: "Tureng sözlük",
    kind: "Dil aracı",
    category: "literature",
    keywords: ["sözlük", "dictionary", "terim", "tureng"],
  },
  "codata-constants": {
    id: "codata-constants",
    title: "CODATA sabitleri",
    kind: "Çevrimdışı veri",
    category: "reference",
    keywords: ["sabit", "constant", "planck", "boltzmann", "fizik"],
  },
  "periodic-table": {
    id: "periodic-table",
    title: "Periyodik tablo",
    kind: "Çevrimdışı veri",
    category: "reference",
    keywords: ["element", "atom", "kütle", "periodic", "sembol"],
  },
  "component-series": {
    id: "component-series",
    title: "Bileşen serileri",
    kind: "Çevrimdışı veri",
    category: "reference",
    keywords: ["e6", "e12", "e24", "direnç", "resistor", "iec"],
  },
  "countdown-timers": {
    id: "countdown-timers",
    title: "Geri sayım",
    kind: "Zamanlayıcı",
    category: "workflow",
    keywords: ["timer", "süre", "alarm", "fırın", "tavlama"],
  },
  stopwatch: {
    id: "stopwatch",
    title: "Kronometre",
    kind: "Zamanlayıcı",
    category: "workflow",
    keywords: ["stopwatch", "tur", "lap", "süre"],
  },
  "sample-id": {
    id: "sample-id",
    title: "Numune kimliği",
    kind: "Etiketleme",
    category: "workflow",
    keywords: ["sample", "id", "kod", "etiket", "barkod"],
  },
  "quick-note": {
    id: "quick-note",
    title: "Hızlı not",
    kind: "Yakalama",
    category: "workflow",
    keywords: ["not", "note", "kayıt", "zaman damgası"],
  },
  "lab-notebook": {
    id: "lab-notebook",
    title: "Laboratuvar defteri",
    kind: "Defter",
    category: "record",
    keywords: ["notebook", "defter", "kaynakça", "bibtex", "ris", "export"],
  },
};

/** Ordered catalog entries, useful for grouped rendering. */
export const MODULE_LIST: readonly ModuleMeta[] = MODULE_IDS.map((id) => MODULE_CATALOG[id]);

export function moduleAccent(id: ModuleId): string {
  return CATEGORY_META[MODULE_CATALOG[id].category].accent;
}

/** Card eyebrow text: the specific kind, then the family it belongs to. */
export function moduleEyebrow(id: ModuleId): string {
  const meta = MODULE_CATALOG[id];
  return `${meta.kind} · ${CATEGORY_META[meta.category].label}`;
}

/**
 * Case- and diacritic-insensitive match over the visible label plus hidden
 * keywords. Turkish dotted/dotless i is folded so "cihaz ici" finds "içi".
 */
export function matchesModuleQuery(meta: ModuleMeta, query: string): boolean {
  const needle = foldForSearch(query);
  if (!needle) return true;
  const haystack = foldForSearch(
    [meta.title, meta.kind, CATEGORY_META[meta.category].label, ...meta.keywords].join(" "),
  );
  return haystack.includes(needle);
}

function foldForSearch(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .trim();
}
