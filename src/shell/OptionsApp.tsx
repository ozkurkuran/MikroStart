import { useEffect, useMemo, useState } from "preact/hooks";

import { createTranslate } from "../platform/i18n";

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type UserPreferences,
} from "../platform/preferences";
import { IndexedDbNotebookRepository } from "../features/notebook";
import { clearFeedCache } from "../platform/feedStore";
import { clearJobQueue } from "../platform/jobQueue";
import { cancelAllCountdownAlarms } from "../features/workflows";
import { applyThemePreference, THEMES, themeName } from "../platform/themes";
import {
  createFullBackup,
  downloadBackupEnvelope,
  loadBackupMeta,
  previewFullBackup,
  restoreFullBackup,
  type BenchTabBackupEnvelope,
  type BackupMeta,
  type FullBackupPreview,
} from "../platform/backup";
import {
  clearBackupSnapshots,
  listBackupSnapshots,
  type BackupSnapshot,
} from "../platform/backupSnapshots";

export function OptionsApp() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState(false);
  const [hostOrigins, setHostOrigins] = useState<string[]>([]);
  const [dataStatus, setDataStatus] = useState<string>();
  const [backupStatus, setBackupStatus] = useState<string>();
  const [backupMeta, setBackupMeta] = useState<BackupMeta>({});
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [backupPreview, setBackupPreview] = useState<FullBackupPreview>();
  const [pendingBackup, setPendingBackup] = useState<BenchTabBackupEnvelope>();
  const [backupBusy, setBackupBusy] = useState(false);

  // Live preview: the page re-renders in the picked language before saving.
  const t = useMemo(() => createTranslate(preferences.locale), [preferences.locale]);

  useEffect(() => {
    void loadPreferences().then(setPreferences);
    void chrome.permissions.getAll().then((permissions) =>
      setHostOrigins(permissions.origins ?? []),
    );
    void reloadBackupState();
  }, []);

  // The options page follows the same theme and language as the workbench.
  useEffect(() => {
    applyThemePreference(preferences.theme);
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.lang = preferences.locale;
  }, [preferences.locale]);

  function update<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function persist() {
    await savePreferences(preferences);
    setSaved(true);
  }

  async function reloadBackupState() {
    const [meta, nextSnapshots] = await Promise.all([loadBackupMeta(), listBackupSnapshots()]);
    setBackupMeta(meta);
    setSnapshots(nextSnapshots);
  }

  async function exportFullBackup() {
    setBackupBusy(true); setBackupStatus(undefined);
    try {
      const envelope = await createFullBackup();
      downloadBackupEnvelope(envelope);
      await reloadBackupState();
      setBackupStatus(t("backup.downloaded"));
    } catch (error) { setBackupStatus(error instanceof Error ? error.message : t("backup.failed")); }
    finally { setBackupBusy(false); }
  }

  async function inspectBackup(input: string | BenchTabBackupEnvelope) {
    setBackupBusy(true); setBackupStatus(undefined);
    const preview = await previewFullBackup(input);
    setBackupPreview(preview);
    setPendingBackup(preview.envelope);
    if (!preview.valid) setBackupStatus(preview.issues[0] ?? t("backup.invalid"));
    setBackupBusy(false);
  }

  async function applyBackup(mode: "merge" | "replace") {
    if (!pendingBackup) return;
    if (mode === "replace" && !window.confirm(t("backup.replaceConfirm"))) return;
    setBackupBusy(true); setBackupStatus(undefined);
    try {
      await restoreFullBackup(pendingBackup, mode);
      setBackupStatus(t("backup.restored"));
      setBackupPreview(undefined); setPendingBackup(undefined);
      await reloadBackupState();
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) { setBackupStatus(error instanceof Error ? error.message : t("backup.failed")); }
    finally { setBackupBusy(false); }
  }

  async function deleteAllLocalData() {
    if (
      !window.confirm(t("options.deleteConfirm"))
    ) {
      return;
    }

    const notebook = new IndexedDbNotebookRepository();
    try {
      await Promise.all([
        notebook.deleteAllData(),
        clearFeedCache(),
        clearJobQueue(),
        cancelAllCountdownAlarms(),
        clearBackupSnapshots(),
      ]);
      const permissions = await chrome.permissions.getAll();
      if (permissions.origins?.length) {
        await chrome.permissions.remove({ origins: permissions.origins });
      }
      const removablePermissions = (permissions.permissions ?? []).filter(
        (permission): permission is "clipboardRead" | "geolocation" | "notifications" =>
          permission === "clipboardRead" || permission === "geolocation" || permission === "notifications",
      );
      if (removablePermissions.length) {
        await chrome.permissions.remove({ permissions: removablePermissions });
      }
      window.localStorage.clear();
      await chrome.storage.local.clear();
      if (chrome.storage.sync) await chrome.storage.sync.clear();
      setPreferences(DEFAULT_PREFERENCES);
      setHostOrigins([]);
      setDataStatus(t("options.deleteDone"));
    } catch (error) {
      setDataStatus(error instanceof Error ? error.message : t("options.deleteFailed"));
    } finally {
      notebook.close();
    }
  }

  return (
    <main class="settings-page">
      <header class="settings-header">
        <a class="brand" href="/pages/dashboard.html">
          <span class="brand__mark" aria-hidden="true">B</span>
          <span><strong>{t("app.name")}</strong><small>{t("app.settingsTagline")}</small></span>
        </a>
      </header>

      <section class="settings-card">
        <p class="overline">{t("options.workspace")}</p>
        <h1>{t("options.preferences")}</h1>

        <label>
          {t("options.language")}
          <select
            value={preferences.locale}
            onChange={(event) => update("locale", event.currentTarget.value as "tr" | "en")}
          >
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </label>

        <label>
          {t("options.appearance")}
          <select
            value={preferences.theme}
            onChange={(event) => update("theme", event.currentTarget.value as UserPreferences["theme"])}
          >
            <option value="system">{t("options.themeSystem")}</option>
            <optgroup label={t("theme.light")}>
              {THEMES.filter((theme) => theme.group === "light").map((theme) => (
                <option value={theme.id} key={theme.id}>{themeName(t, theme.id)}</option>
              ))}
            </optgroup>
            <optgroup label={t("theme.dark")}>
              {THEMES.filter((theme) => theme.group === "dark").map((theme) => (
                <option value={theme.id} key={theme.id}>{themeName(t, theme.id)}</option>
              ))}
            </optgroup>
          </select>
        </label>

        <label class="check-row">
          <input
            type="checkbox"
            checked={preferences.compactCards}
            onChange={(event) => update("compactCards", event.currentTarget.checked)}
          />
          {t("options.compactCards")}
        </label>

        <div class="settings-actions">
          <button class="button button--primary" type="button" onClick={() => void persist()}>
            {t("options.save")}
          </button>
          {saved && <span role="status">{t("options.saved")}</span>}
        </div>
      </section>

      <section class="settings-card backup-center">
        <p class="overline">{t("backup.eyebrow")}</p>
        <h2>{t("backup.title")}</h2>
        <p>{t("backup.description")}</p>
        <div class={`backup-reminder${!backupMeta.lastBackupAt || Date.now() - Date.parse(backupMeta.lastBackupAt) > 7 * 86_400_000 ? " is-due" : ""}`}>
          <span>{backupMeta.lastBackupAt ? t("backup.last", { date: new Date(backupMeta.lastBackupAt).toLocaleString(preferences.locale) }) : t("backup.never")}</span>
          <button class="button button--primary" type="button" disabled={backupBusy} onClick={() => void exportFullBackup()}>{t("backup.download")}</button>
        </div>
        <p class="backup-boundary">{t("backup.boundary")}</p>

        <div class="backup-import">
          <label class="button button--quiet import-label">{t("backup.chooseFile")}<input type="file" accept="application/json,.json" onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void file.text().then(inspectBackup);
            event.currentTarget.value = "";
          }} /></label>
          <span>{t("backup.previewFirst")}</span>
        </div>

        {backupPreview?.valid && <section class="backup-preview">
          <header><div><p class="overline">{t("backup.preview")}</p><h3>{t("backup.previewReady")}</h3></div><button type="button" onClick={() => { setBackupPreview(undefined); setPendingBackup(undefined); }}>×</button></header>
          <dl>
            <div><dt>{t("backup.settingsCount")}</dt><dd>{backupPreview.counts.localKeys + backupPreview.counts.syncKeys + backupPreview.counts.browserValues}</dd></div>
            <div><dt>{t("backup.notesCount")}</dt><dd>{backupPreview.counts.notes}</dd></div>
            <div><dt>{t("backup.referencesCount")}</dt><dd>{backupPreview.counts.references}</dd></div>
            <div><dt>{t("backup.conflictsCount")}</dt><dd>{backupPreview.conflicts.length}</dd></div>
          </dl>
          {backupPreview.conflicts.length > 0 && <details><summary>{t("backup.showConflicts")}</summary><ul>{backupPreview.conflicts.slice(0, 50).map((conflict) => <li key={conflict}>{conflict}</li>)}</ul></details>}
          <div class="settings-actions"><button class="button" type="button" disabled={backupBusy || backupPreview.conflicts.length > 0} onClick={() => void applyBackup("merge")}>{t("backup.merge")}</button><button class="button button--danger" type="button" disabled={backupBusy} onClick={() => void applyBackup("replace")}>{t("backup.replace")}</button></div>
        </section>}

        <div class="backup-snapshots">
          <p class="overline">{t("backup.snapshots")}</p>
          {snapshots.length === 0 ? <p>{t("backup.noSnapshots")}</p> : <ul>{snapshots.map((snapshot) => <li key={snapshot.id}><span><strong>{new Date(snapshot.createdAt).toLocaleString(preferences.locale)}</strong><small>{t(`backup.reason.${snapshot.reason}`)} · {(snapshot.sizeBytes / 1024).toFixed(1)} KB</small></span><span><button type="button" onClick={() => downloadBackupEnvelope(snapshot.envelope)}>{t("backup.downloadSnapshot")}</button><button type="button" onClick={() => void inspectBackup(snapshot.envelope)}>{t("backup.previewSnapshot")}</button></span></li>)}</ul>}
        </div>
        {backupStatus && <p class="inline-status" role="status">{backupStatus}</p>}
      </section>

      <section class="settings-card settings-card--privacy">
        <p class="overline">{t("options.privacyCenter")}</p>
        <h2>{t("options.dataBoundaries")}</h2>
        <dl>
          <div><dt>{t("options.notebook")}</dt><dd>{t("options.notebookValue")}</dd></div>
          <div><dt>{t("options.telemetry")}</dt><dd>{t("options.none")}</dd></div>
          <div><dt>{t("options.sourceAccess")}</dt><dd>{t("options.sourceAccessValue")}</dd></div>
          <div><dt>{t("options.cloudAi")}</dt><dd>{t("options.disabled")}</dd></div>
          <div><dt>{t("options.grantedOrigins")}</dt><dd>{hostOrigins.length ? hostOrigins.join(", ") : t("options.none")}</dd></div>
        </dl>
        <p>
          <a
            href="https://github.com/ozkurkuran/MikroStart/blob/main/docs/PRIVACY.md"
            target="_blank"
            rel="noreferrer"
          >
            {t("options.privacyPolicy")}
          </a>
        </p>
        <div class="danger-zone">
          <div>
            <strong>{t("options.deleteTitle")}</strong>
            <p>{t("options.deleteBody")}</p>
          </div>
          <button class="button button--danger" type="button" onClick={() => void deleteAllLocalData()}>
            {t("options.deleteButton")}
          </button>
        </div>
        {dataStatus && <p class="inline-status" role="status">{dataStatus}</p>}
      </section>
    </main>
  );
}
