import type {
  NewNoteInput,
  NoteRecord,
  NoteUpdate,
  NotebookExportEnvelope,
  NotebookImportResult,
  ReferenceDraft,
  ReferenceRecord,
  SaveFeedItemToNoteInput,
  SaveFeedItemToNoteResult,
  SavedCalculationDraft,
  SavedCalculationRecord,
  SourceItemLink,
} from "./types";

export interface NoteListOptions {
  limit?: number;
  updatedBefore?: string;
}

export interface NotebookRepository {
  createNote(input: NewNoteInput): Promise<NoteRecord>;
  updateNote(
    id: string,
    update: NoteUpdate,
    expectedVersion?: number,
  ): Promise<NoteRecord>;
  getNote(id: string): Promise<NoteRecord | undefined>;
  listNotes(options?: NoteListOptions): Promise<NoteRecord[]>;
  deleteNote(id: string): Promise<boolean>;

  createOrReuseReference(
    draft: ReferenceDraft,
  ): Promise<{ reference: ReferenceRecord; created: boolean }>;
  getReference(id: string): Promise<ReferenceRecord | undefined>;
  listReferences(): Promise<ReferenceRecord[]>;

  saveCalculation(draft: SavedCalculationDraft): Promise<SavedCalculationRecord>;
  listCalculations(): Promise<SavedCalculationRecord[]>;
  listSourceLinks(): Promise<SourceItemLink[]>;

  saveFeedItemToNote(
    input: SaveFeedItemToNoteInput,
  ): Promise<SaveFeedItemToNoteResult>;
  exportData(appVersion?: string): Promise<NotebookExportEnvelope>;
  importData(input: string | unknown): Promise<NotebookImportResult>;
  deleteAllData(): Promise<void>;
}

export class NotebookNotFoundError extends Error {
  public constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "NotebookNotFoundError";
  }
}

export class NotebookConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "NotebookConflictError";
  }
}
