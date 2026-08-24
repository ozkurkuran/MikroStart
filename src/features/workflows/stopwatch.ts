export const MAX_STOPWATCH_LAPS = 100;

export interface StopwatchLap {
  id: string;
  recordedAt: string;
  elapsedMs: number;
  splitMs: number;
}

export interface StopwatchState {
  running: boolean;
  accumulatedMs: number;
  startedAt?: string;
  laps: StopwatchLap[];
}

export const EMPTY_STOPWATCH: StopwatchState = {
  running: false,
  accumulatedMs: 0,
  laps: [],
};

function validNow(value: Date | number | string): number {
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) throw new RangeError("A valid stopwatch time is required.");
  return milliseconds;
}

export function stopwatchElapsedMs(
  stopwatch: StopwatchState,
  now: Date | number | string = Date.now(),
): number {
  const runningMs = stopwatch.running && stopwatch.startedAt
    ? Math.max(0, validNow(now) - validNow(stopwatch.startedAt))
    : 0;
  return Math.max(0, stopwatch.accumulatedMs + runningMs);
}

export function startStopwatch(
  stopwatch: StopwatchState,
  now: Date | number | string = Date.now(),
): StopwatchState {
  if (stopwatch.running) return stopwatch;
  return {
    ...stopwatch,
    running: true,
    startedAt: new Date(validNow(now)).toISOString(),
  };
}

export function pauseStopwatch(
  stopwatch: StopwatchState,
  now: Date | number | string = Date.now(),
): StopwatchState {
  if (!stopwatch.running) return stopwatch;
  return {
    ...stopwatch,
    running: false,
    accumulatedMs: stopwatchElapsedMs(stopwatch, now),
    startedAt: undefined,
  };
}

export function resetStopwatch(): StopwatchState {
  return { ...EMPTY_STOPWATCH, laps: [] };
}

export function recordStopwatchLap(
  stopwatch: StopwatchState,
  now: Date | number | string = Date.now(),
): StopwatchState {
  const nowMs = validNow(now);
  const elapsedMs = stopwatchElapsedMs(stopwatch, nowMs);
  const previousElapsedMs = stopwatch.laps[0]?.elapsedMs ?? 0;
  const lap: StopwatchLap = {
    id: `lap-${nowMs.toString(36)}-${stopwatch.laps.length + 1}`,
    recordedAt: new Date(nowMs).toISOString(),
    elapsedMs,
    splitMs: Math.max(0, elapsedMs - previousElapsedMs),
  };
  return { ...stopwatch, laps: [lap, ...stopwatch.laps].slice(0, MAX_STOPWATCH_LAPS) };
}

export function formatStopwatchTime(milliseconds: number): string {
  const safe = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  const totalTenths = Math.floor(safe / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}
