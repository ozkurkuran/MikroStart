import type { Countdown } from "./countdown";
import { EMPTY_STOPWATCH, type StopwatchLap, type StopwatchState } from "./stopwatch";

export const WORKFLOW_STORAGE_KEY = "benchtab.workflows.v1";

/** Compatible with localStorage, but deliberately injected by the host shell. */
export interface WorkflowStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface WorkflowState {
  countdowns: Countdown[];
  stopwatch: StopwatchState;
  soundEnabled: boolean;
  recentSampleIds: string[];
  quickNotes: string[];
}

export const EMPTY_WORKFLOW_STATE: WorkflowState = {
  countdowns: [],
  stopwatch: EMPTY_STOPWATCH,
  soundEnabled: false,
  recentSampleIds: [],
  quickNotes: [],
};

function isCountdown(value: unknown): value is Countdown {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Countdown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.targetAt === "string" &&
    typeof candidate.durationMs === "number" &&
    Number.isFinite(candidate.durationMs) &&
    Number.isFinite(Date.parse(candidate.targetAt))
  );
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.length <= maxLength)
        .slice(0, maxItems)
    : [];
}

function isStopwatchLap(value: unknown): value is StopwatchLap {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StopwatchLap>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.recordedAt === "string" &&
    Number.isFinite(Date.parse(candidate.recordedAt)) &&
    typeof candidate.elapsedMs === "number" &&
    Number.isFinite(candidate.elapsedMs) &&
    candidate.elapsedMs >= 0 &&
    typeof candidate.splitMs === "number" &&
    Number.isFinite(candidate.splitMs) &&
    candidate.splitMs >= 0
  );
}

function safeStopwatch(value: unknown): StopwatchState {
  if (!value || typeof value !== "object") return { ...EMPTY_STOPWATCH, laps: [] };
  const candidate = value as Partial<StopwatchState>;
  const accumulatedMs =
    typeof candidate.accumulatedMs === "number" &&
    Number.isFinite(candidate.accumulatedMs) &&
    candidate.accumulatedMs >= 0
      ? candidate.accumulatedMs
      : 0;
  const startedAt =
    typeof candidate.startedAt === "string" && Number.isFinite(Date.parse(candidate.startedAt))
      ? candidate.startedAt
      : undefined;
  const running = candidate.running === true && Boolean(startedAt);
  return {
    running,
    accumulatedMs,
    startedAt: running ? startedAt : undefined,
    laps: Array.isArray(candidate.laps)
      ? candidate.laps.filter(isStopwatchLap).slice(0, 100)
      : [],
  };
}

export function loadWorkflowState(
  storage: WorkflowStorage,
  key = WORKFLOW_STORAGE_KEY,
): WorkflowState {
  const serialized = storage.getItem(key);
  if (!serialized) return { ...EMPTY_WORKFLOW_STATE };
  try {
    const parsed = JSON.parse(serialized) as Partial<WorkflowState>;
    return {
      countdowns: Array.isArray(parsed.countdowns)
        ? parsed.countdowns.filter(isCountdown).slice(0, 50)
        : [],
      stopwatch: safeStopwatch(parsed.stopwatch),
      soundEnabled: parsed.soundEnabled === true,
      recentSampleIds: stringArray(parsed.recentSampleIds, 100, 160),
      quickNotes: stringArray(parsed.quickNotes, 100, 2_100),
    };
  } catch {
    return { ...EMPTY_WORKFLOW_STATE };
  }
}

export function saveWorkflowState(
  storage: WorkflowStorage,
  state: WorkflowState,
  key = WORKFLOW_STORAGE_KEY,
): void {
  storage.setItem(
    key,
    JSON.stringify({
      countdowns: state.countdowns.slice(0, 50),
      stopwatch: { ...state.stopwatch, laps: state.stopwatch.laps.slice(0, 100) },
      soundEnabled: state.soundEnabled,
      recentSampleIds: state.recentSampleIds.slice(0, 100),
      quickNotes: state.quickNotes.slice(0, 100),
    } satisfies WorkflowState),
  );
}

export function createMemoryWorkflowStorage(
  seed: Readonly<Record<string, string>> = {},
): WorkflowStorage {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}
