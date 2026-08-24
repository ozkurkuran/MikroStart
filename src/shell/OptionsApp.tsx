import { useEffect, useState } from "preact/hooks";

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

export function OptionsApp() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState(false);
  const [hostOrigins, setHostOrigins] = useState<string[]>([]);
  const [dataStatus, setDataStatus] = useState<string>();

  useEffect(() => {
    void loadPreferences().then(setPreferences);
    void chrome.permissions.getAll().then((permissions) =>
      setHostOrigins(permissions.origins ?? []),
    );
  }, []);

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
      !window.confirm(
        "All BenchTab notes, references, feed cache, subscriptions, settings, and queued jobs will be deleted from this Chrome profile. Export a backup first if needed.",
      )
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
      window.localStorage.clear();
      await chrome.storage.local.clear();
      if (chrome.storage.sync) await chrome.storage.sync.clear();
      setPreferences(DEFAULT_PREFERENCES);
      setHostOrigins([]);
      setDataStatus("All BenchTab data and optional source permissions were removed.");
    } catch (error) {
      setDataStatus(error instanceof Error ? error.message : "Local data could not be deleted.");
    } finally {
      notebook.close();
    }
  }

  return (
    <main class="settings-page">
      <header class="settings-header">
        <a class="brand" href="/pages/dashboard.html">
          <span class="brand__mark" aria-hidden="true">B</span>
          <span><strong>BenchTab</strong><small>settings & privacy</small></span>
        </a>
      </header>

      <section class="settings-card">
        <p class="overline">WORKSPACE</p>
        <h1>Preferences</h1>

        <label>
          Language
          <select
            value={preferences.locale}
            onChange={(event) => update("locale", event.currentTarget.value as "tr" | "en")}
          >
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </label>

        <label>
          Appearance
          <select
            value={preferences.theme}
            onChange={(event) => update("theme", event.currentTarget.value as UserPreferences["theme"])}
          >
            <option value="system">Use system setting</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <label class="check-row">
          <input
            type="checkbox"
            checked={preferences.compactCards}
            onChange={(event) => update("compactCards", event.currentTarget.checked)}
          />
          Use compact module cards
        </label>

        <div class="settings-actions">
          <button class="button button--primary" type="button" onClick={() => void persist()}>
            Save locally
          </button>
          {saved && <span role="status">Saved on this device.</span>}
        </div>
      </section>

      <section class="settings-card settings-card--privacy">
        <p class="overline">PRIVACY CENTER</p>
        <h2>Data boundaries</h2>
        <dl>
          <div><dt>Notebook</dt><dd>Local IndexedDB</dd></div>
          <div><dt>Telemetry</dt><dd>None</dd></div>
          <div><dt>Source access</dt><dd>Optional, per origin</dd></div>
          <div><dt>Cloud AI fallback</dt><dd>Disabled</dd></div>
          <div><dt>Granted source origins</dt><dd>{hostOrigins.length ? hostOrigins.join(", ") : "None"}</dd></div>
        </dl>
        <div class="danger-zone">
          <div>
            <strong>Delete all BenchTab data</strong>
            <p>This cannot be undone. JSON export is available from the notebook module.</p>
          </div>
          <button class="button button--danger" type="button" onClick={() => void deleteAllLocalData()}>
            Delete local data
          </button>
        </div>
        {dataStatus && <p class="inline-status" role="status">{dataStatus}</p>}
      </section>
    </main>
  );
}
