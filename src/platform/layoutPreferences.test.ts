import { describe, expect, it } from "vitest";

import {
  MODULE_IDS,
  normalizeDashboardLayout,
} from "./layoutPreferences";

describe("dashboard layout normalization", () => {
  it("preserves known order and appends newly introduced modules", () => {
    const layout = normalizeDashboardLayout({
      order: ["lab-notebook", "research-feed", "unknown", "research-feed"],
      hidden: ["bragg-spacing", "unknown"],
    });
    expect(layout.order.slice(0, 2)).toEqual(["lab-notebook", "research-feed"]);
    expect(new Set(layout.order)).toEqual(new Set(MODULE_IDS));
    expect(layout.hidden).toEqual(["bragg-spacing"]);
  });

  it("expands composite v1 modules without losing their order or hidden state", () => {
    const layout = normalizeDashboardLayout({
      version: 1,
      order: ["research-feed", "workflow-tools", "lab-calculators"],
      hidden: ["workflow-tools"],
    });
    expect(layout.order.slice(0, 9)).toEqual([
      "research-feed",
      "countdown-timers",
      "stopwatch",
      "sample-id",
      "quick-note",
      "scherrer-size",
      "sheet-resistance",
      "hall-measurement",
      "vacuum-kinetics",
    ]);
    expect(layout.hidden).toEqual([
      "countdown-timers",
      "stopwatch",
      "sample-id",
      "quick-note",
    ]);
    expect(layout.version).toBe(2);
  });
});
