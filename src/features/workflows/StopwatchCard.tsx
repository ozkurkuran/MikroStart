import { useId } from "preact/hooks";

import { formatStopwatchTime, pauseStopwatch, recordStopwatchLap, resetStopwatch, startStopwatch, stopwatchElapsedMs } from "./stopwatch";
import { useWorkflow } from "./workflow-context";

export function StopwatchCard() {
  const id = useId();
  const { state, setState, nowMs, clock } = useWorkflow();
  const elapsed = stopwatchElapsedMs(state.stopwatch, nowMs);

  return (
    <article class="widget widget--violet workflows-panel workflows-card" aria-labelledby={`${id}-title`}>
      <div class="widget__heading"><span class="widget__eyebrow">STOPWATCH · LOCAL</span></div>
      <header><h2 id={`${id}-title`}>Kronometre</h2><p>Tur ve toplam süreleri cihazda tutar.</p></header>
      <output class="workflows-panel__stopwatch" aria-live="off">{formatStopwatchTime(elapsed)}</output>
      <div class="workflows-panel__stopwatch-actions">
        <button type="button" onClick={() => setState((current) => ({ ...current, stopwatch: current.stopwatch.running ? pauseStopwatch(current.stopwatch, clock()) : startStopwatch(current.stopwatch, clock()) }))}>{state.stopwatch.running ? "Duraklat" : "Başlat"}</button>
        <button type="button" class="workflows-panel__secondary" disabled={elapsed === 0} onClick={() => setState((current) => ({ ...current, stopwatch: recordStopwatchLap(current.stopwatch, clock()) }))}>Tur</button>
        <button type="button" class="workflows-panel__secondary" onClick={() => setState((current) => ({ ...current, stopwatch: resetStopwatch() }))}>Sıfırla</button>
      </div>
      <ol class="workflows-panel__laps" aria-label="Kronometre turları">
        {state.stopwatch.laps.slice(0, 8).map((lap, index) => (
          <li key={lap.id}><span>Tur {state.stopwatch.laps.length - index}</span><strong>{formatStopwatchTime(lap.splitMs)}</strong><small>{formatStopwatchTime(lap.elapsedMs)} toplam</small></li>
        ))}
      </ol>
    </article>
  );
}
