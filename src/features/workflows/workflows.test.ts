import { describe, expect, it } from "vitest";

import {
  WORKFLOW_STORAGE_KEY,
  countdownSnapshot,
  createCountdown,
  createMemoryWorkflowStorage,
  createTimestampedQuickNote,
  formatRemainingTime,
  formatStopwatchTime,
  generateSampleId,
  generateUniqueSampleId,
  loadWorkflowState,
  restartCountdown,
  pauseStopwatch,
  recordStopwatchLap,
  saveWorkflowState,
  startStopwatch,
  stopwatchElapsedMs,
} from ".";

const START = Date.parse("2026-08-24T09:00:00.000Z");

describe("countdown time math", () => {
  it("calculates progress and clamps before/after the configured interval", () => {
    const countdown = createCountdown(
      { id: "anneal", label: "Anneal", durationMs: 60_000 },
      START,
    );
    expect(countdownSnapshot(countdown, START - 1_000)).toMatchObject({
      elapsedMs: 0,
      remainingMs: 60_000,
      progress: 0,
      expired: false,
    });
    expect(countdownSnapshot(countdown, START + 15_000)).toMatchObject({
      elapsedMs: 15_000,
      remainingMs: 45_000,
      progress: 0.25,
      expired: false,
    });
    expect(countdownSnapshot(countdown, START + 70_000)).toMatchObject({
      elapsedMs: 60_000,
      remainingMs: 0,
      progress: 1,
      expired: true,
    });
  });

  it("restarts without changing identity or duration", () => {
    const original = createCountdown(
      { id: "deposition", label: "Deposition", durationMs: 90_000 },
      START,
    );
    const restarted = restartCountdown(original, START + 30_000);
    expect(restarted.id).toBe(original.id);
    expect(restarted.targetAt).toBe("2026-08-24T09:02:00.000Z");
    expect(formatRemainingTime(90_001)).toBe("00:01:31");
    expect(formatRemainingTime(86_400_000)).toBe("1d 00:00:00");
  });

  it("rejects durations outside the documented range", () => {
    expect(() => createCountdown({ label: "Bad", durationMs: 999 }, START)).toThrow(
      RangeError,
    );
  });
});

describe("sample identifiers", () => {
  const deterministic = () => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8]);

  it("creates a sanitized, readable, deterministic shape with injected entropy", () => {
    expect(
      generateSampleId({
        prefix: "Thin film / SEM",
        now: START,
        randomBytes: deterministic,
      }),
    ).toBe("THIN-FILM-SEM-20260824-AMBER-BEAM-081G81860W");
  });

  it("rejects a repeated candidate after bounded retries", () => {
    const duplicate = generateSampleId({ now: START, randomBytes: deterministic });
    expect(() =>
      generateUniqueSampleId([duplicate], { now: START, randomBytes: deterministic }),
    ).toThrow(/eight attempts/);
  });
});

describe("stopwatch time math", () => {
  it("continues from accumulated time across start and pause", () => {
    const started = startStopwatch(
      { running: false, accumulatedMs: 5_000, laps: [] },
      START,
    );
    expect(stopwatchElapsedMs(started, START + 1_250)).toBe(6_250);
    const paused = pauseStopwatch(started, START + 1_250);
    expect(paused).toMatchObject({ running: false, accumulatedMs: 6_250 });
    expect(formatStopwatchTime(paused.accumulatedMs)).toBe("00:00:06.2");
  });

  it("records lap split and total times", () => {
    let stopwatch = startStopwatch(
      { running: false, accumulatedMs: 0, laps: [] },
      START,
    );
    stopwatch = recordStopwatchLap(stopwatch, START + 2_000);
    stopwatch = recordStopwatchLap(stopwatch, START + 5_500);
    expect(stopwatch.laps[0]).toMatchObject({ elapsedMs: 5_500, splitMs: 3_500 });
    expect(stopwatch.laps[1]).toMatchObject({ elapsedMs: 2_000, splitMs: 2_000 });
  });
});

describe("timestamped notes and persistence", () => {
  it("generates UTC, single-line timestamp prefixes without changing note text", () => {
    expect(createTimestampedQuickNote("  chamber stable  ", START)).toBe(
      "[2026-08-24T09:00:00.000Z] chamber stable",
    );
  });

  it("round-trips valid workflow data through an injected local-storage interface", () => {
    const storage = createMemoryWorkflowStorage();
    const state = {
      countdowns: [
        createCountdown({ id: "one", label: "One", durationMs: 5_000 }, START),
      ],
      stopwatch: {
        running: false,
        accumulatedMs: 12_300,
        laps: [],
      },
      soundEnabled: true,
      recentSampleIds: ["LAB-20260824-AMBER-BEAM-081G81860W"],
      quickNotes: [createTimestampedQuickNote("ready", START)],
    };
    saveWorkflowState(storage, state);
    expect(storage.getItem(WORKFLOW_STORAGE_KEY)).toContain('"countdowns"');
    expect(loadWorkflowState(storage)).toEqual(state);
  });

  it("recovers safely from corrupt storage", () => {
    const storage = createMemoryWorkflowStorage({ [WORKFLOW_STORAGE_KEY]: "not-json" });
    expect(loadWorkflowState(storage)).toEqual({
      countdowns: [],
      stopwatch: { running: false, accumulatedMs: 0, laps: [] },
      soundEnabled: false,
      recentSampleIds: [],
      quickNotes: [],
    });
  });
});
