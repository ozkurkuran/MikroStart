import { createContext, type ComponentChildren } from "preact";
import { useContext, useMemo } from "preact/hooks";

import { en } from "./locales/en";
import { tr } from "./locales/tr";

export type Locale = "tr" | "en";

/** English is the source of truth: every other catalog must cover its keys. */
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

const CATALOGS: Readonly<Record<Locale, Messages>> = { en, tr };

export type MessageParams = Readonly<Record<string, string | number>>;

export interface Translate {
  (key: MessageKey, params?: MessageParams): string;
  /**
   * Look up a key that is only known at runtime — engine diagnostic codes, for
   * example. Falls back to the supplied text when the catalog has no entry.
   */
  optional: (key: string, fallback: string, params?: MessageParams) => string;
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function createTranslate(locale: Locale): Translate {
  const catalog = CATALOGS[locale] ?? en;
  const lookup = catalog as Readonly<Record<string, string | undefined>>;

  const translate = ((key: MessageKey, params?: MessageParams) =>
    interpolate(catalog[key] ?? en[key] ?? key, params)) as Translate;

  translate.optional = (key, fallback, params) =>
    interpolate(lookup[key] ?? fallback, params);

  return translate;
}

export interface I18nValue {
  locale: Locale;
  t: Translate;
}

const I18nContext = createContext<I18nValue>({
  locale: "tr",
  t: createTranslate("tr"),
});

interface I18nProviderProps {
  locale: Locale;
  children: ComponentChildren;
}

export function I18nProvider({ locale, children }: I18nProviderProps) {
  const value = useMemo<I18nValue>(
    () => ({ locale, t: createTranslate(locale) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Convenience for components that only need the translate function. */
export function useTranslate(): Translate {
  return useContext(I18nContext).t;
}

/** BCP 47 tag for Intl formatters and the document `lang` attribute. */
export function localeTag(locale: Locale): string {
  return locale === "tr" ? "tr-TR" : "en-GB";
}
