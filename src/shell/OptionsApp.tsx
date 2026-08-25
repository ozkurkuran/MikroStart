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

export function OptionsApp() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState(false);
  const [hostOrigins, setHostOrigins] = useState<string[]>([]);
  const [dataStatus, setDataStatus] = useState<string>();

  // Live preview: the page re-renders in the picked language before saving.
  const t = useMemo(() => createTranslate(preferences.locale), [preferences.locale]);

  useEffect(() => {
    void loadPreferences().then(setPreferences);
    void chrome.permissions.getAll().then((permissions) =>
      setHostOrigins(permissions.origins ?? []),
    );
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
