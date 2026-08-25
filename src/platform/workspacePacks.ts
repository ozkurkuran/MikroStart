import { DEFAULT_DASHBOARD_LAYOUT, normalizeDashboardLayout, type DashboardLayout, type ModuleId } from "./layoutPreferences";
import type { WorkspaceRecord } from "./workspaceStore";

export interface WorkspacePack {
  schema: "benchtab.workspace-pack";
  version: 1;
  id: string;
  name: string;
  description: string;
  layout: DashboardLayout;
}

function layoutWithVisible(visible: readonly ModuleId[], order: readonly ModuleId[]): DashboardLayout {
  const completeOrder = [...order, ...DEFAULT_DASHBOARD_LAYOUT.order.filter((id) => !order.includes(id))];
  return { version: 2, order: completeOrder, hidden: DEFAULT_DASHBOARD_LAYOUT.order.filter((id) => !visible.includes(id)) };
}

export const BUILT_IN_WORKSPACE_PACKS: readonly WorkspacePack[] = [
  {
    schema: "benchtab.workspace-pack", version: 1, id: "xrd", name: "XRD", description: "Diffraction, crystallite size, references and notes.",
    layout: layoutWithVisible(["bragg-spacing", "scherrer-size", "research-feed", "periodic-table", "codata-constants", "quick-note", "lab-notebook"], ["bragg-spacing", "scherrer-size", "research-feed", "periodic-table", "codata-constants", "quick-note", "lab-notebook"]),
  },
  {
    schema: "benchtab.workspace-pack", version: 1, id: "vacuum", name: "Vacuum", description: "Vacuum kinetics, timers, sample IDs and run notes.",
    layout: layoutWithVisible(["vacuum-kinetics", "countdown-timers", "stopwatch", "sample-id", "quick-note", "lab-notebook"], ["vacuum-kinetics", "countdown-timers", "stopwatch", "sample-id", "quick-note", "lab-notebook"]),
  },
  {
    schema: "benchtab.workspace-pack", version: 1, id: "thesis", name: "Thesis writing", description: "Literature, local AI, language tools, references and notebook.",
    layout: layoutWithVisible(["research-feed", "on-device-ai", "translation-tools", "tureng-dictionary", "codata-constants", "quick-note", "lab-notebook"], ["research-feed", "on-device-ai", "translation-tools", "tureng-dictionary", "codata-constants", "quick-note", "lab-notebook"]),
  },
];

export function parseWorkspacePack(input: string | unknown): WorkspacePack {
  let value: unknown = input;
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).byteLength > 256 * 1024) throw new Error("The workspace pack is larger than 256 KB.");
    try { value = JSON.parse(input); } catch { throw new Error("The workspace pack is not valid JSON."); }
  }
  if (typeof value !== "object" || value === null) throw new Error("The workspace pack is invalid.");
  const record = value as Partial<WorkspacePack>;
  if (record.schema !== "benchtab.workspace-pack" || record.version !== 1) throw new Error("The workspace pack schema is not supported.");
  const id = typeof record.id === "string" ? record.id.trim().slice(0, 128) : "";
  const name = typeof record.name === "string" ? record.name.trim().slice(0, 80) : "";
  const description = typeof record.description === "string" ? record.description.trim().slice(0, 240) : "";
  if (!id || !name) throw new Error("The workspace pack metadata is incomplete.");
  return { schema: "benchtab.workspace-pack", version: 1, id, name, description, layout: normalizeDashboardLayout(record.layout) };
}

export function workspaceToPack(workspace: WorkspaceRecord): WorkspacePack {
  return { schema: "benchtab.workspace-pack", version: 1, id: workspace.id, name: workspace.name, description: "Exported from BenchTab. Contains layout data only.", layout: workspace.layout };
}
