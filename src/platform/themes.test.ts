import { describe, expect, it } from "vitest";

import { THEME_IDS, normalizeThemePreference } from "./themes";

describe("theme preference normalization", () => {
  it("accepts every bundled theme and the system setting", () => {
    expect(THEME_IDS).toHaveLength(13);
    for (const id of THEME_IDS) expect(normalizeThemePreference(id)).toBe(id);
    expect(normalizeThemePreference("system")).toBe("system");
  });

  it("migrates the original light and dark preferences", () => {
    expect(normalizeThemePreference("light")).toBe("sade");
    expect(normalizeThemePreference("dark")).toBe("grafit");
  });

  it("falls back safely for unknown or malformed stored values", () => {
    expect(normalizeThemePreference("unknown")).toBe("system");
    expect(normalizeThemePreference(null)).toBe("system");
  });
});
