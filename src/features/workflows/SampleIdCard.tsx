import { useId, useState } from "preact/hooks";

import { generateUniqueSampleId } from "./sample-id";
import { useWorkflow } from "./workflow-context";

export function SampleIdCard() {
  const id = useId();
  const { state, setState, clock } = useWorkflow();
  const [prefix, setPrefix] = useState("LAB");
  const [message, setMessage] = useState("");

  function createSample() {
    try {
      const sampleId = generateUniqueSampleId(state.recentSampleIds, { prefix, now: clock() });
      setState((current) => ({ ...current, recentSampleIds: [sampleId, ...current.recentSampleIds].slice(0, 100) }));
      setMessage(`${sampleId} üretildi.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Numune kimliği üretilemedi.");
    }
  }

  return (
    <article class="widget workflows-panel workflows-card" aria-labelledby={`${id}-title`}>
      <div class="widget__heading"><span class="widget__eyebrow">Etiketleme · Akış</span></div>
      <header><h2 id={`${id}-title`}>Numune kimliği</h2><p>Okunabilir ve çakışmaya dayanıklı deney kimlikleri.</p></header>
      <label>Proje veya cihaz öneki<input value={prefix} maxlength={30} onInput={(event) => setPrefix(event.currentTarget.value)} /></label>
      <button type="button" onClick={createSample}>Numune kimliği üret</button>
      <ol class="workflows-panel__history" aria-label="Son numune kimlikleri">
        {state.recentSampleIds.slice(0, 5).map((sampleId) => <li key={sampleId}><code>{sampleId}</code></li>)}
      </ol>
      <p class="workflows-panel__message" role="status">{message}</p>
    </article>
  );
}
