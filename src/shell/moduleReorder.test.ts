import { describe, expect, it } from "vitest";

import { resolveDropTarget, type ModuleBounds } from "./moduleReorder";

const grid: ModuleBounds[] = [
  { id: "bragg-spacing", left: 0, top: 0, right: 100, bottom: 120 },
  { id: "research-feed", left: 120, top: 0, right: 220, bottom: 240 },
  { id: "stopwatch", left: 0, top: 140, right: 100, bottom: 240 },
];

describe("module drop target geometry", () => {
  it("uses horizontal edges in a multi-column board", () => {
    expect(resolveDropTarget({ x: 126, y: 80 }, grid, "stopwatch")).toEqual({
      targetId: "research-feed",
      placement: "before",
      edge: "left",
    });
    expect(resolveDropTarget({ x: 214, y: 80 }, grid, "stopwatch")).toEqual({
      targetId: "research-feed",
      placement: "after",
      edge: "right",
    });
  });

  it("uses vertical edges near the top and bottom of a card", () => {
    expect(resolveDropTarget({ x: 170, y: 4 }, grid, "stopwatch")?.edge).toBe("top");
    expect(resolveDropTarget({ x: 170, y: 236 }, grid, "stopwatch")?.edge).toBe("bottom");
  });

  it("selects the nearest card when the pointer is in a masonry gap", () => {
    expect(resolveDropTarget({ x: 108, y: 60 }, grid, "stopwatch")?.targetId).toBe(
      "bragg-spacing",
    );
  });

  it("uses vertical placement in a single-column layout", () => {
    const list: ModuleBounds[] = [
      { id: "bragg-spacing", left: 0, top: 0, right: 300, bottom: 100 },
      { id: "research-feed", left: 0, top: 120, right: 300, bottom: 220 },
    ];

    expect(resolveDropTarget({ x: 10, y: 150 }, list, "bragg-spacing")).toEqual({
      targetId: "research-feed",
      placement: "before",
      edge: "top",
    });
    expect(resolveDropTarget({ x: 290, y: 200 }, list, "bragg-spacing")).toEqual({
      targetId: "research-feed",
      placement: "after",
      edge: "bottom",
    });
  });

  it("returns no target when no other visible module exists", () => {
    expect(resolveDropTarget({ x: 50, y: 50 }, grid.slice(0, 1), "bragg-spacing")).toBeUndefined();
  });
});
