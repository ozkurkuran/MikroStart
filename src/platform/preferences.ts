export type ThemePreference = "system" | "light" | "dark";

export interface UserPreferences {
  version: 1;
  locale: "tr" | "en";
  theme: ThemePreference;
  compactCards: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  version: 1,
  locale: "tr",
  theme: "system",
  compactCards: false,
};

const KEY = "preferences.v1";

export async function loadPreferences(): Promise<UserPreferences> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return DEFAULT_PREFERENCES;
  }

  const result = await chrome.storage.local.get(KEY);
  const value = result[KEY] as Partial<UserPreferences> | undefined;
  if (!value || value.version !== 1) return DEFAULT_PREFERENCES;

  return {
    ...DEFAULT_PREFERENCES,
    ...value,
    version: 1,
  };
}

export async function savePreferences(value: UserPreferences): Promise<void> {
  await chrome.storage.local.set({ [KEY]: value });
}
