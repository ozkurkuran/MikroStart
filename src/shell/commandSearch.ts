export type CommandResultKind = "action" | "module" | "note" | "source";

export interface CommandSearchRecord {
  id: string;
  kind: CommandResultKind;
  title: string;
  subtitle?: string;
  keywords?: readonly string[];
}

function fold(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .trim();
}

function score(record: CommandSearchRecord, query: string): number {
  const title = fold(record.title);
  const subtitle = fold(record.subtitle ?? "");
  const keywords = fold(record.keywords?.join(" ") ?? "");
  if (!query) return record.kind === "action" ? 30 : record.kind === "module" ? 20 : 10;
  if (title === query) return 120;
  if (title.startsWith(query)) return 100;
  if (title.includes(query)) return 80;
  if (subtitle.includes(query)) return 50;
  if (keywords.includes(query)) return 40;
  const terms = query.split(/\s+/).filter(Boolean);
  const haystack = `${title} ${subtitle} ${keywords}`;
  return terms.every((term) => haystack.includes(term)) ? 30 + terms.length : -1;
}

export function searchCommands(
  records: readonly CommandSearchRecord[],
  query: string,
  limit = 12,
): CommandSearchRecord[] {
  const needle = fold(query);
  return records
    .map((record, index) => ({ record, index, score: score(record, needle) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, limit))
    .map(({ record }) => record);
}
