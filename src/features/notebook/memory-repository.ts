import {
  NotebookConflictError,
  NotebookNotFoundError,
  type NotebookRepository,
  type NoteListOptions,
} from "./repository";
import {
  applyNoteUpdate,
  cloneRecord,
  defaultNotebookRuntime,
  makeCalculation,
  makeExportEnvelope,
  makeNote,
  makeReference,
  makeSourceLink,
  referenceDraftFromFeedItem,
  referenceIdentity,
  sourceLinkId,
  uniqueStrings,
  type NotebookRuntime,
} from "./shared";
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
import {
  NotebookImportValidationError,
  previewNotebookImport,
} from "./validation";

/** Deterministic, dependency-free repository for unit tests and degraded storage. */
export class MemoryNotebookRepository implements NotebookRepository {
  readonly #notes = new Map<string, NoteRecord>();
  readonly #references = new Map<string, ReferenceRecord>();
  readonly #referenceIdentityToId = new Map<string, string>();
  readonly #calculations = new Map<string, SavedCalculationRecord>();
  readonly #sourceLinks = new Map<string, SourceItemLink>();
  readonly #runtime: NotebookRuntime;

  public constructor(runtime: NotebookRuntime = defaultNotebookRuntime) {
    this.#runtime = runtime;
  }

  public async createNote(input: NewNoteInput): Promise<NoteRecord> {
    const note = makeNote(input, this.#runtime);
    if (this.#notes.has(note.id)) {
      throw new NotebookConflictError(`Note already exists: ${note.id}`);
    }
    this.#notes.set(note.id, cloneRecord(note));
    return cloneRecord(note);
  }

  public async updateNote(
    id: string,
    update: NoteUpdate,
    expectedVersion?: number,
  ): Promise<NoteRecord> {
    const current = this.#notes.get(id);
    if (!current) {
      throw new NotebookNotFoundError("Note", id);
    }
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new NotebookConflictError(
        `Note ${id} is version ${current.version}, expected ${expectedVersion}`,
      );
    }
    const next = applyNoteUpdate(current, update, this.#runtime);
    this.#notes.set(id, cloneRecord(next));
    return cloneRecord(next);
  }

  public async getNote(id: string): Promise<NoteRecord | undefined> {
    const note = this.#notes.get(id);
    return note ? cloneRecord(note) : undefined;
  }

  public async listNotes(options: NoteListOptions = {}): Promise<NoteRecord[]> {
    const limit = Math.max(0, options.limit ?? Number.POSITIVE_INFINITY);
    return [...this.#notes.values()]
      .filter(
        (note) =>
          options.updatedBefore === undefined ||
          note.updatedAt < options.updatedBefore,
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit)
      .map(cloneRecord);
  }

  public async deleteNote(id: string): Promise<boolean> {
    if (!this.#notes.delete(id)) {
      return false;
    }
    for (const [linkId, link] of this.#sourceLinks) {
      if (link.noteId === id) {
        this.#sourceLinks.delete(linkId);
      }
    }
    return true;
  }

  public async createOrReuseReference(
    draft: ReferenceDraft,
  ): Promise<{ reference: ReferenceRecord; created: boolean }> {
    const identity = referenceIdentity(draft);
    const existingId = this.#referenceIdentityToId.get(identity);
    if (existingId) {
      const existing = this.#references.get(existingId);
      if (existing) {
        return { reference: cloneRecord(existing), created: false };
      }
    }

    const reference = makeReference(draft, this.#runtime);
    if (this.#references.has(reference.id)) {
      throw new NotebookConflictError(
        `Reference ID already exists: ${reference.id}`,
      );
    }
    this.#references.set(reference.id, cloneRecord(reference));
    this.#referenceIdentityToId.set(identity, reference.id);
    return { reference: cloneRecord(reference), created: true };
  }

  public async getReference(id: string): Promise<ReferenceRecord | undefined> {
    const reference = this.#references.get(id);
    return reference ? cloneRecord(reference) : undefined;
  }

  public async listReferences(): Promise<ReferenceRecord[]> {
    return [...this.#references.values()].map(cloneRecord);
  }

  public async saveCalculation(
    draft: SavedCalculationDraft,
  ): Promise<SavedCalculationRecord> {
    const calculation = makeCalculation(draft, this.#runtime);
    if (this.#calculations.has(calculation.id)) {
      throw new NotebookConflictError(
        `Calculation already exists: ${calculation.id}`,
      );
    }
    this.#calculations.set(calculation.id, cloneRecord(calculation));
    return cloneRecord(calculation);
  }

  public async listCalculations(): Promise<SavedCalculationRecord[]> {
    return [...this.#calculations.values()].map(cloneRecord);
  }

  public async listSourceLinks(): Promise<SourceItemLink[]> {
    return [...this.#sourceLinks.values()].map(cloneRecord);
  }

  public async saveFeedItemToNote(
    input: SaveFeedItemToNoteInput,
  ): Promise<SaveFeedItemToNoteResult> {
    if (input.noteId && input.newNote) {
      throw new NotebookConflictError(
        "Provide noteId or newNote, not both",
      );
    }

    let noteCreated = false;
    let note: NoteRecord;
    if (input.noteId) {
      const existing = this.#notes.get(input.noteId);
      if (!existing) {
        throw new NotebookNotFoundError("Note", input.noteId);
      }
      note = existing;
    } else {
      note = makeNote(
        {
          id: input.newNote?.id,
          type: "literature",
          title: input.newNote?.title ?? input.item.title,
          markdown: input.newNote?.markdown,
          tags: input.newNote?.tags,
        },
        this.#runtime,
      );
      if (this.#notes.has(note.id)) {
        throw new NotebookConflictError(`Note already exists: ${note.id}`);
      }
      noteCreated = true;
    }

    const linkId = sourceLinkId(note.id, input.item.id);
    const existingLink = this.#sourceLinks.get(linkId);
    if (existingLink) {
      const existingReference = this.#references.get(existingLink.referenceId);
      if (!existingReference) {
        throw new Error(
          `Notebook invariant failed: missing reference ${existingLink.referenceId}`,
        );
      }
      return {
        note: cloneRecord(note),
        reference: cloneRecord(existingReference),
        sourceLink: cloneRecord(existingLink),
        referenceCreated: false,
        noteCreated: false,
      };
    }

    // All failure-prone note/link checks happen before this first mutation so
    // the memory implementation preserves transaction-like behavior.
    const referenceResult = await this.createOrReuseReference(
      referenceDraftFromFeedItem(input.item),
    );
    const sourceLink = makeSourceLink(
      note.id,
      input.item.id,
      input.item.sourceId,
      referenceResult.reference.id,
      this.#runtime,
    );

    const hasNewLinkData =
      !note.referenceIds.includes(referenceResult.reference.id) ||
      !note.sourceItemIds.includes(input.item.id);
    if (hasNewLinkData) {
      note = applyNoteUpdate(
        note,
        {
          referenceIds: uniqueStrings([
            ...note.referenceIds,
            referenceResult.reference.id,
          ]),
          sourceItemIds: uniqueStrings([
            ...note.sourceItemIds,
            input.item.id,
          ]),
        },
        this.#runtime,
      );
    }

    this.#notes.set(note.id, cloneRecord(note));
    this.#sourceLinks.set(sourceLink.id, cloneRecord(sourceLink));
    return {
      note: cloneRecord(note),
      reference: cloneRecord(referenceResult.reference),
      sourceLink: cloneRecord(sourceLink),
      referenceCreated: referenceResult.created,
      noteCreated,
    };
  }

  public async exportData(appVersion?: string): Promise<NotebookExportEnvelope> {
    return makeExportEnvelope(
      {
        notes: [...this.#notes.values()],
        references: [...this.#references.values()],
        calculations: [...this.#calculations.values()],
        sourceLinks: [...this.#sourceLinks.values()],
      },
      this.#runtime,
      appVersion,
    );
  }

  public async importData(input: string | unknown): Promise<NotebookImportResult> {
    const preview = previewNotebookImport(input, {
      noteIds: new Set(this.#notes.keys()),
      referenceIds: new Set(this.#references.keys()),
      calculationIds: new Set(this.#calculations.keys()),
      sourceLinkIds: new Set(this.#sourceLinks.keys()),
    });
    if (!preview.valid || !preview.envelope) {
      throw new NotebookImportValidationError(preview);
    }
    if (preview.conflicts.length > 0) {
      throw new NotebookConflictError(
        `Import contains ${preview.conflicts.length} record conflict(s)`,
      );
    }

    const { data } = preview.envelope;
    for (const note of data.notes) this.#notes.set(note.id, cloneRecord(note));
    for (const reference of data.references) {
      this.#references.set(reference.id, cloneRecord(reference));
      this.#referenceIdentityToId.set(referenceIdentity(reference), reference.id);
    }
    for (const calculation of data.calculations) {
      this.#calculations.set(calculation.id, cloneRecord(calculation));
    }
    for (const sourceLink of data.sourceLinks) {
      this.#sourceLinks.set(sourceLink.id, cloneRecord(sourceLink));
    }
    return { ...preview.counts };
  }

  public async deleteAllData(): Promise<void> {
    this.#notes.clear();
    this.#references.clear();
    this.#referenceIdentityToId.clear();
    this.#calculations.clear();
    this.#sourceLinks.clear();
  }
}
