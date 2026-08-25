export const MODULE_IDS = [
  "bragg-spacing",
  "scherrer-size",
  "sheet-resistance",
  "hall-measurement",
  "vacuum-kinetics",
  "research-feed",
  "source-monitor",
  "on-device-ai",
  "translation-tools",
  "tureng-dictionary",
  "codata-constants",
  "periodic-table",
  "component-series",
  "countdown-timers",
  "stopwatch",
  "sample-id",
  "quick-note",
  "lab-notebook",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export interface DashboardLayout {
  version: 2;
  order: ModuleId[];
  hidden: ModuleId[];
}

export type ModulePlacement = "before" | "after";

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 2,
  order: [...MODULE_IDS],
  hidden: [],
};

const STORAGE_KEY = "dashboard.layout.v2";
const LEGACY_STORAGE_KEY = "dashboard.layout.v1";

const LEGACY_EXPANSIONS: Readonly<Record<string, readonly ModuleId[]>> = {
  "lab-calculators": ["scherrer-size", "sheet-resistance", "hall-measurement", "vacuum-kinetics"],
  "language-tools": ["translation-tools", "tureng-dictionary"],
  "scientific-references": ["codata-constants", "periodic-table", "component-series"],
  "workflow-tools": ["countdown-timers", "stopwatch", "sample-id", "quick-note"],
};

function expandedModuleIds(value: unknown, known: ReadonlySet<string>): ModuleId[] {
  if (!Array.isArray(value)) return [];
  const expanded: ModuleId[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const replacements = LEGACY_EXPANSIONS[candidate] ?? (known.has(candidate) ? [candidate as ModuleId] : []);
    for (const replacement of replacements) {
      if (!expanded.includes(replacement)) expanded.push(replacement);
    }
  }
  return expanded;
}

export function normalizeDashboardLayout(value: unknown): DashboardLayout {
  if (typeof value !== "object" || value === null) return DEFAULT_DASHBOARD_LAYOUT;
  const candidate = value as { order?: unknown; hidden?: unknown };
  const known = new Set<string>(MODULE_IDS);
  const order = expandedModuleIds(candidate.order, known);
  for (const id of MODULE_IDS) {
    if (!order.includes(id)) order.push(id);
  }
  const hidden = expandedModuleIds(candidate.hidden, known);
  return { version: 2, order, hidden };
}

export async function loadDashboardLayout(): Promise<DashboardLayout> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return DEFAULT_DASHBOARD_LAYOUT;
  }
  const result = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  return normalizeDashboardLayout(result[STORAGE_KEY] ?? result[LEGACY_STORAGE_KEY]);
}

export async function saveDashboardLayout(layout: DashboardLayout): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: normalizeDashboardLayout(layout) });
}

function withModuleOrder(layout: DashboardLayout, order: ModuleId[]): DashboardLayout {
  if (order.every((id, index) => layout.order[index] === id)) return layout;
  return { ...layout, order };
}

/** Moves one module relative to another without disturbing hidden modules. */
export function moveModule(
  layout: DashboardLayout,
  draggedId: ModuleId,
  targetId: ModuleId,
  placement: ModulePlacement,
): DashboardLayout {
  if (draggedId === targetId) return layout;
  if (!layout.order.includes(draggedId) || !layout.order.includes(targetId)) return layout;

  const order = layout.order.filter((id) => id !== draggedId);
  const targetIndex = order.indexOf(targetId);
  order.splice(targetIndex + (placement === "after" ? 1 : 0), 0, draggedId);
  return withModuleOrder(layout, order);
}

/** Moves a module to an absolute position, clamping out-of-range input. */
export function moveModuleToIndex(
  layout: DashboardLayout,
  draggedId: ModuleId,
  requestedIndex: number,
): DashboardLayout {
  const sourceIndex = layout.order.indexOf(draggedId);
  if (sourceIndex < 0) return layout;

  const order = layout.order.filter((id) => id !== draggedId);
  const finiteIndex = Number.isFinite(requestedIndex) ? Math.trunc(requestedIndex) : sourceIndex;
  const targetIndex = Math.max(0, Math.min(finiteIndex, order.length));
  order.splice(targetIndex, 0, draggedId);
  return withModuleOrder(layout, order);
}
