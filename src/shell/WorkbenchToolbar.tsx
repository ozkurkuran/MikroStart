import { CATEGORY_META, MODULE_CATEGORIES, type ModuleCategory } from "./moduleCatalog";

export type CategoryFilter = ModuleCategory | "all";

interface WorkbenchToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
  /** Visible-module count per category, before the category filter is applied. */
  counts: Readonly<Record<ModuleCategory, number>>;
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
  totalCount,
  shownCount,
  compact,
  onCompactChange,
  onManage,
}: WorkbenchToolbarProps) {
  return (
    <div class="workbench-toolbar" role="search">
      <div class="workbench-toolbar__search">
        <label class="sr-only" for="module-filter">
          Modül ara
        </label>
        <input
          id="module-filter"
          type="search"
          value={query}
          placeholder="Modül ara…"
          autocomplete="off"
          onInput={(event) => onQueryChange(event.currentTarget.value)}
        />
        {query && (
          <button
            class="workbench-toolbar__clear"
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Aramayı temizle"
          >
            ×
          </button>
        )}
      </div>

      <div class="filter-chips" role="group" aria-label="Modül kategorileri">
        <button
          class="filter-chip"
          type="button"
          aria-pressed={category === "all"}
          onClick={() => onCategoryChange("all")}
        >
          Tümü
          <span class="filter-chip__count">{totalCount}</span>
        </button>
        {MODULE_CATEGORIES.map((id) => {
          const meta = CATEGORY_META[id];
          return (
            <button
              key={id}
              class="filter-chip"
              type="button"
              style={`--chip-accent: ${meta.accent}`}
              aria-pressed={category === id}
              onClick={() => onCategoryChange(category === id ? "all" : id)}
            >
              <span class="filter-chip__dot" aria-hidden="true" />
              {meta.label}
              <span class="filter-chip__count">{counts[id]}</span>
            </button>
          );
        })}
      </div>

      <span class="workbench-toolbar__spacer" />

      <span class="workbench-toolbar__meta" aria-live="polite">
        {shownCount === totalCount ? `${totalCount} modül` : `${shownCount} / ${totalCount} modül`}
      </span>

      <div class="segmented" role="group" aria-label="Kart yoğunluğu">
        <button
          type="button"
          aria-pressed={!compact}
          onClick={() => onCompactChange(false)}
        >
          Rahat
        </button>
        <button type="button" aria-pressed={compact} onClick={() => onCompactChange(true)}>
          Sık
        </button>
      </div>

      <button class="button button--primary" type="button" onClick={onManage}>
        Modülleri yönet
      </button>
    </div>
  );
}
