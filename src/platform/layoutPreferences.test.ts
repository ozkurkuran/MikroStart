import { describe, expect, it } from "vitest";

import {
  DEFAULT_DASHBOARD_LAYOUT,
  DEFAULT_MODULE_ORDER,
  MODULE_IDS,
  moveModule,
  moveModuleToIndex,
  normalizeDashboardLayout,
} from "./layoutPreferences";

describe("dashboard layout normalization", () => {
  it("starts with the research feed and keeps every calculation at the bottom", () => {
    expect(DEFAULT_DASHBOARD_LAYOUT.order).toEqual(DEFAULT_MODULE_ORDER);
    expect(DEFAULT_DASHBOARD_LAYOUT.order[0]).toBe("research-feed");
    expect(DEFAULT_DASHBOARD_LAYOUT.order.slice(-5)).toEqual([
      "bragg-spacing",
      "scherrer-size",
      "sheet-resistance",
      "hall-measurement",
      "vacuum-kinetics",
    ]);
    expect(new Set(DEFAULT_DASHBOARD_LAYOUT.order)).toEqual(new Set(MODULE_IDS));
  });

  it("migrates the untouched previous default without changing custom orders", () => {
    const migrated = normalizeDashboardLayout({ version: 2, order: [...MODULE_IDS], hidden: [] });
    expect(migrated.order).toEqual(DEFAULT_MODULE_ORDER);

    const custom = normalizeDashboardLayout({
      version: 2,
      order: ["lab-notebook", ...MODULE_IDS.filter((id) => id !== "lab-notebook")],
      hidden: [],
    });
    expect(custom.order[0]).toBe("lab-notebook");
  });

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
    expect(layout.version).toBe(3);
  });
});

describe("dashboard module ordering", () => {
  const layout = normalizeDashboardLayout({
    order: ["bragg-spacing", "research-feed", "stopwatch", "lab-notebook"],
    hidden: ["research-feed"],
  });

  it("moves a module relative to a target in the complete order", () => {
    const moved = moveModule(layout, "lab-notebook", "bragg-spacing", "before");

    expect(moved.order.slice(0, 4)).toEqual([
      "lab-notebook",
      "bragg-spacing",
      "research-feed",
      "stopwatch",
    ]);
    expect(moved.hidden).toEqual(["research-feed"]);
  });

  it("preserves filtered-out modules while moving after a visible target", () => {
    const moved = moveModule(layout, "bragg-spacing", "stopwatch", "after");

    expect(moved.order.slice(0, 4)).toEqual([
      "research-feed",
      "stopwatch",
      "bragg-spacing",
      "lab-notebook",
    ]);
  });

  it("returns the original layout for invalid and no-op moves", () => {
    expect(moveModule(layout, "bragg-spacing", "bragg-spacing", "before")).toBe(layout);
    expect(moveModule(layout, "bragg-spacing", "research-feed", "before")).toBe(layout);
  });

  it("moves a module to a clamped absolute position", () => {
    const first = moveModuleToIndex(layout, "lab-notebook", -10);
    expect(first.order[0]).toBe("lab-notebook");

    const last = moveModuleToIndex(first, "lab-notebook", 10_000);
    expect(last.order.at(-1)).toBe("lab-notebook");

    expect(moveModuleToIndex(layout, "stopwatch", Number.NaN)).toBe(layout);
  });
});
