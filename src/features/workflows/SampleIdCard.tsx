import { useId, useState } from "preact/hooks";

import { generateUniqueSampleId } from "./sample-id";
import { useTranslate } from "../../platform/i18n";
import { useWorkflow } from "./workflow-context";

export function SampleIdCard() {
  const t = useTranslate();
  const id = useId();
  const { state, setState, clock } = useWorkflow();
  const [prefix, setPrefix] = useState("LAB");
  const [message, setMessage] = useState("");

  function createSample() {
    try {
      const sampleId = generateUniqueSampleId(state.recentSampleIds, { prefix, now: clock() });
      setState((current) => ({ ...current, recentSampleIds: [sampleId, ...current.recentSampleIds].slice(0, 100) }));
      setMessage(t("sample.msg.created", { id: sampleId }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("sample.msg.failed"));
    }
  }

  return (
    <article class="widget workflows-panel workflows-card" aria-labelledby={`${id}-title`}>
      <div class="widget__heading"><span class="widget__eyebrow">{t("sample.eyebrow")}</span></div>
      <header><h2 id={`${id}-title`}>{t("sample.title")}</h2><p>{t("sample.description")}</p></header>
      <label>{t("sample.prefixLabel")}<input value={prefix} maxlength={30} onInput={(event) => setPrefix(event.currentTarget.value)} /></label>
      <button type="button" onClick={createSample}>{t("sample.generate")}</button>
      <ol class="workflows-panel__history" aria-label={t("sample.historyAria")}>
        {state.recentSampleIds.slice(0, 5).map((sampleId) => <li key={sampleId}><code>{sampleId}</code></li>)}
      </ol>
      <p class="workflows-panel__message" role="status">{message}</p>
    </article>
  );
}
