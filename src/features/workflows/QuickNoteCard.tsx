import { useId, useState } from "preact/hooks";

import { createTimestampedQuickNote } from "./quick-note";
import { useTranslate } from "../../platform/i18n";
import { useWorkflow } from "./workflow-context";

export function QuickNoteCard() {
  const t = useTranslate();
  const id = useId();
  const { state, setState, clock } = useWorkflow();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  function addNote() {
    try {
      const timestamped = createTimestampedQuickNote(note, clock());
      setState((current) => ({ ...current, quickNotes: [timestamped, ...current.quickNotes].slice(0, 100) }));
      setNote("");
      setMessage(t("note.msg.added"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("note.msg.failed"));
    }
  }

  return (
    <article class="widget workflows-panel workflows-card" aria-labelledby={`${id}-title`}>
      <div class="widget__heading"><span class="widget__eyebrow">{t("note.eyebrow")}</span></div>
      <header><h2 id={`${id}-title`}>{t("note.title")}</h2><p>{t("note.description")}</p></header>
      <label>{t("note.observationLabel")}<textarea value={note} maxlength={2_000} rows={3} onInput={(event) => setNote(event.currentTarget.value)} /></label>
      <button type="button" onClick={addNote}>{t("note.add")}</button>
      <ol class="workflows-panel__history" aria-label={t("note.historyAria")}>
        {state.quickNotes.slice(0, 5).map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}
      </ol>
      <p class="workflows-panel__message" role="status">{message}</p>
    </article>
  );
}
