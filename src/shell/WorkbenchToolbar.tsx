import { useTranslate } from "../platform/i18n";
import {
  CATEGORY_ACCENT,
  categoryLabel,
  MODULE_CATEGORIES,
  type ModuleCategory,
} from "./moduleCatalog";

export type CategoryFilter = ModuleCategory | "all";

interface WorkbenchToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
  /** Search-matched module count per category, before the category filter. */
  counts: Readonly<Record<ModuleCategory, number>>;
  /** Search-matched total, shown on the "all" chip so every count agrees. */
  matchedCount: number;
  totalCount: number;
  shownCount: number;
  compact: boolean;
  onCompactChange: (value: boolean) => void;
  onManage: () => void;
}

export function WorkbenchToolbar({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  counts,
  matchedCount,
  totalCount,
  shownCount,
  compact,
  onCompactChange,
  onManage,
}: WorkbenchToolbarProps) {
  const t = useTranslate();

  return (
    <div class="workbench-toolbar" role="search">
      <div class="workbench-toolbar__search">
        <label class="sr-only" for="module-filter">
          {t("toolbar.searchLabel")}
        </label>
        <input
          id="module-filter"
          type="search"
          value={query}
          placeholder={t("toolbar.searchPlaceholder")}
          autocomplete="off"
          onInput={(event) => onQueryChange(event.currentTarget.value)}
        />
        {query && (
          <button
            class="workbench-toolbar__clear"
            type="button"
            onClick={() => onQueryChange("")}
            aria-label={t("toolbar.clearSearch")}
          >
            ×
          </button>
        )}
      </div>

      <div class="filter-chips" role="group" aria-label={t("toolbar.categoriesAria")}>
        <button
          class="filter-chip"
          type="button"
          aria-pressed={category === "all"}
          onClick={() => onCategoryChange("all")}
        >
          {t("toolbar.all")}
          <span class="filter-chip__count">{matchedCount}</span>
        </button>
        {MODULE_CATEGORIES.map((id) => (
          <button
            key={id}
            class="filter-chip"
            type="button"
            style={`--chip-accent: ${CATEGORY_ACCENT[id]}`}
            aria-pressed={category === id}
            onClick={() => onCategoryChange(category === id ? "all" : id)}
          >
            <span class="filter-chip__dot" aria-hidden="true" />
            {categoryLabel(t, id)}
            <span class="filter-chip__count">{counts[id]}</span>
          </button>
        ))}
      </div>

      <span class="workbench-toolbar__spacer" />

      <span class="workbench-toolbar__meta" aria-live="polite">
        {shownCount === totalCount
          ? t("toolbar.count", { count: totalCount })
          : t("toolbar.countFiltered", { shown: shownCount, total: totalCount })}
      </span>

      <div class="segmented" role="group" aria-label={t("toolbar.densityAria")}>
        <button type="button" aria-pressed={!compact} onClick={() => onCompactChange(false)}>
          {t("toolbar.comfortable")}
        </button>
        <button type="button" aria-pressed={compact} onClick={() => onCompactChange(true)}>
          {t("toolbar.compact")}
        </button>
      </div>

      <button class="button button--primary" type="button" onClick={onManage}>
        {t("toolbar.manage")}
      </button>
    </div>
  );
}
