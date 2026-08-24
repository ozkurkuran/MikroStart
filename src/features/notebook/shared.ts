import {
  NOTEBOOK_EXPORT_FORMAT,
  NOTEBOOK_EXPORT_SCHEMA_VERSION,
  type FeedItemForNotebook,
  type NewNoteInput,
  type NoteRecord,
  type NoteUpdate,
  type NotebookExportData,
  type NotebookExportEnvelope,
  type ReferenceDraft,
  type ReferenceRecord,
  type SavedCalculationDraft,
  type SavedCalculationRecord,
  type SourceItemLink,
} from "./types";

export interface NotebookRuntime {
  now: () => string;
  createId: () => string;
}

const SENSITIVE_CALCULATION_KEY = /^(?:api[-_]?key|secret|password|access[-_]?token|refresh[-_]?token|authorization)$/i;
const UNSAFE_OBJECT_KEY = /^(?:__proto__|prototype|constructor)$/;

export const defaultNotebookRuntime: NotebookRuntime = {
  now: () => new Date().toISOString(),
  createId: () => globalThis.crypto.randomUUID(),
};

export function cloneRecord<T>(value: T): T {
  return structuredClone(value);
}

export function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function makeNote(
  input: NewNoteInput,
  runtime: NotebookRuntime,
): NoteRecord {
  const now = runtime.now();
  return {
    id: input.id ?? runtime.createId(),
    version: 1,
    type: input.type,
    title: input.title.trim(),
    markdown: input.markdown ?? "",
    createdAt: now,
    updatedAt: now,
    tags: uniqueStrings(input.tags ?? []),
    referenceIds: [],
    calculationRecordIds: [],
    sourceItemIds: [],
  };
}

export function applyNoteUpdate(
  note: NoteRecord,
  update: NoteUpdate,
  runtime: NotebookRuntime,
): NoteRecord {
  return {
    ...note,
    type: update.type ?? note.type,
    title: update.title === undefined ? note.title : update.title.trim(),
    markdown: update.markdown ?? note.markdown,
    tags: update.tags === undefined ? note.tags : uniqueStrings(update.tags),
    referenceIds:
      update.referenceIds === undefined
        ? note.referenceIds
        : uniqueStrings(update.referenceIds),
    calculationRecordIds:
      update.calculationRecordIds === undefined
        ? note.calculationRecordIds
        : uniqueStrings(update.calculationRecordIds),
    sourceItemIds:
      update.sourceItemIds === undefined
        ? note.sourceItemIds
        : uniqueStrings(update.sourceItemIds),
    version: note.version + 1,
    updatedAt: runtime.now(),
  };
}

export function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
}

export function normalizeCanonicalUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new TypeError(
      "Canonical references require HTTPS URLs without embedded credentials",
    );
  }
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (
    url.protocol === "https:" && url.port === "443"
  ) {
    url.port = "";
  }
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

export function referenceIdentity(reference: ReferenceDraft): string {
  if (reference.doi) {
    return `doi:${normalizeDoi(reference.doi)}`;
  }
  return `url:${normalizeCanonicalUrl(reference.canonicalUrl)}`;
}

export function makeReference(
  draft: ReferenceDraft,
  runtime: NotebookRuntime,
): ReferenceRecord {
  const canonicalUrl = normalizeCanonicalUrl(draft.canonicalUrl);
  return {
    ...cloneRecord(draft),
    id: draft.id ?? runtime.createId(),
    title: draft.title.trim(),
    canonicalUrl,
    doi: draft.doi ? normalizeDoi(draft.doi) : undefined,
    sourceSnapshot: {
      ...cloneRecord(draft.sourceSnapshot),
      title: draft.sourceSnapshot.title.trim(),
      canonicalUrl: normalizeCanonicalUrl(
        draft.sourceSnapshot.canonicalUrl,
      ),
    },
  };
}

export function referenceDraftFromFeedItem(
  item: FeedItemForNotebook,
): ReferenceDraft {
  return {
    type: item.referenceType ?? "article",
    title: item.title,
    authors: cloneRecord(item.authors),
    publisherOrInstitution: item.publisherOrInstitution,
    publishedAt: item.publishedAt,
    doi: item.doi,
    canonicalUrl: item.canonicalUrl,
    retrievedAt: item.retrievedAt,
    sourceSnapshot: {
      sourceId: item.sourceId,
      connectorId: item.connectorId,
      sourceItemId: item.id,
      title: item.title,
      canonicalUrl: item.canonicalUrl,
      retrievedAt: item.retrievedAt,
      contentHash: item.contentHash,
    },
  };
}

export function makeCalculation(
  draft: SavedCalculationDraft,
  runtime: NotebookRuntime,
): SavedCalculationRecord {
  assertExportSafeJson(draft.input);
  assertExportSafeJson(draft.output);
  return {
    ...cloneRecord(draft),
    id: draft.id ?? runtime.createId(),
    createdAt: draft.createdAt ?? runtime.now(),
  };
}

/** Prevents configuration secrets from being smuggled into exportable results. */
export function assertExportSafeJson(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): void {
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) {
    throw new TypeError("Calculation snapshots must not contain cycles");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => assertExportSafeJson(item, seen));
    seen.delete(value);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_CALCULATION_KEY.test(key)) {
      throw new TypeError(
        `Sensitive field cannot be stored in a calculation snapshot: ${key}`,
      );
    }
    if (UNSAFE_OBJECT_KEY.test(key)) {
      throw new TypeError(`Unsafe calculation field: ${key}`);
    }
    assertExportSafeJson(child, seen);
  }
  seen.delete(value);
}

export function sourceLinkId(noteId: string, sourceItemId: string): string {
  return `${encodeURIComponent(noteId)}::${encodeURIComponent(sourceItemId)}`;
}

export function makeSourceLink(
  noteId: string,
  sourceItemId: string,
  sourceId: string,
  referenceId: string,
  runtime: NotebookRuntime,
): SourceItemLink {
  return {
    id: sourceLinkId(noteId, sourceItemId),
    noteId,
    sourceItemId,
    sourceId,
    referenceId,
    createdAt: runtime.now(),
  };
}

export function makeExportEnvelope(
  data: NotebookExportData,
  runtime: NotebookRuntime,
  appVersion?: string,
): NotebookExportEnvelope {
  for (const calculation of data.calculations) {
    assertExportSafeJson(calculation.input);
    assertExportSafeJson(calculation.output);
  }
  return {
    format: NOTEBOOK_EXPORT_FORMAT,
    schemaVersion: NOTEBOOK_EXPORT_SCHEMA_VERSION,
    exportedAt: runtime.now(),
    ...(appVersion ? { appVersion } : {}),
    data: cloneRecord(data),
  };
}
