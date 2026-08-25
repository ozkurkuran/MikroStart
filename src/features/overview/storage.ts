import type { CalendarEvent } from "./calendar";
import type { WeatherSnapshot } from "./weather";

export interface CalculatorHistoryItem {
  expression: string;
  result: string;
}

export interface PomodoroState {
  durationMinutes: number;
  running: boolean;
  endsAt?: string;
  remainingMs: number;
}

export interface OverviewState {
  version: 1;
  collapsed: boolean;
  events: CalendarEvent[];
  weatherQuery: string;
  weather?: WeatherSnapshot;
  quickNote: string;
  calculatorHistory: CalculatorHistoryItem[];
  calculatorMemory: number;
  weeklyGoal: number;
  weeklyProgress: number;
  pomodoro: PomodoroState;
  savedAt: string;
  lastBackupAt?: string;
}

export const OVERVIEW_STORAGE_KEY = "benchtab.overview.v1";

export const EMPTY_OVERVIEW_STATE: OverviewState = {
  version: 1,
  collapsed: false,
  events: [],
  weatherQuery: "",
  quickNote: "",
  calculatorHistory: [],
  calculatorMemory: 0,
  weeklyGoal: 10,
  weeklyProgress: 0,
  pomodoro: { durationMinutes: 25, running: false, remainingMs: 25 * 60_000 },
  savedAt: new Date(0).toISOString(),
};

function validEvents(value: unknown): CalendarEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CalendarEvent => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<CalendarEvent>;
    return typeof candidate.id === "string" && typeof candidate.title === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(candidate.date ?? "") &&
      ["experiment", "meeting", "deadline", "personal"].includes(candidate.kind ?? "");
  }).slice(0, 500);
}

export function loadOverviewState(storage: Storage): OverviewState {
  try {
    const parsed = JSON.parse(storage.getItem(OVERVIEW_STORAGE_KEY) ?? "null") as Partial<OverviewState> | null;
    if (!parsed || parsed.version !== 1) return { ...EMPTY_OVERVIEW_STATE, pomodoro: { ...EMPTY_OVERVIEW_STATE.pomodoro } };
    return {
      ...EMPTY_OVERVIEW_STATE,
      ...parsed,
      version: 1,
      collapsed: parsed.collapsed === true,
      events: validEvents(parsed.events),
      weatherQuery: typeof parsed.weatherQuery === "string" ? parsed.weatherQuery.slice(0, 120) : "",
      weather: parsed.weather && typeof parsed.weather === "object" ? parsed.weather as WeatherSnapshot : undefined,
      quickNote: typeof parsed.quickNote === "string" ? parsed.quickNote.slice(0, 4000) : "",
      calculatorHistory: Array.isArray(parsed.calculatorHistory)
        ? parsed.calculatorHistory.filter((item) => item && typeof item.expression === "string" && typeof item.result === "string").slice(0, 20)
        : [],
      calculatorMemory: Number.isFinite(parsed.calculatorMemory) ? Number(parsed.calculatorMemory) : 0,
      weeklyGoal: Number.isFinite(parsed.weeklyGoal) ? Math.max(1, Math.min(99, Number(parsed.weeklyGoal))) : 10,
      weeklyProgress: Number.isFinite(parsed.weeklyProgress) ? Math.max(0, Math.min(99, Number(parsed.weeklyProgress))) : 0,
      pomodoro: {
        ...EMPTY_OVERVIEW_STATE.pomodoro,
        ...(parsed.pomodoro ?? {}),
      },
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : EMPTY_OVERVIEW_STATE.savedAt,
      lastBackupAt: typeof parsed.lastBackupAt === "string" && Number.isFinite(Date.parse(parsed.lastBackupAt)) ? parsed.lastBackupAt : undefined,
    };
  } catch {
    return { ...EMPTY_OVERVIEW_STATE, pomodoro: { ...EMPTY_OVERVIEW_STATE.pomodoro } };
  }
}

export function saveOverviewState(storage: Storage, value: OverviewState): OverviewState {
  const saved = { ...value, savedAt: new Date().toISOString() };
  storage.setItem(OVERVIEW_STORAGE_KEY, JSON.stringify(saved));
  return saved;
}
