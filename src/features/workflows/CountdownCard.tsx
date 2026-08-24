import { useId, useState } from "preact/hooks";

import {
  cancelAllCountdownAlarms,
  cancelCountdownAlarm,
  playAlarmPreview,
  scheduleCountdownAlarm,
} from "./alarm-client";
import { countdownSnapshot, createCountdown, formatRemainingTime, restartCountdown } from "./countdown";
import { useTranslate } from "../../platform/i18n";
import { useWorkflow } from "./workflow-context";

const PRESETS = [
  { key: "countdown.preset.30s", durationMs: 30_000 },
  { key: "countdown.preset.1m", durationMs: 60_000 },
  { key: "countdown.preset.5m", durationMs: 5 * 60_000 },
  { key: "countdown.preset.15m", durationMs: 15 * 60_000 },
  { key: "countdown.preset.30m", durationMs: 30 * 60_000 },
  { key: "countdown.preset.1h", durationMs: 60 * 60_000 },
] as const;

export function CountdownCard() {
  const t = useTranslate();
  const id = useId();
  const { state, setState, nowMs, clock } = useWorkflow();
  const [label, setLabel] = useState(t("countdown.defaultLabel"));
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
          setMessage(error instanceof Error ? error.message : t("countdown.msg.alarmFailed")),
        );
      }
      setMessage(t("countdown.msg.started", { name: countdown.label }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("countdown.msg.createFailed"));
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
        setMessage(t("countdown.msg.soundOn"));
      } else {
        await cancelAllCountdownAlarms();
        setMessage(t("countdown.msg.soundOff"));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("countdown.msg.soundFailed"));
    }
  }

  return (
    <article class="widget workflows-panel workflows-card" aria-labelledby={`${id}-title`}>
      <div class="widget__heading">
        <span class="widget__eyebrow">{t("countdown.eyebrow")}</span>
        <span class="module-count">{state.countdowns.length}</span>
      </div>
      <header><h2 id={`${id}-title`}>{t("countdown.title")}</h2><p>{t("countdown.description")}</p></header>

      <div class="workflows-panel__sound-row">
        <label class="workflows-panel__switch">
          <input type="checkbox" checked={state.soundEnabled} onChange={() => void toggleSound()} />
          {t("countdown.soundLabel")}
        </label>
        <button type="button" class="workflows-panel__secondary" disabled={!state.soundEnabled} onClick={() => void playAlarmPreview()}>
          {t("countdown.testSound")}
        </button>
      </div>

      <div class="workflows-panel__form-grid">
        <label>{t("countdown.labelField")}<input value={label} maxlength={120} onInput={(event) => setLabel(event.currentTarget.value)} /></label>
        <label>{t("countdown.hours")}<input type="number" min="0" max="8760" value={hours} onInput={(event) => setHours(event.currentTarget.value)} /></label>
        <label>{t("countdown.minutes")}<input type="number" min="0" max="59" value={minutes} onInput={(event) => setMinutes(event.currentTarget.value)} /></label>
        <label>{t("countdown.seconds")}<input type="number" min="0" max="59" value={seconds} onInput={(event) => setSeconds(event.currentTarget.value)} /></label>
      </div>
      <div class="workflows-panel__presets" aria-label={t("countdown.presetsAria")}>
        {PRESETS.map((preset) => <button type="button" class="workflows-panel__secondary" key={preset.durationMs} onClick={() => startCountdown(preset.durationMs)}>+ {t(preset.key)}</button>)}
      </div>
      <button type="button" onClick={() => startCountdown((Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds)) * 1_000)}>{t("countdown.start")}</button>

      <div class="workflows-panel__countdowns" aria-live="polite">
        {state.countdowns.length === 0 && <p class="workflows-panel__empty">{t("countdown.empty")}</p>}
        {state.countdowns.map((countdown) => {
          const snapshot = countdownSnapshot(countdown, nowMs);
          return (
            <article key={countdown.id}>
              <div><strong>{countdown.label}</strong><time dateTime={countdown.targetAt}>{snapshot.expired ? t("countdown.done") : formatRemainingTime(snapshot.remainingMs)}</time></div>
              <div class="workflows-panel__progress-row">
                <progress value={snapshot.progress} max={1} aria-label={t("countdown.progressAria", { name: countdown.label })} />
                <span>{Math.round(snapshot.progress * 100)}%</span>
              </div>
              <div class="workflows-panel__actions">
                <button type="button" onClick={() => {
                  const restarted = restartCountdown(countdown, clock());
                  setState((current) => ({ ...current, countdowns: current.countdowns.map((item) => item.id === countdown.id ? restarted : item) }));
                  if (state.soundEnabled) void scheduleCountdownAlarm(restarted);
                }}>{t("countdown.restart")}</button>
                <button type="button" onClick={() => {
                  void cancelCountdownAlarm(countdown.id);
                  setState((current) => ({ ...current, countdowns: current.countdowns.filter((item) => item.id !== countdown.id) }));
                }}>{t("countdown.remove")}</button>
              </div>
            </article>
          );
        })}
      </div>
      <p class="workflows-panel__message" role="status">{message}</p>
    </article>
  );
}
