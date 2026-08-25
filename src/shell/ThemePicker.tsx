import { useEffect, useRef, useState } from "preact/hooks";

import { useTranslate } from "../platform/i18n";
import {
  THEME_BY_ID,
  THEMES,
  themeDescription,
  themeName,
  themeSwatchStyle,
  type ThemeGroup,
  type ThemePreference,
} from "../platform/themes";

interface ThemePickerProps {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = value === "system" ? undefined : THEME_BY_ID.get(value);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>(".theme-picker__trigger")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function choose(next: ThemePreference) {
    onChange(next);
    setOpen(false);
  }

  function renderGroup(group: ThemeGroup) {
    return (
      <section class="theme-picker__group">
        <h3>{group === "light" ? t("theme.light") : t("theme.dark")}</h3>
        {THEMES.filter((theme) => theme.group === group).map((theme) => (
          <button
            class="theme-option"
            type="button"
            key={theme.id}
            aria-pressed={value === theme.id}
            onClick={() => choose(theme.id)}
          >
            <span class="theme-swatch" style={themeSwatchStyle(theme)} aria-hidden="true">
              <span /><i />
            </span>
            <span class="theme-option__copy">
              <strong>{themeName(t, theme.id)}</strong>
              <small>{themeDescription(t, theme.id)}</small>
            </span>
            <span class="theme-option__mark" aria-hidden="true">●</span>
          </button>
        ))}
      </section>
    );
  }

  return (
    <div class="theme-picker" ref={rootRef}>
      <button
        class="button button--quiet theme-picker__trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t("theme.pickerLabel")}: ${selected ? themeName(t, selected.id) : t("theme.system")}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          class="theme-picker__dots"
          style={selected ? themeSwatchStyle(selected) : undefined}
          data-system={!selected || undefined}
          aria-hidden="true"
        ><i /><i /><i /></span>
        <span class="theme-picker__label">
          {selected ? themeName(t, selected.id) : t("theme.system")}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div class="theme-picker__popover" role="dialog" aria-label={t("theme.pickerLabel")}>
          <div class="theme-picker__heading">
            <strong>{t("theme.pickerLabel")}</strong>
            <span>{t("theme.count", { count: THEMES.length })}</span>
          </div>
          <button
            class="theme-option theme-option--system"
            type="button"
            aria-pressed={value === "system"}
            onClick={() => choose("system")}
          >
            <span class="theme-swatch theme-swatch--system" aria-hidden="true"><span /><i /></span>
            <span class="theme-option__copy">
              <strong>{t("theme.system")}</strong>
              <small>{t("theme.systemDescription")}</small>
            </span>
            <span class="theme-option__mark" aria-hidden="true">●</span>
          </button>
          {renderGroup("light")}
          {renderGroup("dark")}
          <p class="theme-picker__privacy">{t("theme.localOnly")}</p>
        </div>
      )}
    </div>
  );
}
