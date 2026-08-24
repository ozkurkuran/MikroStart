import type { Countdown } from "./countdown";

async function send(message: unknown): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
  const response = (await chrome.runtime.sendMessage(message)) as
    | { ok: true }
    | { ok: false; error: string }
    | undefined;
  if (response && !response.ok) throw new Error(response.error);
}

export function scheduleCountdownAlarm(countdown: Countdown): Promise<void> {
  return send({
    type: "SCHEDULE_COUNTDOWN_ALARM",
    countdownId: countdown.id,
    targetAt: countdown.targetAt,
  });
}

export function cancelCountdownAlarm(countdownId: string): Promise<void> {
  return send({ type: "CANCEL_COUNTDOWN_ALARM", countdownId });
}

export function cancelAllCountdownAlarms(): Promise<void> {
  return send({ type: "CANCEL_ALL_COUNTDOWN_ALARMS" });
}

export function playAlarmPreview(): Promise<void> {
  return send({ type: "PLAY_ALARM_PREVIEW" });
}
