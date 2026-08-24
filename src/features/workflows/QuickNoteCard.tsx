import { useId, useState } from "preact/hooks";

import { createTimestampedQuickNote } from "./quick-note";
import { useWorkflow } from "./workflow-context";

export function QuickNoteCard() {
  const id = useId();
  const { state, setState, clock } = useWorkflow();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  function addNote() {
    try {
      const timestamped = createTimestampedQuickNote(note, clock());
      setState((current) => ({ ...current, quickNotes: [timestamped, ...current.quickNotes].slice(0, 100) }));
      setNote("");
      setMessage("Zaman damgalı not eklendi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Not eklenemedi.");
    }
  }

  return (
    <article class="widget widget--cyan workflows-panel workflows-card" aria-labelledby={`${id}-title`}>
      <div class="widget__heading"><span class="widget__eyebrow">OBSERVE · UTC</span></div>
      <header><h2 id={`${id}-title`}>Hızlı not</h2><p>Deney anını UTC zaman damgasıyla yakalayın.</p></header>
      <label>Gözlem<textarea value={note} maxlength={2_000} rows={3} onInput={(event) => setNote(event.currentTarget.value)} /></label>
      <button type="button" onClick={addNote}>Zaman damgası ekle</button>
      <ol class="workflows-panel__history" aria-label="Son zaman damgalı notlar">
        {state.quickNotes.slice(0, 5).map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}
      </ol>
      <p class="workflows-panel__message" role="status">{message}</p>
    </article>
  );
}
