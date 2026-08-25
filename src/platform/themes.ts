import type { Translate } from "./i18n";

export const THEME_IDS = [
  "kobalt",
  "sitrus",
  "cam",
  "klinik",
  "kagit",
  "sade",
  "devre",
  "manyetik",
  "aurora",
  "cam-gece",
  "murekkep",
  "grafit",
  "fosfor",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];
export type ThemePreference = "system" | ThemeId;
export type ThemeGroup = "light" | "dark";

interface ThemeTokens {
  bg: string;
  bgImage: string;
  surface: string;
  surfaceRaised: string;
  surfaceOverlay: string;
  surfaceSunken: string;
  lineSubtle: string;
  line: string;
  lineStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  accentMeasure: string;
  accentLiterature: string;
  accentReference: string;
  accentWorkflow: string;
  accentRecord: string;
  solid: string;
  onSolid: string;
  shadow: string;
  shadowLarge: string;
  cardImage: string;
  backdropFilter: string;
  radiusSmall: string;
  radiusLarge: string;
  fontUi: "sans" | "mono";
  fontDisplay: "sans" | "serif" | "mono";
  displayWeight: string;
  titleWeight: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  group: ThemeGroup;
  fallbackName: string;
  fallbackDescription: string;
  tokens: Readonly<ThemeTokens>;
}

const NONE = "none";

function defineTheme(
  id: ThemeId,
  group: ThemeGroup,
  fallbackName: string,
  fallbackDescription: string,
  tokens: ThemeTokens,
): ThemeDefinition {
  return { id, group, fallbackName, fallbackDescription, tokens };
}

export const THEMES: readonly ThemeDefinition[] = [
  defineTheme("kobalt", "light", "Kobalt", "Canlı kobalt vurgular ve parlak beyaz kartlar.", {
    bg: "#eaeff9", bgImage: "radial-gradient(1100px 460px at 100% -14%, rgba(47,107,255,.18), transparent 70%)",
    surface: "#ffffff", surfaceRaised: "#f1f5fe", surfaceOverlay: "#ffffff", surfaceSunken: "#f1f5fe",
    lineSubtle: "#e2e9f8", line: "#d3ddf3", lineStrong: "#9fb4e4",
    text: "#0d1836", textSecondary: "#2e3f68", textMuted: "#4a5c88", textFaint: "#6f81ac",
    accentMeasure: "#0a8f9c", accentLiterature: "#7a3ff0", accentReference: "#e07a00", accentWorkflow: "#0f9d58", accentRecord: "#e02e6d",
    solid: "#2f6bff", onSolid: "#ffffff",
    shadow: "0 2px 4px rgb(20 40 100 / 6%), 0 18px 34px -24px rgb(20 40 100 / 34%)",
    shadowLarge: "0 32px 70px -28px rgb(20 40 100 / 40%)",
    cardImage: "linear-gradient(180deg, rgba(47,107,255,.07), rgba(47,107,255,0) 58%)", backdropFilter: NONE,
    radiusSmall: "9px", radiusLarge: "14px", fontUi: "sans", fontDisplay: "sans", displayWeight: "700", titleWeight: "640",
  }),
  defineTheme("sitrus", "light", "Sitrus", "Kömür grisi, asit yeşili ve enerjik düz yüzeyler.", {
    bg: "#f4f6ef", bgImage: "radial-gradient(900px 420px at 6% -12%, rgba(163,230,53,.34), transparent 66%)",
    surface: "#ffffff", surfaceRaised: "#f3f5ea", surfaceOverlay: "#ffffff", surfaceSunken: "#f3f5ea",
    lineSubtle: "#e6e9dc", line: "#d8dcca", lineStrong: "#1b1d16",
    text: "#14170f", textSecondary: "#333927", textMuted: "#4d543c", textFaint: "#6c7357",
    accentMeasure: "#0e7490", accentLiterature: "#6d28d9", accentReference: "#b45309", accentWorkflow: "#4d7c0f", accentRecord: "#be123c",
    solid: "#14170f", onSolid: "#eaff9c", shadow: "3px 3px 0 rgba(20,23,15,.10)", shadowLarge: "10px 10px 0 rgba(20,23,15,.14)",
    cardImage: NONE, backdropFilter: NONE, radiusSmall: "5px", radiusLarge: "8px", fontUi: "sans", fontDisplay: "sans", displayWeight: "760", titleWeight: "680",
  }),
  defineTheme("cam", "light", "Cam", "Yarı saydam beyaz katmanlar, bulanıklık ve geniş köşeler.", {
    bg: "#eceef4", bgImage: "radial-gradient(900px 480px at 12% -10%, rgba(120,170,255,.30), transparent 68%), radial-gradient(780px 420px at 88% 6%, rgba(255,168,205,.24), transparent 66%), radial-gradient(680px 520px at 60% 100%, rgba(150,235,215,.22), transparent 70%)",
    surface: "rgba(255,255,255,.58)", surfaceRaised: "rgba(255,255,255,.82)", surfaceOverlay: "rgba(255,255,255,.76)", surfaceSunken: "rgba(255,255,255,.42)",
    lineSubtle: "rgba(255,255,255,.62)", line: "rgba(120,130,160,.22)", lineStrong: "rgba(90,100,130,.38)",
    text: "#14161c", textSecondary: "#39404e", textMuted: "#535b6b", textFaint: "#6f7889",
    accentMeasure: "#0f8f86", accentLiterature: "#6b4ae0", accentReference: "#b06a00", accentWorkflow: "#1c8a4e", accentRecord: "#c93266",
    solid: "#0a6cff", onSolid: "#ffffff", shadow: "0 1px 0 rgba(255,255,255,.7) inset, 0 14px 30px -22px rgb(20 30 60 / 40%)", shadowLarge: "0 36px 80px -30px rgb(20 30 60 / 42%)",
    cardImage: NONE, backdropFilter: "blur(26px) saturate(180%)", radiusSmall: "11px", radiusLarge: "18px", fontUi: "sans", fontDisplay: "sans", displayWeight: "620", titleWeight: "600",
  }),
  defineTheme("klinik", "light", "Klinik", "Soğuk beyaz, mavi vurgu ve yumuşak gölgeler.", {
    bg: "#eef1f6", bgImage: NONE, surface: "#ffffff", surfaceRaised: "#f3f6fb", surfaceOverlay: "#ffffff", surfaceSunken: "#f3f6fb",
    lineSubtle: "#e6ebf3", line: "#dae1ec", lineStrong: "#aebbd0", text: "#0f1729", textSecondary: "#33405a", textMuted: "#4e5c78", textFaint: "#75839c",
    accentMeasure: "#1d63d8", accentLiterature: "#6d3fd1", accentReference: "#a3620a", accentWorkflow: "#12806a", accentRecord: "#c0335f",
    solid: "#1d63d8", onSolid: "#ffffff", shadow: "0 1px 2px rgb(16 24 40 / 5%), 0 12px 24px -18px rgb(16 24 40 / 22%)", shadowLarge: "0 28px 64px -26px rgb(16 24 40 / 30%)",
    cardImage: NONE, backdropFilter: NONE, radiusSmall: "8px", radiusLarge: "14px", fontUi: "sans", fontDisplay: "sans", displayWeight: "620", titleWeight: "600",
  }),
  defineTheme("kagit", "light", "Kâğıt", "Sıcak kâğıt, mürekkep siyahı ve serif başlıklar.", {
    bg: "#f4f1ea", bgImage: NONE, surface: "#fdfbf6", surfaceRaised: "#f2eee5", surfaceOverlay: "#fdfbf6", surfaceSunken: "#f2eee5",
    lineSubtle: "#e6dfd1", line: "#dbd2c0", lineStrong: "#b6a992", text: "#1e1a15", textSecondary: "#3d372e", textMuted: "#5b544a", textFaint: "#847b6c",
    accentMeasure: "#1f6b5e", accentLiterature: "#6a4a9c", accentReference: "#9a4f24", accentWorkflow: "#4a6b2f", accentRecord: "#96324b",
    solid: "#241f19", onSolid: "#fdfbf6", shadow: NONE, shadowLarge: "0 18px 40px -20px rgb(60 45 25 / 28%)",
    cardImage: NONE, backdropFilter: NONE, radiusSmall: "3px", radiusLarge: "4px", fontUi: "sans", fontDisplay: "serif", displayWeight: "600", titleWeight: "600",
  }),
  defineTheme("sade", "light", "Sade", "Yumuşak gri alanda temiz beyaz yüzeyler.", {
    bg: "#f6f6f7", bgImage: NONE, surface: "#ffffff", surfaceRaised: "#f4f4f6", surfaceOverlay: "#ffffff", surfaceSunken: "#f4f4f6",
    lineSubtle: "#ececef", line: "#e0e0e4", lineStrong: "#b9b9c1", text: "#131316", textSecondary: "#3a3a42", textMuted: "#55555e", textFaint: "#74747d",
    accentMeasure: "#0f766e", accentLiterature: "#5b46c4", accentReference: "#8a5a12", accentWorkflow: "#2c7a3d", accentRecord: "#a8365a",
    solid: "#131316", onSolid: "#ffffff", shadow: NONE, shadowLarge: "0 24px 60px -24px rgb(16 16 20 / 22%)",
    cardImage: NONE, backdropFilter: NONE, radiusSmall: "6px", radiusLarge: "10px", fontUi: "sans", fontDisplay: "sans", displayWeight: "560", titleWeight: "560",
  }),
  defineTheme("devre", "dark", "Devre", "Mor-indigo gece, elektrik vurgular ve ışıklı kenarlar.", {
    bg: "#0b0b16", bgImage: "radial-gradient(1000px 480px at 82% -14%, rgba(108,92,255,.30), transparent 68%), radial-gradient(760px 420px at 8% 8%, rgba(34,211,238,.14), transparent 64%)",
    surface: "#15152a", surfaceRaised: "#1a1a33", surfaceOverlay: "#1a1a33", surfaceSunken: "#101021",
    lineSubtle: "#242444", line: "#302f5c", lineStrong: "#4b4a8c", text: "#f2f1ff", textSecondary: "#c9c6f0", textMuted: "#9d99cc", textFaint: "#807cb0",
    accentMeasure: "#22d3ee", accentLiterature: "#a78bfa", accentReference: "#fbbf24", accentWorkflow: "#34d399", accentRecord: "#fb7185",
    solid: "#6c5cff", onSolid: "#ffffff", shadow: "0 0 0 1px rgba(139,123,255,.10), 0 20px 44px -30px rgb(0 0 0 / 80%)", shadowLarge: "0 34px 74px -28px rgb(4 2 18 / 88%)",
    cardImage: "linear-gradient(180deg, rgba(139,123,255,.10), rgba(139,123,255,0) 55%)", backdropFilter: NONE, radiusSmall: "9px", radiusLarge: "14px", fontUi: "sans", fontDisplay: "sans", displayWeight: "700", titleWeight: "640",
  }),
  defineTheme("manyetik", "dark", "Manyetik", "Erik siyahı üzerinde yüksek kontrastlı sıcak magenta.", {
    bg: "#0f0812", bgImage: "radial-gradient(900px 460px at 100% -10%, rgba(236,72,153,.28), transparent 66%), radial-gradient(820px 460px at 0% 100%, rgba(124,58,237,.22), transparent 68%)",
    surface: "#1a1020", surfaceRaised: "#20142a", surfaceOverlay: "#20142a", surfaceSunken: "#150c1a",
    lineSubtle: "#2c1c38", line: "#3c2649", lineStrong: "#5f3a72", text: "#fbeef8", textSecondary: "#dcc4d8", textMuted: "#b295b0", textFaint: "#95788f",
    accentMeasure: "#2dd4bf", accentLiterature: "#c084fc", accentReference: "#fcd34d", accentWorkflow: "#4ade80", accentRecord: "#ff4d9d",
    solid: "#ff4d9d", onSolid: "#1a0512", shadow: "0 18px 40px -28px rgb(0 0 0 / 80%)", shadowLarge: "0 34px 74px -28px rgb(12 2 14 / 90%)",
    cardImage: "linear-gradient(180deg, rgba(255,77,157,.09), rgba(255,77,157,0) 52%)", backdropFilter: NONE, radiusSmall: "7px", radiusLarge: "12px", fontUi: "sans", fontDisplay: "sans", displayWeight: "720", titleWeight: "650",
  }),
  defineTheme("aurora", "dark", "Aurora", "Derin deniz mavisinde turkuaz ve yeşil ışıklar.", {
    bg: "#04121a", bgImage: "radial-gradient(1000px 500px at 20% -12%, rgba(45,212,191,.24), transparent 66%), radial-gradient(820px 440px at 92% 10%, rgba(56,189,248,.20), transparent 64%)",
    surface: "#0a1e29", surfaceRaised: "#0d2531", surfaceOverlay: "#0d2531", surfaceSunken: "#071822",
    lineSubtle: "#123040", line: "#1a4152", lineStrong: "#2c6577", text: "#eafcff", textSecondary: "#bfe2e9", textMuted: "#8fb6c0", textFaint: "#719aa6",
    accentMeasure: "#2dd4bf", accentLiterature: "#7dd3fc", accentReference: "#fcd34d", accentWorkflow: "#86efac", accentRecord: "#fda4af",
    solid: "#2dd4bf", onSolid: "#02171b", shadow: "0 16px 36px -26px rgb(0 0 0 / 76%)", shadowLarge: "0 32px 70px -28px rgb(0 8 14 / 88%)",
    cardImage: "linear-gradient(180deg, rgba(45,212,191,.08), rgba(45,212,191,0) 52%)", backdropFilter: NONE, radiusSmall: "8px", radiusLarge: "12px", fontUi: "sans", fontDisplay: "sans", displayWeight: "680", titleWeight: "620",
  }),
  defineTheme("cam-gece", "dark", "Cam Gece", "Karanlıkta duman katmanları, ışıklı kenarlar ve bulanıklık.", {
    bg: "#0b0d12", bgImage: "radial-gradient(900px 500px at 14% -12%, rgba(70,120,255,.24), transparent 66%), radial-gradient(760px 420px at 86% 4%, rgba(190,90,200,.18), transparent 64%), radial-gradient(700px 520px at 62% 100%, rgba(40,200,180,.14), transparent 70%)",
    surface: "rgba(255,255,255,.07)", surfaceRaised: "rgba(255,255,255,.14)", surfaceOverlay: "rgba(28,31,40,.86)", surfaceSunken: "rgba(255,255,255,.05)",
    lineSubtle: "rgba(255,255,255,.10)", line: "rgba(255,255,255,.16)", lineStrong: "rgba(255,255,255,.32)", text: "#f4f5f9", textSecondary: "#ccd1de", textMuted: "#9ea5b6", textFaint: "#828a9d",
    accentMeasure: "#4fd6c4", accentLiterature: "#a795ff", accentReference: "#ffcc70", accentWorkflow: "#5fdc95", accentRecord: "#ff92b6",
    solid: "#4c9bff", onSolid: "#06101e", shadow: "0 1px 0 rgba(255,255,255,.10) inset, 0 18px 40px -26px rgb(0 0 0 / 70%)", shadowLarge: "0 36px 80px -30px rgb(0 0 0 / 85%)",
    cardImage: NONE, backdropFilter: "blur(26px) saturate(170%)", radiusSmall: "11px", radiusLarge: "18px", fontUi: "sans", fontDisplay: "sans", displayWeight: "620", titleWeight: "600",
  }),
  defineTheme("murekkep", "dark", "Mürekkep", "Derin lacivert, buzlu cam kartlar ve canlı mavi vurgu.", {
    bg: "#080b16", bgImage: "radial-gradient(1200px 520px at 78% -12%, rgba(70,110,220,.16), transparent 70%)",
    surface: "rgba(23,30,52,.72)", surfaceRaised: "rgba(30,39,66,.86)", surfaceOverlay: "rgba(20,26,46,.94)", surfaceSunken: "rgba(12,17,33,.72)",
    lineSubtle: "rgba(120,145,210,.14)", line: "rgba(126,152,215,.22)", lineStrong: "rgba(140,168,230,.42)", text: "#eef2fb", textSecondary: "#c2ccea", textMuted: "#95a2c6", textFaint: "#7685ab",
    accentMeasure: "#5ddcd0", accentLiterature: "#8f9dff", accentReference: "#f0c46a", accentWorkflow: "#68d59a", accentRecord: "#ff8fb4",
    solid: "#6d9bff", onSolid: "#07101f", shadow: "0 18px 40px -28px rgb(0 0 0 / 70%)", shadowLarge: "0 32px 70px -28px rgb(2 6 18 / 85%)",
    cardImage: NONE, backdropFilter: "blur(14px)", radiusSmall: "9px", radiusLarge: "14px", fontUi: "sans", fontDisplay: "sans", displayWeight: "600", titleWeight: "580",
  }),
  defineTheme("grafit", "dark", "Grafit", "Nötr siyah yüzeyler, kademeli griler ve ince çizgiler.", {
    bg: "#0a0a0b", bgImage: NONE, surface: "#121214", surfaceRaised: "#17171a", surfaceOverlay: "#17171a", surfaceSunken: "#0e0e10",
    lineSubtle: "#1f1f24", line: "#2a2a31", lineStrong: "#3f3f48", text: "#f0f0f3", textSecondary: "#c3c3ca", textMuted: "#9a9aa3", textFaint: "#7b7b85",
    accentMeasure: "#5cc9b4", accentLiterature: "#a695f5", accentReference: "#e0b566", accentWorkflow: "#7fca8a", accentRecord: "#f090a6",
    solid: "#f0f0f3", onSolid: "#0a0a0b", shadow: NONE, shadowLarge: "0 24px 60px -24px rgb(0 0 0 / 80%)",
    cardImage: NONE, backdropFilter: NONE, radiusSmall: "6px", radiusLarge: "10px", fontUi: "sans", fontDisplay: "sans", displayWeight: "560", titleWeight: "560",
  }),
  defineTheme("fosfor", "dark", "Fosfor", "Terminal disiplini, keskin köşeler ve fosfor yeşili.", {
    bg: "#05070a", bgImage: NONE, surface: "#0a0f12", surfaceRaised: "#0c1216", surfaceOverlay: "#0c1216", surfaceSunken: "#070c0f",
    lineSubtle: "#152122", line: "#1e2f2d", lineStrong: "#31514b", text: "#d9f2e3", textSecondary: "#a8ccb9", textMuted: "#7fa892", textFaint: "#5e8574",
    accentMeasure: "#4ade80", accentLiterature: "#7fd8ff", accentReference: "#ffd166", accentWorkflow: "#57e39a", accentRecord: "#ff9d8a",
    solid: "#4ade80", onSolid: "#04140b", shadow: NONE, shadowLarge: "0 20px 50px -22px rgb(0 0 0 / 90%)",
    cardImage: NONE, backdropFilter: NONE, radiusSmall: "2px", radiusLarge: "2px", fontUi: "mono", fontDisplay: "mono", displayWeight: "600", titleWeight: "600",
  }),
] as const;

export const THEME_BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));

const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const SERIF = 'Iowan Old Style, Charter, "Palatino Linotype", Palatino, Georgia, serif';
const MONO = 'ui-monospace, "SF Mono", "Cascadia Mono", "JetBrains Mono", "Roboto Mono", Consolas, "Liberation Mono", monospace';

const CSS_TOKEN_MAP: Readonly<Record<keyof ThemeTokens, string>> = {
  bg: "--bg", bgImage: "--background-image", surface: "--surface", surfaceRaised: "--surface-raised",
  surfaceOverlay: "--surface-overlay", surfaceSunken: "--surface-sunken", lineSubtle: "--line-subtle", line: "--line", lineStrong: "--line-strong",
  text: "--text", textSecondary: "--text-secondary", textMuted: "--text-muted", textFaint: "--text-faint",
  accentMeasure: "--accent-measure", accentLiterature: "--accent-literature", accentReference: "--accent-reference", accentWorkflow: "--accent-workflow", accentRecord: "--accent-record",
  solid: "--solid", onSolid: "--on-solid", shadow: "--shadow-sm", shadowLarge: "--shadow-lg", cardImage: "--card-background-image",
  backdropFilter: "--surface-backdrop-filter", radiusSmall: "--theme-radius-small", radiusLarge: "--theme-radius-large",
  fontUi: "--font-sans", fontDisplay: "--font-display", displayWeight: "--display-weight", titleWeight: "--title-weight",
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_BY_ID.has(value as ThemeId);
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === "system") return value;
  if (value === "light") return "sade";
  if (value === "dark") return "grafit";
  return isThemeId(value) ? value : "system";
}

export function themeName(t: Translate, id: ThemeId): string {
  const theme = THEME_BY_ID.get(id)!;
  return t.optional(`theme.${id}.name`, theme.fallbackName);
}

export function themeDescription(t: Translate, id: ThemeId): string {
  const theme = THEME_BY_ID.get(id)!;
  return t.optional(`theme.${id}.description`, theme.fallbackDescription);
}

export function applyThemePreference(preference: ThemePreference, root = document.documentElement): void {
  root.dataset.theme = preference;
  for (const cssName of Object.values(CSS_TOKEN_MAP)) root.style.removeProperty(cssName);
  for (const cssName of [
    "color-scheme", "--radius-xs", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl",
    "--danger", "--danger-text", "--warning", "--success", "--on-accent", "--shadow-md", "--scrim",
  ]) root.style.removeProperty(cssName);

  if (preference === "system") return;
  const theme = THEME_BY_ID.get(preference);
  if (!theme) return;
  const { tokens } = theme;
  for (const [token, cssName] of Object.entries(CSS_TOKEN_MAP) as [keyof ThemeTokens, string][]) {
    let value: string = tokens[token];
    if (token === "fontUi") value = value === "mono" ? MONO : SANS;
    if (token === "fontDisplay") value = value === "serif" ? SERIF : value === "mono" ? MONO : SANS;
    root.style.setProperty(cssName, value);
  }
  root.style.setProperty("color-scheme", theme.group);
  root.style.setProperty("--radius-xs", `min(4px, ${tokens.radiusSmall})`);
  root.style.setProperty("--radius-sm", tokens.radiusSmall);
  root.style.setProperty("--radius-md", tokens.radiusSmall);
  root.style.setProperty("--radius-lg", tokens.radiusLarge);
  root.style.setProperty("--radius-xl", tokens.radiusLarge);
  root.style.setProperty("--danger", tokens.accentRecord);
  root.style.setProperty("--danger-text", tokens.accentRecord);
  root.style.setProperty("--warning", tokens.accentReference);
  root.style.setProperty("--success", tokens.accentWorkflow);
  root.style.setProperty("--on-accent", tokens.onSolid);
  root.style.setProperty("--shadow-md", tokens.shadow);
  root.style.setProperty("--scrim", theme.group === "dark" ? "rgb(4 6 12 / 68%)" : "rgb(16 16 20 / 28%)");
}

export function themeSwatchStyle(theme: ThemeDefinition): string {
  return `--swatch-bg:${theme.tokens.bg};--swatch-surface:${theme.tokens.surface};--swatch-accent:${theme.tokens.solid};--swatch-line:${theme.tokens.line}`;
}
