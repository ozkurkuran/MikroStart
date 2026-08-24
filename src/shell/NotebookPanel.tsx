import { useEffect, useState } from "preact/hooks";

import { localeTag, useI18n } from "../platform/i18n";
import {
  IndexedDbNotebookRepository,
  notebookToMarkdown,
  referencesToBibtex,
  referencesToRis,
  type NoteRecord,
} from "../features/notebook";

type NotebookExportKind = "json" | "markdown" | "bibtex" | "ris";

function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function NotebookPanel() {
  const { locale, t } = useI18n();
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState<string>();
  const [selectedNote, setSelectedNote] = useState<NoteRecord>();

  async function reload() {
    const repository = new IndexedDbNotebookRepository();
    try {
      setNotes(await repository.listNotes({ limit: 8 }));
    } finally {
      repository.close();
    }
  }

  useEffect(() => {
    const onNotebookChanged = () => void reload();
    window.addEventListener("benchtab:notebook-changed", onNotebookChanged);
    void reload();
    return () => window.removeEventListener("benchtab:notebook-changed", onNotebookChanged);
  }, []);

  function startNewNote() {
    setSelectedNote(undefined);
    setTitle("");
    setMarkdown("");
    setStatus(undefined);
  }

  function editNote(note: NoteRecord) {
    setSelectedNote(note);
    setTitle(note.title);
    setMarkdown(note.markdown);
    setStatus(undefined);
  }

  async function saveNote() {
    if (!title.trim()) return;
    const repository = new IndexedDbNotebookRepository();
    try {
      const saved = selectedNote
        ? await repository.updateNote(
            selectedNote.id,
            { title: title.trim(), markdown },
            selectedNote.version,
          )
        : await repository.createNote({
            type: "free",
            title: title.trim(),
            markdown,
          });
      setSelectedNote(saved);
      setStatus(t(selectedNote ? "notebook.msg.updated" : "notebook.msg.created"));
      await reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("notebook.msg.saveFailed"));
    } finally {
      repository.close();
    }
  }

  async function deleteSelectedNote() {
    if (!selectedNote) return;
    const repository = new IndexedDbNotebookRepository();
    try {
      await repository.deleteNote(selectedNote.id);
      startNewNote();
      setStatus(t("notebook.msg.deleted"));
      await reload();
    } finally {
      repository.close();
    }
  }

  async function exportNotebook(kind: NotebookExportKind) {
    const repository = new IndexedDbNotebookRepository();
    try {
      const data = await repository.exportData(chrome.runtime.getManifest().version);
      const base = `benchtab-notebook-${new Date().toISOString().slice(0, 10)}`;
      if (kind === "json") {
        downloadText(`${base}.json`, JSON.stringify(data, null, 2), "application/json");
      } else if (kind === "markdown") {
        downloadText(`${base}.md`, notebookToMarkdown(data), "text/markdown");
      } else if (kind === "bibtex") {
        downloadText(`${base}.bib`, referencesToBibtex(data.data.references), "application/x-bibtex");
      } else {
        downloadText(`${base}.ris`, referencesToRis(data.data.references), "application/x-research-info-systems");
      }
      setStatus(t("notebook.msg.exported", { format: kind.toUpperCase() }));
    } finally {
      repository.close();
    }
  }

  async function importNotebook(file: File) {
    const repository = new IndexedDbNotebookRepository();
    try {
      const result = await repository.importData(await file.text());
      startNewNote();
      setStatus(
        t("notebook.msg.imported", { notes: result.notes, references: result.references }),
      );
      await reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("notebook.msg.importFailed"));
    } finally {
      repository.close();
    }
  }

  return (
    <article class="widget notebook-panel">
      <div class="widget__heading">
        <span class="widget__eyebrow">{t("notebook.eyebrow")}</span>
        <span class="notebook-heading-actions">
          <button class="text-button" type="button" onClick={startNewNote}>{t("notebook.new")}</button>
          <label class="text-button import-label">
            {t("notebook.import")}
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void importNotebook(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <select
            class="export-select"
            value=""
            aria-label={t("notebook.exportAria")}
            onChange={(event) => {
              const kind = event.currentTarget.value as NotebookExportKind;
              if (kind) void exportNotebook(kind);
              event.currentTarget.value = "";
            }}
          >
            <option value="" disabled>{t("notebook.exportPlaceholder")}</option>
            <option value="json">{t("notebook.exportJson")}</option>
            <option value="markdown">Markdown</option>
            <option value="bibtex">BibTeX</option>
            <option value="ris">RIS</option>
          </select>
        </span>
      </div>
      <h2>{t("notebook.title")}</h2>

      <form
        class="note-form"
        onSubmit={(event) => {
          event.preventDefault();
          void saveNote();
        }}
      >
        <label for="note-title">{t("notebook.noteTitle")}</label>
        <input
          id="note-title"
          value={title}
          onInput={(event) => setTitle(event.currentTarget.value)}
          placeholder={t("notebook.noteTitlePlaceholder")}
          required
          maxlength={180}
        />
        <label for="note-body">{t("notebook.markdown")}</label>
        <textarea
          id="note-body"
          value={markdown}
          onInput={(event) => setMarkdown(event.currentTarget.value)}
          placeholder={t("notebook.bodyPlaceholder")}
          rows={4}
        />
        <div class="note-form__actions">
          <button class="button button--small" type="submit">
            {t(selectedNote ? "notebook.saveChanges" : "notebook.saveLocally")}
          </button>
          {selectedNote && (
            <button class="text-button text-button--danger" type="button" onClick={() => void deleteSelectedNote()}>
              {t("notebook.delete")}
            </button>
          )}
        </div>
      </form>

      {status && <p class="inline-status" role="status">{status}</p>}

      <div class="note-list">
        {notes.length === 0 ? (
          <p class="empty-state">{t("notebook.empty")}</p>
        ) : (
          notes.map((note) => (
            <button
              class={`note-list__item${selectedNote?.id === note.id ? " is-selected" : ""}`}
              key={note.id}
              type="button"
              onClick={() => editNote(note)}
            >
              <p>{note.type} · {new Date(note.updatedAt).toLocaleDateString(localeTag(locale))}</p>
              <h3>{note.title}</h3>
              {note.referenceIds.length > 0 && <small>{t("notebook.linkedReferences", { count: note.referenceIds.length })}</small>}
            </button>
          ))
        )}
      </div>
    </article>
  );
}
