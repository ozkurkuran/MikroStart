import { useId, useState } from "preact/hooks";

import {
  cancelAllCountdownAlarms,
  cancelCountdownAlarm,
  playAlarmPreview,
  scheduleCountdownAlarm,
} from "./alarm-client";
import { countdownSnapshot, createCountdown, formatRemainingTime, restartCountdown } from "./countdown";
import { useWorkflow } from "./workflow-context";

const PRESETS = [
  { label: "30 sn", durationMs: 30_000 },
  { label: "1 dk", durationMs: 60_000 },
  { label: "5 dk", durationMs: 5 * 60_000 },
  { label: "15 dk", durationMs: 15 * 60_000 },
  { label: "30 dk", durationMs: 30 * 60_000 },
  { label: "1 saat", durationMs: 60 * 60_000 },
] as const;

export function CountdownCard() {
  const id = useId();
  const { state, setState, nowMs, clock } = useWorkflow();
  const [label, setLabel] = useState("Anneal");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("30");
  const [seconds, setSeconds] = useState("0");
  const [message, setMessage] = useState("");

  function startCountdown(durationMs: number) {
    try {
      const countdown = createCountdown({ label, durationMs }, clock());
      setState((current) => ({
        ...current,
        countdowns: [countdown, ...current.countdowns].slice(0, 50),
      }));
      if (state.soundEnabled) {
        void scheduleCountdownAlarm(countdown).catch((error: unknown) =>
          setMessage(error instanceof Error ? error.message : "Alarm ayarlanamadı."),
        );
      }
      setMessage(`“${countdown.label}” başlatıldı.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Geri sayım oluşturulamadı.");
    }
  }

  async function toggleSound() {
    const enabled = !state.soundEnabled;
    setState((current) => ({ ...current, soundEnabled: enabled }));
    try {
      if (enabled) {
        for (const countdown of state.countdowns) {
          if (!countdownSnapshot(countdown, clock()).expired) await scheduleCountdownAlarm(countdown);
        }
        setMessage("Alarm sesi etkinleştirildi.");
      } else {
        await cancelAllCountdownAlarms();
        setMessage("Alarm sesi kapatıldı.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Alarm ayarı değiştirilemedi.");
    }
  }

  return (
    <article class="widget workflows-panel workflows-card" aria-labelledby={`${id}-title`}>
      <div class="widget__heading">
        <span class="widget__eyebrow">Zamanlayıcı · Akış</span>
        <span class="module-count">{state.countdowns.length}</span>
      </div>
      <header><h2 id={`${id}-title`}>Geri sayım</h2><p>Birden fazla laboratuvar sürecini aynı anda izleyin.</p></header>

      <div class="workflows-panel__sound-row">
        <label class="workflows-panel__switch">
          <input type="checkbox" checked={state.soundEnabled} onChange={() => void toggleSound()} />
          Alarm sesi
        </label>
        <button type="button" class="workflows-panel__secondary" disabled={!state.soundEnabled} onClick={() => void playAlarmPreview()}>
          Sesi test et
        </button>
      </div>

      <div class="workflows-panel__form-grid">
        <label>Etiket<input value={label} maxlength={120} onInput={(event) => setLabel(event.currentTarget.value)} /></label>
        <label>Saat<input type="number" min="0" max="8760" value={hours} onInput={(event) => setHours(event.currentTarget.value)} /></label>
        <label>Dakika<input type="number" min="0" max="59" value={minutes} onInput={(event) => setMinutes(event.currentTarget.value)} /></label>
        <label>Saniye<input type="number" min="0" max="59" value={seconds} onInput={(event) => setSeconds(event.currentTarget.value)} /></label>
      </div>
      <div class="workflows-panel__presets" aria-label="Hızlı süreler">
        {PRESETS.map((preset) => <button type="button" class="workflows-panel__secondary" key={preset.durationMs} onClick={() => startCountdown(preset.durationMs)}>+ {preset.label}</button>)}
      </div>
      <button type="button" onClick={() => startCountdown((Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds)) * 1_000)}>Geri sayımı başlat</button>

      <div class="workflows-panel__countdowns" aria-live="polite">
        {state.countdowns.length === 0 && <p class="workflows-panel__empty">Henüz çalışan geri sayım yok.</p>}
        {state.countdowns.map((countdown) => {
          const snapshot = countdownSnapshot(countdown, nowMs);
          return (
            <article key={countdown.id}>
              <div><strong>{countdown.label}</strong><time dateTime={countdown.targetAt}>{snapshot.expired ? "Tamamlandı" : formatRemainingTime(snapshot.remainingMs)}</time></div>
              <div class="workflows-panel__progress-row">
                <progress value={snapshot.progress} max={1} aria-label={`${countdown.label} ilerlemesi`} />
                <span>{Math.round(snapshot.progress * 100)}%</span>
              </div>
              <div class="workflows-panel__actions">
                <button type="button" onClick={() => {
                  const restarted = restartCountdown(countdown, clock());
                  setState((current) => ({ ...current, countdowns: current.countdowns.map((item) => item.id === countdown.id ? restarted : item) }));
                  if (state.soundEnabled) void scheduleCountdownAlarm(restarted);
                }}>Yeniden başlat</button>
                <button type="button" onClick={() => {
                  void cancelCountdownAlarm(countdown.id);
                  setState((current) => ({ ...current, countdowns: current.countdowns.filter((item) => item.id !== countdown.id) }));
                }}>Kaldır</button>
              </div>
            </article>
          );
        })}
      </div>
      <p class="workflows-panel__message" role="status">{message}</p>
    </article>
  );
}
