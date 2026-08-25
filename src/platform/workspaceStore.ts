import {
  DEFAULT_DASHBOARD_LAYOUT,
  loadDashboardLayout,
  normalizeDashboardLayout,
  type DashboardLayout,
} from "./layoutPreferences";

export interface WorkspaceRecord {
  id: string;
  name: string;
  layout: DashboardLayout;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceState {
  version: 1;
  activeId: string;
  workspaces: WorkspaceRecord[];
}

const STORAGE_KEY = "workspaces.v1";
export const MAX_WORKSPACES = 12;

function validDate(value: unknown, fallback: string): string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback;
}

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

export function normalizeWorkspaceState(value: unknown, fallbackLayout = DEFAULT_DASHBOARD_LAYOUT): WorkspaceState {
  const now = new Date().toISOString();
  const raw = typeof value === "object" && value !== null ? value as Partial<WorkspaceState> : {};
  const workspaces: WorkspaceRecord[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.workspaces)) {
    for (const candidate of raw.workspaces.slice(0, MAX_WORKSPACES)) {
      if (typeof candidate !== "object" || candidate === null) continue;
      const record = candidate as Partial<WorkspaceRecord>;
      const id = typeof record.id === "string" ? record.id.slice(0, 128) : "";
      const name = cleanName(record.name);
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      const createdAt = validDate(record.createdAt, now);
      workspaces.push({
        id,
        name,
        layout: normalizeDashboardLayout(record.layout),
        createdAt,
        updatedAt: validDate(record.updatedAt, createdAt),
      });
    }
  }
  if (workspaces.length === 0) {
    workspaces.push({ id: "main", name: "Main workspace", layout: normalizeDashboardLayout(fallbackLayout), createdAt: now, updatedAt: now });
  }
  const activeId = typeof raw.activeId === "string" && workspaces.some((workspace) => workspace.id === raw.activeId)
    ? raw.activeId
    : workspaces[0].id;
  return { version: 1, activeId, workspaces };
}

export async function loadWorkspaceState(): Promise<WorkspaceState> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return normalizeWorkspaceState(undefined);
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (result[STORAGE_KEY]) return normalizeWorkspaceState(result[STORAGE_KEY]);
  const migrated = normalizeWorkspaceState(undefined, await loadDashboardLayout());
  await saveWorkspaceState(migrated);
  return migrated;
}

export async function saveWorkspaceState(state: WorkspaceState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: normalizeWorkspaceState(state) });
}

export function activeWorkspace(state: WorkspaceState): WorkspaceRecord {
  return state.workspaces.find((workspace) => workspace.id === state.activeId) ?? state.workspaces[0];
}

export function addWorkspace(
  state: WorkspaceState,
  name: string,
  layout = DEFAULT_DASHBOARD_LAYOUT,
  id: string = crypto.randomUUID(),
): WorkspaceState {
  if (state.workspaces.length >= MAX_WORKSPACES) throw new Error(`At most ${MAX_WORKSPACES} workspaces can be saved.`);
  const clean = cleanName(name);
  if (!clean) throw new Error("A workspace name is required.");
  if (!id || id.length > 128 || state.workspaces.some((workspace) => workspace.id === id)) throw new Error("The workspace identifier is invalid.");
  const now = new Date().toISOString();
  return normalizeWorkspaceState({
    version: 1,
    activeId: id,
    workspaces: [...state.workspaces, { id, name: clean, layout, createdAt: now, updatedAt: now }],
  });
}

export function renameWorkspace(state: WorkspaceState, id: string, name: string): WorkspaceState {
  const clean = cleanName(name);
  if (!clean) throw new Error("A workspace name is required.");
  return normalizeWorkspaceState({
    ...state,
    workspaces: state.workspaces.map((workspace) => workspace.id === id
      ? { ...workspace, name: clean, updatedAt: new Date().toISOString() }
      : workspace),
  });
}

export function removeWorkspace(state: WorkspaceState, id: string): WorkspaceState {
  if (state.workspaces.length <= 1) throw new Error("The last workspace cannot be removed.");
  const workspaces = state.workspaces.filter((workspace) => workspace.id !== id);
  return normalizeWorkspaceState({
    ...state,
    activeId: state.activeId === id ? workspaces[0].id : state.activeId,
    workspaces,
  });
}

export function activateWorkspace(state: WorkspaceState, id: string): WorkspaceState {
  if (!state.workspaces.some((workspace) => workspace.id === id)) return state;
  return { ...state, activeId: id };
}

export function updateActiveWorkspaceLayout(state: WorkspaceState, layout: DashboardLayout): WorkspaceState {
  return normalizeWorkspaceState({
    ...state,
    workspaces: state.workspaces.map((workspace) => workspace.id === state.activeId
      ? { ...workspace, layout: normalizeDashboardLayout(layout), updatedAt: new Date().toISOString() }
      : workspace),
  });
}
