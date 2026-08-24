export const MIN_COUNTDOWN_DURATION_MS = 1_000;
export const MAX_COUNTDOWN_DURATION_MS = 365 * 24 * 60 * 60 * 1_000;

export interface Countdown {
  id: string;
  label: string;
  createdAt: string;
  targetAt: string;
  durationMs: number;
}

export interface CountdownSnapshot {
  nowMs: number;
  targetMs: number;
  remainingMs: number;
  elapsedMs: number;
  progress: number;
  expired: boolean;
}

function validTime(value: Date | number | string): number {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(time)) throw new RangeError("A valid date or timestamp is required.");
  return time;
}

function fallbackId(nowMs: number): string {
  return `countdown-${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCountdown(
  input: { label: string; durationMs: number; id?: string },
  now: Date | number | string = Date.now(),
): Countdown {
  const nowMs = validTime(now);
  if (
    !Number.isFinite(input.durationMs) ||
    input.durationMs < MIN_COUNTDOWN_DURATION_MS ||
    input.durationMs > MAX_COUNTDOWN_DURATION_MS
  ) {
    throw new RangeError("Countdown duration must be from one second through 365 days.");
  }
  const label = input.label.trim();
  if (label.length === 0 || label.length > 120) {
    throw new RangeError("Countdown label must contain 1–120 characters.");
  }

  return {
    id: input.id?.trim() || fallbackId(nowMs),
    label,
    createdAt: new Date(nowMs).toISOString(),
    targetAt: new Date(nowMs + input.durationMs).toISOString(),
    durationMs: input.durationMs,
  };
}

export function countdownSnapshot(
  countdown: Countdown,
  now: Date | number | string = Date.now(),
): CountdownSnapshot {
  const nowMs = validTime(now);
  const targetMs = validTime(countdown.targetAt);
  const durationMs = Math.max(MIN_COUNTDOWN_DURATION_MS, countdown.durationMs);
  const remainingMs = Math.min(durationMs, Math.max(0, targetMs - nowMs));
  const elapsedMs = Math.min(durationMs, Math.max(0, durationMs - remainingMs));

  return {
    nowMs,
    targetMs,
    remainingMs,
    elapsedMs,
    progress: Math.min(1, Math.max(0, elapsedMs / durationMs)),
    expired: remainingMs === 0,
  };
}

export function restartCountdown(
  countdown: Countdown,
  now: Date | number | string = Date.now(),
): Countdown {
  return createCountdown(
    { id: countdown.id, label: countdown.label, durationMs: countdown.durationMs },
    now,
  );
}

export function formatRemainingTime(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "00:00:00";
  const totalSeconds = Math.ceil(milliseconds / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  return days > 0 ? `${days}d ${clock}` : clock;
}
