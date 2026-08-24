import { describe, expect, it } from "vitest";

import { MemoryNotebookRepository } from "./memory-repository";
import { NotebookConflictError, NotebookNotFoundError } from "./repository";
import type { NotebookRuntime } from "./shared";
import type {
  FeedItemForNotebook,
  NotebookExportEnvelope,
  ReferenceDraft,
} from "./types";
import {
  assertValidNotebookImport,
  NotebookImportValidationError,
  previewNotebookImport,
} from "./validation";

function deterministicRuntime(): NotebookRuntime {
  let nextId = 0;
  let nextSecond = 0;
  return {
    createId: () => `id-${++nextId}`,
    now: () =>
      new Date(Date.UTC(2026, 7, 24, 12, 0, nextSecond++)).toISOString(),
  };
}

function referenceDraft(overrides: Partial<ReferenceDraft> = {}): ReferenceDraft {
  return {
    type: "article",
    title: "A reproducible thin-film experiment",
    authors: [{ given: "Ada", family: "Lovelace" }],
    doi: "https://doi.org/10.1000/EXAMPLE",
    canonicalUrl: "https://example.test/papers/one#abstract",
    retrievedAt: "2026-08-24T10:00:00.000Z",
    sourceSnapshot: {
      sourceId: "journal-rss",
      title: "A reproducible thin-film experiment",
      canonicalUrl: "https://example.test/papers/one",
      retrievedAt: "2026-08-24T10:00:00.000Z",
    },
    ...overrides,
  };
}

function feedItem(): FeedItemForNotebook {
  return {
    id: "feed-item-1",
    sourceId: "journal-rss",
    connectorId: "generic-rss",
    canonicalUrl: "https://example.test/papers/one",
    title: "A reproducible thin-film experiment",
    authors: [{ literal: "Research Group" }],
    retrievedAt: "2026-08-24T10:00:00.000Z",
    doi: "10.1000/example",
    contentHash: "sha256:example",
  };
}

describe("MemoryNotebookRepository", () => {
  it("creates, updates, lists and deletes versioned notes", async () => {
    const repository = new MemoryNotebookRepository(deterministicRuntime());
    const created = await repository.createNote({
      id: "note-1",
      type: "experiment",
      title: "  Deposition run  ",
      tags: ["thin-film", "thin-film", "  "],
    });

    expect(created).toMatchObject({
      id: "note-1",
      version: 1,
      title: "Deposition run",
      tags: ["thin-film"],
    });

    const updated = await repository.updateNote(
      created.id,
      { markdown: "Pressure: 1e-6 mbar" },
      1,
    );
    expect(updated.version).toBe(2);
    expect(updated.markdown).toContain("1e-6");
    await expect(
      repository.updateNote(created.id, { title: "stale" }, 1),
    ).rejects.toBeInstanceOf(NotebookConflictError);
    expect(await repository.listNotes()).toHaveLength(1);
    expect(await repository.deleteNote(created.id)).toBe(true);
    expect(await repository.getNote(created.id)).toBeUndefined();
  });

  it("reuses immutable references by normalized DOI", async () => {
    const repository = new MemoryNotebookRepository(deterministicRuntime());
    const first = await repository.createOrReuseReference(referenceDraft());
    const second = await repository.createOrReuseReference(
      referenceDraft({
        title: "Remote metadata changed",
        doi: "doi:10.1000/example",
        canonicalUrl: "https://another.example.test/article",
      }),
    );

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.reference).toEqual(first.reference);
    expect(second.reference.doi).toBe("10.1000/example");
  });

  it("saves a feed item to a note idempotently with provenance", async () => {
    const repository = new MemoryNotebookRepository(deterministicRuntime());
    const first = await repository.saveFeedItemToNote({
      item: feedItem(),
      newNote: { id: "literature-note", tags: ["saved"] },
    });
    const second = await repository.saveFeedItemToNote({
      item: feedItem(),
      noteId: first.note.id,
    });

    expect(first.noteCreated).toBe(true);
    expect(first.referenceCreated).toBe(true);
    expect(first.note.referenceIds).toEqual([first.reference.id]);
    expect(second.noteCreated).toBe(false);
    expect(second.referenceCreated).toBe(false);
    expect(second.note.referenceIds).toEqual([first.reference.id]);
    expect(second.note.sourceItemIds).toEqual(["feed-item-1"]);
    expect(second.note.version).toBe(first.note.version);
    expect(await repository.listSourceLinks()).toEqual([first.sourceLink]);
  });

  it("does not leave a reference when a feed save cannot find its note", async () => {
    const repository = new MemoryNotebookRepository(deterministicRuntime());
    await expect(
      repository.saveFeedItemToNote({ item: feedItem(), noteId: "missing" }),
    ).rejects.toBeInstanceOf(NotebookNotFoundError);
    expect(await repository.listReferences()).toEqual([]);
  });

  it("exports user-owned records without adding private configuration", async () => {
    const repository = new MemoryNotebookRepository(deterministicRuntime());
    await repository.createNote({ type: "free", title: "Local note" });
    await repository.saveCalculation({
      calculatorId: "bragg-spacing",
      calculatorVersion: "1.0.0",
      input: { thetaDegrees: 20, wavelengthNm: 0.154 },
      output: { spacingNm: 0.225 },
    });
    const exported = await repository.exportData("0.1.0");

    expect(exported.format).toBe("benchtab-notebook-export");
    expect(exported.schemaVersion).toBe(1);
    expect(exported.appVersion).toBe("0.1.0");
    expect(JSON.stringify(exported)).not.toMatch(/apiKey|secret|token/i);
  });

  it("refuses secret-like fields in exportable calculation snapshots", async () => {
    const repository = new MemoryNotebookRepository(deterministicRuntime());
    await expect(
      repository.saveCalculation({
        calculatorId: "unsafe",
        calculatorVersion: "1",
        input: { apiKey: "must-not-be-stored" },
        output: 1,
      }),
    ).rejects.toThrow("Sensitive field");
    expect((await repository.exportData()).data.calculations).toEqual([]);
  });

  it("deletes all notebook data as an explicit repository operation", async () => {
    const repository = new MemoryNotebookRepository(deterministicRuntime());
    await repository.createNote({ type: "free", title: "Temporary note" });
    await repository.createOrReuseReference(referenceDraft());
    await repository.deleteAllData();
    const exported = await repository.exportData();
    expect(exported.data).toEqual({
      notes: [],
      references: [],
      calculations: [],
      sourceLinks: [],
    });
  });
});

describe("notebook import validation", () => {
  async function validEnvelope(): Promise<NotebookExportEnvelope> {
    const repository = new MemoryNotebookRepository(deterministicRuntime());
    await repository.saveFeedItemToNote({
      item: feedItem(),
      newNote: { id: "note-import" },
    });
    return repository.exportData("0.1.0");
  }

  it("previews a valid envelope and reports existing-ID conflicts", async () => {
    const envelope = await validEnvelope();
    const preview = previewNotebookImport(JSON.stringify(envelope), {
      noteIds: new Set(["note-import"]),
    });

    expect(preview.valid).toBe(true);
    expect(preview.counts).toMatchObject({ notes: 1, references: 1 });
    expect(preview.conflicts).toContainEqual({
      entity: "note",
      id: "note-import",
      reason: "already-exists",
    });
    expect(preview.envelope).toEqual(envelope);
  });

  it("rejects unknown fields, unsafe URLs and sensitive calculation data", async () => {
    const envelope = await validEnvelope();
    const unsafe = structuredClone(envelope) as NotebookExportEnvelope & {
      apiKey?: string;
    };
    unsafe.apiKey = "must-not-survive";
    unsafe.data.references[0]!.canonicalUrl = "javascript:alert(1)";
    unsafe.data.calculations.push({
      id: "unsafe-calculation",
      calculatorId: "example",
      calculatorVersion: "1",
      createdAt: "2026-08-24T10:00:00.000Z",
      input: { apiKey: "must-not-survive" },
      output: 1,
    });

    const preview = previewNotebookImport(unsafe);
    expect(preview.valid).toBe(false);
    expect(preview.envelope).toBeUndefined();
    expect(preview.issues.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "$.apiKey",
        "$.data.references[0].canonicalUrl",
        "$.data.calculations[0].input.apiKey",
      ]),
    );
    expect(() => assertValidNotebookImport(unsafe)).toThrow(
      NotebookImportValidationError,
    );
  });

  it("rejects broken foreign-key relationships", async () => {
    const envelope = await validEnvelope();
    envelope.data.references = [];

    const preview = previewNotebookImport(envelope);
    expect(preview.valid).toBe(false);
    expect(preview.issues.some(({ message }) => message.includes("Missing reference"))).toBe(
      true,
    );
  });

  it("restores a complete validated backup into an empty repository", async () => {
    const envelope = await validEnvelope();
    const restored = new MemoryNotebookRepository(deterministicRuntime());

    const result = await restored.importData(JSON.stringify(envelope));
    expect(result).toMatchObject({ notes: 1, references: 1, sourceLinks: 1 });
    const restoredExport = await restored.exportData();
    expect(restoredExport.data.notes).toEqual(envelope.data.notes);
    expect(restoredExport.data.references[0]).toMatchObject({
      id: envelope.data.references[0].id,
      title: envelope.data.references[0].title,
      canonicalUrl: envelope.data.references[0].canonicalUrl,
      doi: envelope.data.references[0].doi,
    });
    await expect(restored.importData(envelope)).rejects.toBeInstanceOf(
      NotebookConflictError,
    );
  });
});
