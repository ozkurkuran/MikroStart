export const NOTEBOOK_EXPORT_FORMAT = "benchtab-notebook-export" as const;
export const NOTEBOOK_EXPORT_SCHEMA_VERSION = 1 as const;

export type NoteType =
  | "free"
  | "literature"
  | "experiment"
  | "sample"
  | "calculation"
  | "funding";

export type ReferenceType =
  | "article"
  | "preprint"
  | "announcement"
  | "dataset"
  | "web-page";

export interface PersonName {
  given?: string;
  family?: string;
  literal?: string;
}

export interface SourceSnapshot {
  sourceId: string;
  connectorId?: string;
  sourceItemId?: string;
  title: string;
  canonicalUrl: string;
  retrievedAt: string;
  contentHash?: string;
}

export interface ReferenceRecord {
  id: string;
  type: ReferenceType;
  title: string;
  authors: PersonName[];
  publisherOrInstitution?: string;
  publishedAt?: string;
  doi?: string;
  canonicalUrl: string;
  retrievedAt: string;
  sourceSnapshot: SourceSnapshot;
}

export interface NoteRecord {
  id: string;
  version: number;
  type: NoteType;
  title: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  referenceIds: string[];
  calculationRecordIds: string[];
  sourceItemIds: string[];
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

/** A frozen result snapshot. Calculator code is not stored or evaluated. */
export interface SavedCalculationRecord {
  id: string;
  calculatorId: string;
  calculatorVersion: string;
  createdAt: string;
  label?: string;
  input: JsonValue;
  output: JsonValue;
}

/** A local provenance edge between a normalized source item and a note. */
export interface SourceItemLink {
  id: string;
  noteId: string;
  sourceItemId: string;
  sourceId: string;
  referenceId: string;
  createdAt: string;
}

export interface NotebookExportData {
  notes: NoteRecord[];
  references: ReferenceRecord[];
  calculations: SavedCalculationRecord[];
  sourceLinks: SourceItemLink[];
}

export interface NotebookExportEnvelope {
  format: typeof NOTEBOOK_EXPORT_FORMAT;
  schemaVersion: typeof NOTEBOOK_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  appVersion?: string;
  data: NotebookExportData;
}

export interface NewNoteInput {
  id?: string;
  type: NoteType;
  title: string;
  markdown?: string;
  tags?: string[];
}

export interface NoteUpdate {
  type?: NoteType;
  title?: string;
  markdown?: string;
  tags?: string[];
  referenceIds?: string[];
  calculationRecordIds?: string[];
  sourceItemIds?: string[];
}

export type ReferenceDraft = Omit<ReferenceRecord, "id"> & { id?: string };

export type SavedCalculationDraft = Omit<
  SavedCalculationRecord,
  "id" | "createdAt"
> & {
  id?: string;
  createdAt?: string;
};

export interface FeedItemForNotebook {
  id: string;
  sourceId: string;
  connectorId?: string;
  canonicalUrl: string;
  title: string;
  authors: PersonName[];
  publishedAt?: string;
  retrievedAt: string;
  doi?: string;
  publisherOrInstitution?: string;
  contentHash?: string;
  referenceType?: ReferenceType;
}

export interface SaveFeedItemToNoteInput {
  item: FeedItemForNotebook;
  noteId?: string;
  newNote?: {
    id?: string;
    title?: string;
    markdown?: string;
    tags?: string[];
  };
}

export interface SaveFeedItemToNoteResult {
  note: NoteRecord;
  reference: ReferenceRecord;
  sourceLink: SourceItemLink;
  referenceCreated: boolean;
  noteCreated: boolean;
}

export interface NotebookExportConflictIndex {
  noteIds?: ReadonlySet<string>;
  referenceIds?: ReadonlySet<string>;
  calculationIds?: ReadonlySet<string>;
  sourceLinkIds?: ReadonlySet<string>;
}

export type NotebookEntityName =
  | "envelope"
  | "note"
  | "reference"
  | "calculation"
  | "sourceLink";

export interface ImportIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export interface ImportConflict {
  entity: Exclude<NotebookEntityName, "envelope">;
  id: string;
  reason: "duplicate-in-import" | "already-exists";
}

export interface NotebookImportPreview {
  valid: boolean;
  schemaVersion?: number;
  counts: {
    notes: number;
    references: number;
    calculations: number;
    sourceLinks: number;
  };
  issues: ImportIssue[];
  conflicts: ImportConflict[];
  /** Present only after complete validation; contains allow-listed fields only. */
  envelope?: NotebookExportEnvelope;
}

export interface NotebookImportResult {
  notes: number;
  references: number;
  calculations: number;
  sourceLinks: number;
}
