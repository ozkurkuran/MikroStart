import { useEffect, useMemo, useState } from "preact/hooks";

import { CODATA_CONSTANTS } from "../references";
import { createDefaultAiProvider } from "../ai/providers";
import { useI18n } from "../../platform/i18n";
import type { PomodoroState } from "./storage";

const CLIPBOARD_DISCLOSURE_KEY = "benchtab.clipboard-disclosure.v1";

interface OverviewStatusStripProps {
  pomodoro: PomodoroState;
  weeklyGoal: number;
  weeklyProgress: number;
  savedAt: string;
  lastBackupAt?: string;
  onPomodoroChange: (state: PomodoroState) => void;
  onWeeklyGoalChange: (value: number) => void;
  onWeeklyProgressChange: (value: number) => void;
  onBackup: () => void;
}

function formatTimer(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function OverviewStatusStrip({ pomodoro, weeklyGoal, weeklyProgress, savedAt, lastBackupAt, onPomodoroChange, onWeeklyGoalChange, onWeeklyProgressChange, onBackup }: OverviewStatusStripProps) {
  const { locale, t } = useI18n();
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(navigator.onLine);
  const [clipboardValue, setClipboardValue] = useState("");
  const [clipboardMessage, setClipboardMessage] = useState("");
  const [aiStatus, setAiStatus] = useState<"checking" | "ready" | "unavailable">("checking");
  const remaining = pomodoro.running && pomodoro.endsAt ? Math.max(0, Date.parse(pomodoro.endsAt) - now) : pomodoro.remainingMs;
  const constant = useMemo(() => CODATA_CONSTANTS[Math.floor(Date.now() / 86_400_000) % CODATA_CONSTANTS.length], []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => { window.clearInterval(timer); window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); };
  }, []);

  useEffect(() => {
    void createDefaultAiProvider().getCapabilities().then((report) => {
      setAiStatus(Object.values(report.capabilities).some((capability) => capability.ready) ? "ready" : "unavailable");
    }).catch(() => setAiStatus("unavailable"));
  }, []);

  useEffect(() => {
    if (pomodoro.running && remaining === 0) {
      onPomodoroChange({ ...pomodoro, running: false, endsAt: undefined, remainingMs: pomodoro.durationMinutes * 60_000 });
      onWeeklyProgressChange(Math.min(99, weeklyProgress + 1));
    }
  }, [pomodoro.running, remaining]);

  function startPause() {
    if (pomodoro.running) {
      onPomodoroChange({ ...pomodoro, running: false, endsAt: undefined, remainingMs: remaining });
    } else {
      const duration = remaining > 0 ? remaining : pomodoro.durationMinutes * 60_000;
      onPomodoroChange({ ...pomodoro, running: true, remainingMs: duration, endsAt: new Date(Date.now() + duration).toISOString() });
    }
  }

  async function pasteNumber() {
    setClipboardMessage("");
    try {
      if (window.localStorage.getItem(CLIPBOARD_DISCLOSURE_KEY) !== "accepted") {
        if (!window.confirm(t("overview.status.clipboardDisclosure"))) return;
        window.localStorage.setItem(CLIPBOARD_DISCLOSURE_KEY, "accepted");
      }
      if (typeof chrome !== "undefined" && chrome.permissions && !(await chrome.permissions.request({ permissions: ["clipboardRead"] }))) {
        throw new Error(t("overview.status.clipboardDenied"));
      }
      const text = await navigator.clipboard.readText();
      const match = text.replace(/\s/g, "").match(/[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?/i);
      if (!match) throw new Error(t("overview.status.noNumber"));
      const value = match[0].replace(",", ".");
      setClipboardValue(value);
      window.dispatchEvent(new CustomEvent("benchtab:clipboard-number", { detail: value }));
      setClipboardMessage(t("overview.status.sentToCalculator"));
    } catch (error) {
      setClipboardMessage(error instanceof Error ? error.message : t("overview.status.clipboardDenied"));
    }
  }

  return (
    <div class="overview-status" aria-label={t("overview.status.aria")}>
      <section class="status-pomodoro">
        <span class="status-label">{t("overview.status.focus")}</span>
        <strong class="numeric">{formatTimer(remaining)}</strong>
        <button class="status-action" type="button" onClick={startPause}>{pomodoro.running ? t("overview.status.pause") : t("overview.status.start")}</button>
        <button class="status-action" type="button" onClick={() => onPomodoroChange({ ...pomodoro, running: false, endsAt: undefined, remainingMs: pomodoro.durationMinutes * 60_000 })}>{t("overview.status.reset")}</button>
        <select value={pomodoro.durationMinutes} onChange={(event) => { const durationMinutes = Number(event.currentTarget.value); onPomodoroChange({ durationMinutes, running: false, remainingMs: durationMinutes * 60_000 }); }} aria-label={t("overview.status.duration")}><option value="15">15</option><option value="25">25</option><option value="45">45</option><option value="60">60</option></select>
      </section>
      <section class="status-clipboard">
        <span class="status-label">{t("overview.status.clipboard")}</span>
        <button class="status-action" type="button" onClick={() => void pasteNumber()}>{t("overview.status.paste")}</button>
        {clipboardValue && <code>{clipboardValue}</code>}
        {clipboardMessage && <small role="status">{clipboardMessage}</small>}
      </section>
      <section class="status-indicators">
        <span><i class={`status-light ${online ? "status-light--ready" : "status-light--off"}`} />{online ? t("overview.status.online") : t("overview.status.offline")}</span>
        <span><i class={`status-light ${aiStatus === "ready" ? "status-light--ready" : "status-light--idle"}`} />{aiStatus === "checking" ? t("overview.status.aiChecking") : aiStatus === "ready" ? t("overview.status.aiReady") : t("overview.status.aiUnavailable")}</span>
        <button class="status-indicator-button" type="button" title={`${t("overview.status.saved")}: ${savedAt}`} onClick={onBackup}><i class={`status-light ${lastBackupAt ? "status-light--ready" : "status-light--idle"}`} />{lastBackupAt ? t("overview.status.backedUp") : t("overview.status.backupNow")}</button>
      </section>
      <section class="status-constant" title={constant.name}>
        <span class="status-label">{t("overview.status.constant")}</span>
        <strong>{constant.symbol}</strong><code>{constant.displayValue} {constant.unit}</code>
      </section>
      <section class="status-goal">
        <span class="status-label">{t("overview.status.weeklyGoal")}</span>
        <div><button type="button" onClick={() => onWeeklyProgressChange(Math.max(0, weeklyProgress - 1))}>−</button><progress value={weeklyProgress} max={weeklyGoal} /><button type="button" onClick={() => onWeeklyProgressChange(Math.min(99, weeklyProgress + 1))}>+</button></div>
        <span class="numeric">{weeklyProgress}/{weeklyGoal}</span>
        <label>{t("overview.status.target")}<input type="number" min="1" max="99" value={weeklyGoal} onInput={(event) => onWeeklyGoalChange(Math.max(1, Math.min(99, Number(event.currentTarget.value) || 1)))} /></label>
      </section>
    </div>
  );
}
