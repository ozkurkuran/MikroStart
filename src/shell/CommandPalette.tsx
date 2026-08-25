import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { IndexedDbNotebookRepository, type NoteRecord } from "../features/notebook";
import type { NormalizedFeedItem } from "../features/feeds";
import { listLatestFeedItems } from "../platform/feedStore";
import { useTranslate } from "../platform/i18n";
import { MODULE_IDS, type ModuleId } from "../platform/layoutPreferences";
import { MODULE_CATALOG, moduleKind, moduleTitle } from "./moduleCatalog";
import { searchCommands, type CommandSearchRecord } from "./commandSearch";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenModule: (id: ModuleId) => void;
}

export function CommandPalette({ open, onClose, onOpenModule }: CommandPaletteProps) {
  const t = useTranslate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [sources, setSources] = useState<NormalizedFeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const repository = new IndexedDbNotebookRepository();
    void Promise.all([repository.listNotes({ limit: 100 }), listLatestFeedItems(200)])
      .then(([nextNotes, nextSources]) => {
        setNotes(nextNotes);
        setSources(nextSources);
      })
      .finally(() => repository.close());
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const records = useMemo<CommandSearchRecord[]>(() => [
    { id: "action:settings", kind: "action", title: t("palette.settings"), subtitle: t("palette.action") },
    ...MODULE_IDS.map((id) => ({
      id: `module:${id}`,
      kind: "module" as const,
      title: moduleTitle(t, id),
      subtitle: moduleKind(t, id),
      keywords: MODULE_CATALOG[id].keywords,
    })),
    ...notes.map((note) => ({
      id: `note:${note.id}`,
      kind: "note" as const,
      title: note.title,
      subtitle: t("palette.note"),
      keywords: [note.markdown, ...note.tags],
    })),
    ...sources.map((source) => ({
      id: `source:${source.id}`,
      kind: "source" as const,
      title: source.title,
      subtitle: source.authors.map((author) => author.name).join(", ") || t("palette.source"),
      keywords: [source.identifiers.doi ?? "", source.identifiers.arxiv ?? "", source.sourceDescription ?? ""],
    })),
  ], [notes, sources, t]);

  const results = useMemo(() => searchCommands(records, query, 14), [records, query]);

  useEffect(() => setActiveIndex(0), [query]);

  function run(record: CommandSearchRecord | undefined) {
    if (!record) return;
    if (record.id === "action:settings") {
      window.location.href = "/pages/options.html";
    } else if (record.id.startsWith("module:")) {
      onOpenModule(record.id.slice(7) as ModuleId);
    } else if (record.id.startsWith("note:")) {
      onOpenModule("lab-notebook");
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("benchtab:open-note", {
        detail: { noteId: record.id.slice(5) },
      })), 80);
    } else if (record.id.startsWith("source:")) {
      const source = sources.find((item) => `source:${item.id}` === record.id);
      if (source?.canonicalUrl) window.open(source.canonicalUrl, "_blank", "noopener,noreferrer");
      else onOpenModule("research-feed");
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div class="command-palette" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section class="command-palette__dialog" role="dialog" aria-modal="true" aria-label={t("palette.title")}>
        <div class="command-palette__input">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            value={query}
            type="search"
            autocomplete="off"
            placeholder={t("palette.placeholder")}
            aria-controls="command-results"
            aria-activedescendant={results[activeIndex] ? `command-${results[activeIndex].id}` : undefined}
            onInput={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              else if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(0, index - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(results[activeIndex]);
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div class="command-palette__results" id="command-results" role="listbox">
          {results.length === 0 ? <p class="empty-state">{t("palette.empty")}</p> : results.map((record, index) => (
            <button
              id={`command-${record.id}`}
              key={record.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => run(record)}
            >
              <span class={`command-palette__kind command-palette__kind--${record.kind}`}>
                {t(`palette.kind.${record.kind}`)}
              </span>
              <span><strong>{record.title}</strong>{record.subtitle && <small>{record.subtitle}</small>}</span>
              <span aria-hidden="true">↵</span>
            </button>
          ))}
        </div>
        <footer>{t("palette.hint")}</footer>
      </section>
    </div>
  );
}
