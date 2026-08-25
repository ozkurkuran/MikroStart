import { describe, expect, it } from "vitest";

import { evaluateExpression, formatCalculation } from "./calculator";
import { exportIcs, monthGrid, parseIcs, type CalendarEvent } from "./calendar";
import { convertUnit } from "./units";
import { localLocationSuggestions, suitableOutdoorHours, type WeatherSnapshot } from "./weather";

describe("quick calculator", () => {
  it("evaluates arithmetic, functions, memory, factorial, and scientific notation", () => {
    expect(evaluateExpression("2 + 3 * 4")).toBe(14);
    expect(evaluateExpression("sin(30) + sqrt(9)", { angleMode: "deg" })).toBeCloseTo(3.5);
    expect(evaluateExpression("5! / 10 + mem", { memory: 2 })).toBe(14);
    expect(evaluateExpression("1e-3 * 2")).toBe(0.002);
    expect(formatCalculation(6.62607015e-34)).toContain("e-34");
  });

  it("rejects malformed or unsafe input", () => {
    expect(() => evaluateExpression("alert(1)")).toThrow();
    expect(() => evaluateExpression("171!")).toThrow();
    expect(() => evaluateExpression("2 +")) .toThrow();
  });
});

describe("unit converter", () => {
  it("handles linear and offset conversions", () => {
    expect(convertUnit(1, "length", "angstrom", "nm")).toBeCloseTo(0.1);
    expect(convertUnit(0, "temperature", "c", "k")).toBeCloseTo(273.15);
    expect(convertUnit(1, "pressure", "atm", "pa")).toBeCloseTo(101325);
  });
});

describe("research calendar", () => {
  const event: CalendarEvent = {
    id: "thin-film-run",
    title: "Thin film; run",
    date: "2026-08-25",
    time: "14:30",
    kind: "experiment",
    notes: "Chamber, stable",
  };

  it("builds a complete Monday-first six-week month grid", () => {
    const grid = monthGrid(new Date(2026, 7, 1));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
    expect(grid.some((date) => date.getMonth() === 7 && date.getDate() === 31)).toBe(true);
  });

  it("round-trips BenchTab events through iCalendar", () => {
    const text = exportIcs([event]);
    expect(text).toContain("SUMMARY:Thin film\\; run");
    expect(parseIcs(text)).toEqual([{ ...event, id: "thin-film-run@benchtab.local" }]);
  });
});

describe("weather summary", () => {
  it("offers Turkish province matches from the first typed character without network access", () => {
    expect(localLocationSuggestions("d").map((item) => item.label)).toContain("Denizli");
    expect(localLocationSuggestions("is").map((item) => item.label)).toContain("İstanbul");
  });

  it("groups comfortable low-rain hours", () => {
    const now = new Date("2026-08-25T08:00:00");
    const snapshot = {
      location: "Test",
      latitude: 0,
      longitude: 0,
      timezone: "UTC",
      fetchedAt: now.toISOString(),
      current: { temperature: 20, apparentTemperature: 20, humidity: 50, precipitation: 0, windSpeed: 5, code: 0 },
      days: [],
      hours: [
        { time: "2026-08-25T09:00", apparentTemperature: 20, precipitationProbability: 5, windSpeed: 4 },
        { time: "2026-08-25T10:00", apparentTemperature: 21, precipitationProbability: 10, windSpeed: 5 },
        { time: "2026-08-25T11:00", apparentTemperature: 21, precipitationProbability: 80, windSpeed: 5 },
        { time: "2026-08-25T13:00", apparentTemperature: 22, precipitationProbability: 0, windSpeed: 8 },
      ],
    } satisfies WeatherSnapshot;
    expect(suitableOutdoorHours(snapshot, now)).toEqual(["09:00–11:00", "13:00–14:00"]);
  });
});
