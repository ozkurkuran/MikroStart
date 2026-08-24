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

const DATABASE_VERSION = 1;

const STORES = {
  notes: "notes",
  references: "references",
  calculations: "calculations",
  sourceLinks: "sourceLinks",
} as const;

interface StoredReference extends ReferenceRecord {
  /** Repository-only deterministic key; omitted from public records and exports. */
  identityKey: string;
}

export interface IndexedDbNotebookRepositoryOptions {
  databaseName?: string;
  indexedDb?: IDBFactory;
  runtime?: NotebookRuntime;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed")),
      { once: true },
    );
  });
}

function transactionResult(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed")),
      { once: true },
    );
  });
}

function publicReference(stored: StoredReference): ReferenceRecord {
  const { identityKey: _identityKey, ...reference } = stored;
  return cloneRecord(reference);
}

function abortQuietly(
  transaction: IDBTransaction,
  completion: Promise<void>,
): void {
  // The request and its transaction can reject independently. Observe the
  // completion promise even when the request was the first failure.
  void completion.catch(() => undefined);
  try {
    transaction.abort();
  } catch {
    // A completed/aborted transaction needs no further cleanup.
  }
}

export class IndexedDbNotebookRepository implements NotebookRepository {
  readonly #databaseName: string;
  readonly #indexedDb: IDBFactory;
  readonly #runtime: NotebookRuntime;
  #databasePromise?: Promise<IDBDatabase>;

  public constructor(options: IndexedDbNotebookRepositoryOptions = {}) {
    const indexedDb = options.indexedDb ?? globalThis.indexedDB;
    if (!indexedDb) {
      throw new Error("IndexedDB is not available in this context");
    }
    this.#databaseName = options.databaseName ?? "benchtab-notebook";
    this.#indexedDb = indexedDb;
    this.#runtime = options.runtime ?? defaultNotebookRuntime;
  }

  public close(): void {
    void this.#databasePromise?.then((database) => database.close());
    this.#databasePromise = undefined;
  }

  public async createNote(input: NewNoteInput): Promise<NoteRecord> {
    const note = makeNote(input, this.#runtime);
    const database = await this.#database();
    const transaction = database.transaction(STORES.notes, "readwrite");
    const done = transactionResult(transaction);
    try {
      await requestResult(transaction.objectStore(STORES.notes).add(note));
      await done;
      return cloneRecord(note);
    } catch (error) {
      abortQuietly(transaction, done);
      if (error instanceof DOMException && error.name === "ConstraintError") {
        throw new NotebookConflictError(`Note already exists: ${note.id}`);
      }
      throw error;
    }
  }

  public async updateNote(
    id: string,
    update: NoteUpdate,
    expectedVersion?: number,
  ): Promise<NoteRecord> {
    const database = await this.#database();
    const transaction = database.transaction(STORES.notes, "readwrite");
    const done = transactionResult(transaction);
    const store = transaction.objectStore(STORES.notes);
    try {
      const current = await requestResult<NoteRecord | undefined>(store.get(id));
      if (!current) {
        throw new NotebookNotFoundError("Note", id);
      }
      if (expectedVersion !== undefined && current.version !== expectedVersion) {
        throw new NotebookConflictError(
          `Note ${id} is version ${current.version}, expected ${expectedVersion}`,
        );
      }
      const next = applyNoteUpdate(current, update, this.#runtime);
      await requestResult(store.put(next));
      await done;
      return cloneRecord(next);
    } catch (error) {
      abortQuietly(transaction, done);
      throw error;
    }
  }

  public async getNote(id: string): Promise<NoteRecord | undefined> {
    const database = await this.#database();
    const transaction = database.transaction(STORES.notes, "readonly");
    const done = transactionResult(transaction);
    const note = await requestResult<NoteRecord | undefined>(
      transaction.objectStore(STORES.notes).get(id),
    );
    await done;
    return note ? cloneRecord(note) : undefined;
  }

  public async listNotes(options: NoteListOptions = {}): Promise<NoteRecord[]> {
    const database = await this.#database();
    const transaction = database.transaction(STORES.notes, "readonly");
    const done = transactionResult(transaction);
    const notes = await requestResult<NoteRecord[]>(
      transaction.objectStore(STORES.notes).getAll(),
    );
    await done;
    const limit = Math.max(0, options.limit ?? Number.POSITIVE_INFINITY);
    return notes
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
    const database = await this.#database();
    const transaction = database.transaction(
      [STORES.notes, STORES.sourceLinks],
      "readwrite",
    );
    const done = transactionResult(transaction);
    try {
      const noteStore = transaction.objectStore(STORES.notes);
      const existing = await requestResult<NoteRecord | undefined>(
        noteStore.get(id),
      );
      if (!existing) {
        await done;
        return false;
      }

      await requestResult(noteStore.delete(id));
      const linkStore = transaction.objectStore(STORES.sourceLinks);
      const linkKeys = await requestResult<IDBValidKey[]>(
        linkStore.index("byNoteId").getAllKeys(id),
      );
      for (const key of linkKeys) {
        await requestResult(linkStore.delete(key));
      }
      await done;
      return true;
    } catch (error) {
      abortQuietly(transaction, done);
      throw error;
    }
  }

  public async createOrReuseReference(
    draft: ReferenceDraft,
  ): Promise<{ reference: ReferenceRecord; created: boolean }> {
    const database = await this.#database();
    const transaction = database.transaction(STORES.references, "readwrite");
    const done = transactionResult(transaction);
    try {
      const result = await this.#createOrReuseReferenceInTransaction(
        transaction,
        draft,
      );
      await done;
      return result;
    } catch (error) {
      abortQuietly(transaction, done);
      if (error instanceof DOMException && error.name === "ConstraintError") {
        throw new NotebookConflictError(
          `Reference ID already exists: ${draft.id ?? "generated ID"}`,
        );
      }
      throw error;
    }
  }

  public async getReference(id: string): Promise<ReferenceRecord | undefined> {
    const database = await this.#database();
    const transaction = database.transaction(STORES.references, "readonly");
    const done = transactionResult(transaction);
    const stored = await requestResult<StoredReference | undefined>(
      transaction.objectStore(STORES.references).get(id),
    );
    await done;
    return stored ? publicReference(stored) : undefined;
  }

  public async listReferences(): Promise<ReferenceRecord[]> {
    const database = await this.#database();
    const transaction = database.transaction(STORES.references, "readonly");
    const done = transactionResult(transaction);
    const references = await requestResult<StoredReference[]>(
      transaction.objectStore(STORES.references).getAll(),
    );
    await done;
    return references.map(publicReference);
  }

  public async saveCalculation(
    draft: SavedCalculationDraft,
  ): Promise<SavedCalculationRecord> {
    const calculation = makeCalculation(draft, this.#runtime);
    const database = await this.#database();
    const transaction = database.transaction(STORES.calculations, "readwrite");
    const done = transactionResult(transaction);
    try {
      await requestResult(
        transaction.objectStore(STORES.calculations).add(calculation),
      );
      await done;
      return cloneRecord(calculation);
    } catch (error) {
      abortQuietly(transaction, done);
      if (error instanceof DOMException && error.name === "ConstraintError") {
        throw new NotebookConflictError(
          `Calculation already exists: ${calculation.id}`,
        );
      }
      throw error;
    }
  }

  public async listCalculations(): Promise<SavedCalculationRecord[]> {
    const database = await this.#database();
    const transaction = database.transaction(STORES.calculations, "readonly");
    const done = transactionResult(transaction);
    const calculations = await requestResult<SavedCalculationRecord[]>(
      transaction.objectStore(STORES.calculations).getAll(),
    );
    await done;
    return calculations.map(cloneRecord);
  }

  public async listSourceLinks(): Promise<SourceItemLink[]> {
    const database = await this.#database();
    const transaction = database.transaction(STORES.sourceLinks, "readonly");
    const done = transactionResult(transaction);
    const sourceLinks = await requestResult<SourceItemLink[]>(
      transaction.objectStore(STORES.sourceLinks).getAll(),
    );
    await done;
    return sourceLinks.map(cloneRecord);
  }

  public async saveFeedItemToNote(
    input: SaveFeedItemToNoteInput,
  ): Promise<SaveFeedItemToNoteResult> {
    if (input.noteId && input.newNote) {
      throw new NotebookConflictError("Provide noteId or newNote, not both");
    }

    const database = await this.#database();
    const transaction = database.transaction(
      [STORES.notes, STORES.references, STORES.sourceLinks],
      "readwrite",
    );
    const done = transactionResult(transaction);
    try {
      const noteStore = transaction.objectStore(STORES.notes);
      let noteCreated = false;
      let note: NoteRecord;

      if (input.noteId) {
        const existing = await requestResult<NoteRecord | undefined>(
          noteStore.get(input.noteId),
        );
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
        await requestResult(noteStore.add(note));
        noteCreated = true;
      }

      const linkStore = transaction.objectStore(STORES.sourceLinks);
      const linkId = sourceLinkId(note.id, input.item.id);
      const existingLink = await requestResult<SourceItemLink | undefined>(
        linkStore.get(linkId),
      );
      if (existingLink) {
        const storedReference = await requestResult<StoredReference | undefined>(
          transaction
            .objectStore(STORES.references)
            .get(existingLink.referenceId),
        );
        if (!storedReference) {
          throw new Error(
            `Notebook invariant failed: missing reference ${existingLink.referenceId}`,
          );
        }
        await done;
        return {
          note: cloneRecord(note),
          reference: publicReference(storedReference),
          sourceLink: cloneRecord(existingLink),
          referenceCreated: false,
          noteCreated: false,
        };
      }

      const referenceResult = await this.#createOrReuseReferenceInTransaction(
        transaction,
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
        await requestResult(noteStore.put(note));
      }
      await requestResult(linkStore.add(sourceLink));

      await done;
      return {
        note: cloneRecord(note),
        reference: cloneRecord(referenceResult.reference),
        sourceLink: cloneRecord(sourceLink),
        referenceCreated: referenceResult.created,
        noteCreated,
      };
    } catch (error) {
      abortQuietly(transaction, done);
      if (error instanceof DOMException && error.name === "ConstraintError") {
        throw new NotebookConflictError(
          "The note, reference, or source link already exists",
        );
      }
      throw error;
    }
  }

  public async exportData(appVersion?: string): Promise<NotebookExportEnvelope> {
    const database = await this.#database();
    const transaction = database.transaction(Object.values(STORES), "readonly");
    const done = transactionResult(transaction);
    const notesRequest = requestResult<NoteRecord[]>(
      transaction.objectStore(STORES.notes).getAll(),
    );
    const referencesRequest = requestResult<StoredReference[]>(
      transaction.objectStore(STORES.references).getAll(),
    );
    const calculationsRequest = requestResult<SavedCalculationRecord[]>(
      transaction.objectStore(STORES.calculations).getAll(),
    );
    const sourceLinksRequest = requestResult<SourceItemLink[]>(
      transaction.objectStore(STORES.sourceLinks).getAll(),
    );
    const [notes, references, calculations, sourceLinks] = await Promise.all([
      notesRequest,
      referencesRequest,
      calculationsRequest,
      sourceLinksRequest,
    ]);
    await done;
    return makeExportEnvelope(
      {
        notes,
        references: references.map(publicReference),
        calculations,
        sourceLinks,
      },
      this.#runtime,
      appVersion,
    );
  }

  public async importData(input: string | unknown): Promise<NotebookImportResult> {
    const database = await this.#database();
    const readTransaction = database.transaction(Object.values(STORES), "readonly");
    const readDone = transactionResult(readTransaction);
    const [noteKeys, referenceKeys, calculationKeys, sourceLinkKeys] = await Promise.all([
      requestResult<IDBValidKey[]>(readTransaction.objectStore(STORES.notes).getAllKeys()),
      requestResult<IDBValidKey[]>(readTransaction.objectStore(STORES.references).getAllKeys()),
      requestResult<IDBValidKey[]>(readTransaction.objectStore(STORES.calculations).getAllKeys()),
      requestResult<IDBValidKey[]>(readTransaction.objectStore(STORES.sourceLinks).getAllKeys()),
    ]);
    await readDone;
    const preview = previewNotebookImport(input, {
      noteIds: new Set(noteKeys.map(String)),
      referenceIds: new Set(referenceKeys.map(String)),
      calculationIds: new Set(calculationKeys.map(String)),
      sourceLinkIds: new Set(sourceLinkKeys.map(String)),
    });
    if (!preview.valid || !preview.envelope) {
      throw new NotebookImportValidationError(preview);
    }
    if (preview.conflicts.length > 0) {
      throw new NotebookConflictError(
        `Import contains ${preview.conflicts.length} record conflict(s)`,
      );
    }

    const transaction = database.transaction(Object.values(STORES), "readwrite");
    const done = transactionResult(transaction);
    try {
      const writes: Array<Promise<IDBValidKey>> = [];
      for (const reference of preview.envelope.data.references) {
        writes.push(
          requestResult(
            transaction.objectStore(STORES.references).add({
              ...reference,
              identityKey: referenceIdentity(reference),
            }),
          ),
        );
      }
      for (const calculation of preview.envelope.data.calculations) {
        writes.push(requestResult(transaction.objectStore(STORES.calculations).add(calculation)));
      }
      for (const note of preview.envelope.data.notes) {
        writes.push(requestResult(transaction.objectStore(STORES.notes).add(note)));
      }
      for (const sourceLink of preview.envelope.data.sourceLinks) {
        writes.push(requestResult(transaction.objectStore(STORES.sourceLinks).add(sourceLink)));
      }
      await Promise.all(writes);
      await done;
      return { ...preview.counts };
    } catch (error) {
      abortQuietly(transaction, done);
      if (error instanceof DOMException && error.name === "ConstraintError") {
        throw new NotebookConflictError(
          "Import conflicts with an existing reference identity",
        );
      }
      throw error;
    }
  }

  public async deleteAllData(): Promise<void> {
    const database = await this.#database();
    const transaction = database.transaction(Object.values(STORES), "readwrite");
    const done = transactionResult(transaction);
    try {
      await Promise.all(
        Object.values(STORES).map((storeName) =>
          requestResult(transaction.objectStore(storeName).clear()),
        ),
      );
      await done;
    } catch (error) {
      abortQuietly(transaction, done);
      throw error;
    }
  }

  async #createOrReuseReferenceInTransaction(
    transaction: IDBTransaction,
    draft: ReferenceDraft,
  ): Promise<{ reference: ReferenceRecord; created: boolean }> {
    const store = transaction.objectStore(STORES.references);
    const identityKey = referenceIdentity(draft);
    const existing = await requestResult<StoredReference | undefined>(
      store.index("byIdentityKey").get(identityKey),
    );
    if (existing) {
      return { reference: publicReference(existing), created: false };
    }

    const reference = makeReference(draft, this.#runtime);
    await requestResult(store.add({ ...reference, identityKey }));
    return { reference: cloneRecord(reference), created: true };
  }

  #database(): Promise<IDBDatabase> {
    this.#databasePromise ??= new Promise((resolve, reject) => {
      const request = this.#indexedDb.open(this.#databaseName, DATABASE_VERSION);
      request.addEventListener("upgradeneeded", () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORES.notes)) {
          const notes = database.createObjectStore(STORES.notes, {
            keyPath: "id",
          });
          notes.createIndex("byUpdatedAt", "updatedAt");
        }
        if (!database.objectStoreNames.contains(STORES.references)) {
          const references = database.createObjectStore(STORES.references, {
            keyPath: "id",
          });
          references.createIndex("byIdentityKey", "identityKey", {
            unique: true,
          });
        }
        if (!database.objectStoreNames.contains(STORES.calculations)) {
          database.createObjectStore(STORES.calculations, { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains(STORES.sourceLinks)) {
          const links = database.createObjectStore(STORES.sourceLinks, {
            keyPath: "id",
          });
          links.createIndex("byNoteId", "noteId");
          links.createIndex("bySourceItemId", "sourceItemId");
        }
      });
      request.addEventListener("success", () => {
        const database = request.result;
        database.addEventListener("versionchange", () => {
          database.close();
          this.#databasePromise = undefined;
        });
        resolve(database);
      });
      request.addEventListener(
        "error",
        () => reject(request.error ?? new Error("Unable to open notebook database")),
        { once: true },
      );
      request.addEventListener(
        "blocked",
        () => reject(new Error("Notebook database upgrade is blocked")),
        { once: true },
      );
    });
    return this.#databasePromise;
  }
}
