import type {
  NotebookExportEnvelope,
  PersonName,
  ReferenceRecord,
} from "./types";

function personName(person: PersonName): string {
  if (person.literal) return person.literal;
  return [person.given, person.family].filter(Boolean).join(" ");
}

function bibtexValue(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}%&#_$])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}");
}

function citationKey(reference: ReferenceRecord): string {
  const author = reference.authors[0]?.family ?? reference.authors[0]?.literal ?? "source";
  const year = reference.publishedAt?.slice(0, 4) ?? "nd";
  const identity = reference.doi?.split("/").at(-1) ?? reference.id;
  return `${author}-${year}-${identity}`.replace(/[^a-zA-Z0-9:_-]+/g, "-").slice(0, 80);
}

export function referencesToBibtex(references: readonly ReferenceRecord[]): string {
  return references
    .map((reference) => {
      const entryType = reference.type === "article" || reference.type === "preprint" ? "article" : "misc";
      const fields: Array<[string, string | undefined]> = [
        ["title", reference.title],
        ["author", reference.authors.map(personName).filter(Boolean).join(" and ") || undefined],
        ["year", reference.publishedAt?.slice(0, 4)],
        ["doi", reference.doi],
        ["url", reference.canonicalUrl],
        ["publisher", reference.publisherOrInstitution],
        ["urldate", reference.retrievedAt.slice(0, 10)],
      ];
      const body = fields
        .filter((field): field is [string, string] => Boolean(field[1]))
        .map(([key, value]) => `  ${key} = {${bibtexValue(value)}}`)
        .join(",\n");
      return `@${entryType}{${citationKey(reference)},\n${body}\n}`;
    })
    .join("\n\n");
}

export function referencesToRis(references: readonly ReferenceRecord[]): string {
  return references
    .map((reference) => {
      const type = reference.type === "article" ? "JOUR" : reference.type === "preprint" ? "RPRT" : "GEN";
      const lines = [`TY  - ${type}`, `TI  - ${reference.title}`];
      for (const author of reference.authors) {
        const name = personName(author);
        if (name) lines.push(`AU  - ${name}`);
      }
      if (reference.publishedAt) lines.push(`PY  - ${reference.publishedAt.slice(0, 4)}`);
      if (reference.publisherOrInstitution) lines.push(`PB  - ${reference.publisherOrInstitution}`);
      if (reference.doi) lines.push(`DO  - ${reference.doi}`);
      lines.push(`UR  - ${reference.canonicalUrl}`);
      lines.push(`Y2  - ${reference.retrievedAt.slice(0, 10)}`);
      lines.push("ER  -");
      return lines.join("\n");
    })
    .join("\n\n");
}

export function notebookToMarkdown(envelope: NotebookExportEnvelope): string {
  const references = new Map(
    envelope.data.references.map((reference) => [reference.id, reference]),
  );
  const sections = envelope.data.notes.map((note) => {
    const linkedReferences = note.referenceIds
      .map((id) => references.get(id))
      .filter((reference): reference is ReferenceRecord => Boolean(reference));
    const referenceLines = linkedReferences.map(
      (reference, index) =>
        `${index + 1}. ${reference.authors.map(personName).filter(Boolean).join(", ")}${reference.authors.length ? ". " : ""}${reference.title}. ${reference.doi ? `https://doi.org/${reference.doi}` : reference.canonicalUrl}`,
    );
    return [
      `# ${note.title}`,
      "",
      `- Type: ${note.type}`,
      `- Updated: ${note.updatedAt}`,
      note.tags.length ? `- Tags: ${note.tags.join(", ")}` : undefined,
      "",
      note.markdown,
      referenceLines.length ? "\n## References\n" : undefined,
      ...referenceLines,
    ]
      .filter((line): line is string => line !== undefined)
      .join("\n");
  });
  return sections.join("\n\n---\n\n");
}
