import { describe, expect, it } from "vitest";

import { DEFAULT_DASHBOARD_LAYOUT } from "./layoutPreferences";
import { activateWorkspace, addWorkspace, normalizeWorkspaceState, removeWorkspace, updateActiveWorkspaceLayout } from "./workspaceStore";

describe("workspaceStore", () => {
  it("creates a safe default and normalizes malformed records", () => {
    const state = normalizeWorkspaceState({ activeId: "missing", workspaces: [{ id: "x", name: "  XRD  ", layout: { order: ["bragg-spacing"], hidden: [] } }, { id: "x", name: "duplicate" }] });
    expect(state.activeId).toBe("x");
    expect(state.workspaces).toHaveLength(1);
    expect(state.workspaces[0].name).toBe("XRD");
    expect(state.workspaces[0].layout.order).toHaveLength(DEFAULT_DASHBOARD_LAYOUT.order.length);
  });

  it("adds, activates, updates and removes workspaces without losing layouts", () => {
    const initial = normalizeWorkspaceState(undefined);
    const added = addWorkspace(initial, "Vacuum", DEFAULT_DASHBOARD_LAYOUT, "vacuum");
    const active = activateWorkspace(added, "vacuum");
    const updated = updateActiveWorkspaceLayout(active, { ...DEFAULT_DASHBOARD_LAYOUT, hidden: ["periodic-table"] });
    expect(updated.workspaces.find((workspace) => workspace.id === "vacuum")?.layout.hidden).toEqual(["periodic-table"]);
    expect(removeWorkspace(updated, "vacuum").activeId).toBe("main");
  });
});
