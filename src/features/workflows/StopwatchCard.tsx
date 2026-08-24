import { useId } from "preact/hooks";

import { formatStopwatchTime, pauseStopwatch, recordStopwatchLap, resetStopwatch, startStopwatch, stopwatchElapsedMs } from "./stopwatch";
import { useTranslate } from "../../platform/i18n";
import { useWorkflow } from "./workflow-context";

export function StopwatchCard() {
  const t = useTranslate();
  const id = useId();
  const { state, setState, nowMs, clock } = useWorkflow();
  const elapsed = stopwatchElapsedMs(state.stopwatch, nowMs);

  return (
    <article class="widget workflows-panel workflows-card" aria-labelledby={`${id}-title`}>
      <div class="widget__heading"><span class="widget__eyebrow">{t("countdown.eyebrow")}</span></div>
      <header><h2 id={`${id}-title`}>{t("stopwatch.title")}</h2><p>{t("stopwatch.description")}</p></header>
      <output class="workflows-panel__stopwatch" aria-live="off">{formatStopwatchTime(elapsed)}</output>
      <div class="workflows-panel__stopwatch-actions">
        <button type="button" onClick={() => setState((current) => ({ ...current, stopwatch: current.stopwatch.running ? pauseStopwatch(current.stopwatch, clock()) : startStopwatch(current.stopwatch, clock()) }))}>{t(state.stopwatch.running ? "stopwatch.pause" : "stopwatch.start")}</button>
        <button type="button" class="workflows-panel__secondary" disabled={elapsed === 0} onClick={() => setState((current) => ({ ...current, stopwatch: recordStopwatchLap(current.stopwatch, clock()) }))}>{t("stopwatch.lap")}</button>
        <button type="button" class="workflows-panel__secondary" onClick={() => setState((current) => ({ ...current, stopwatch: resetStopwatch() }))}>{t("stopwatch.reset")}</button>
      </div>
      <ol class="workflows-panel__laps" aria-label={t("stopwatch.lapsAria")}>
        {state.stopwatch.laps.slice(0, 8).map((lap, index) => (
          <li key={lap.id}><span>{t("stopwatch.lapNumber", { number: state.stopwatch.laps.length - index })}</span><strong>{formatStopwatchTime(lap.splitMs)}</strong><small>{formatStopwatchTime(lap.elapsedMs)} {t("stopwatch.total")}</small></li>
        ))}
      </ol>
    </article>
  );
}
