import { useState } from "preact/hooks";

import { useTranslate } from "../platform/i18n";
import {
  activateWorkspace,
  activeWorkspace,
  addWorkspace,
  removeWorkspace,
  renameWorkspace,
  type WorkspaceState,
} from "../platform/workspaceStore";
import {
  BUILT_IN_WORKSPACE_PACKS,
  parseWorkspacePack,
  workspaceToPack,
} from "../platform/workspacePacks";

interface WorkspaceSwitcherProps {
  state: WorkspaceState;
  onChange: (state: WorkspaceState) => void;
}

function downloadPack(state: WorkspaceState): void {
  const workspace = activeWorkspace(state);
  const blob = new Blob([JSON.stringify(workspaceToPack(workspace), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `benchtab-workspace-${workspace.name.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pack"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function WorkspaceSwitcher({ state, onChange }: WorkspaceSwitcherProps) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>();
  const current = activeWorkspace(state);

  function create(nameValue: string, layout = current.layout) {
    try {
      const next = addWorkspace(state, nameValue, layout);
      onChange(next);
      setName("");
      setStatus(t("workspaces.created"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("workspaces.failed"));
    }
  }

  async function importPack(file: File) {
    try {
      const pack = parseWorkspacePack(await file.text());
      create(pack.name, pack.layout);
      setStatus(t("workspaces.imported"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("workspaces.importFailed"));
    }
  }

  return (
    <div class="workspace-switcher">
      <label class="sr-only" for="workspace-select">{t("workspaces.select")}</label>
      <select id="workspace-select" value={state.activeId} onChange={(event) => onChange(activateWorkspace(state, event.currentTarget.value))}>
        {state.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
      </select>
      <button class="button button--quiet" type="button" onClick={() => setOpen(true)}>{t("workspaces.manage")}</button>

      {open && <div class="workspace-manager" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}>
        <section role="dialog" aria-modal="true" aria-label={t("workspaces.title")}>
          <header><div><p class="overline">{t("workspaces.localOnly")}</p><h2>{t("workspaces.title")}</h2></div><button type="button" aria-label={t("workspaces.close")} onClick={() => setOpen(false)}>×</button></header>

          <div class="workspace-manager__current">
            <label>{t("workspaces.rename")}<input value={current.name} maxlength={80} onInput={(event) => onChange(renameWorkspace(state, current.id, event.currentTarget.value || current.name))} /></label>
            <div>
              <button class="button button--small" type="button" onClick={() => downloadPack(state)}>{t("workspaces.export")}</button>
              <label class="button button--small import-label">{t("workspaces.import")}<input type="file" accept="application/json,.json" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void importPack(file);
                event.currentTarget.value = "";
              }} /></label>
              <button class="button button--small button--danger" type="button" disabled={state.workspaces.length <= 1} onClick={() => onChange(removeWorkspace(state, current.id))}>{t("workspaces.remove")}</button>
            </div>
          </div>

          <form class="workspace-manager__new" onSubmit={(event) => { event.preventDefault(); create(name); }}>
            <label>{t("workspaces.newName")}<input required maxlength={80} value={name} onInput={(event) => setName(event.currentTarget.value)} placeholder={t("workspaces.newPlaceholder")} /></label>
            <button class="button button--primary" type="submit">{t("workspaces.create")}</button>
          </form>

          <div class="workspace-packs">
            <p class="overline">{t("workspaces.packs")}</p>
            <p>{t("workspaces.packsHelp")}</p>
            <div>{BUILT_IN_WORKSPACE_PACKS.map((pack) => <button type="button" key={pack.id} onClick={() => create(pack.name, pack.layout)}><strong>{pack.name}</strong><small>{pack.description}</small></button>)}</div>
          </div>
          {status && <p class="inline-status" role="status">{status}</p>}
        </section>
      </div>}
    </div>
  );
}
