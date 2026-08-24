import { useEffect, useState } from "preact/hooks";

import { useTranslate } from "../platform/i18n";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  type DashboardLayout,
  type ModuleId,
} from "../platform/layoutPreferences";
import {
  CATEGORY_ACCENT,
  categoryLabel,
  MODULE_CATALOG,
  MODULE_CATEGORIES,
  moduleKind,
  moduleTitle,
  type ModuleCategory,
} from "./moduleCatalog";

interface ModuleManagerProps {
  layout: DashboardLayout;
  onChange: (layout: DashboardLayout) => void;
  onClose: () => void;
}

export function ModuleManager({ layout, onChange, onClose }: ModuleManagerProps) {
  const t = useTranslate();
  const [draggedId, setDraggedId] = useState<ModuleId>();

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function setEnabled(id: ModuleId, enabled: boolean) {
    onChange({
      ...layout,
      hidden: enabled
        ? layout.hidden.filter((candidate) => candidate !== id)
        : [...new Set([...layout.hidden, id])],
    });
  }

  function move(id: ModuleId, direction: -1 | 1) {
    const index = layout.order.indexOf(id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= layout.order.length) return;
    const order = [...layout.order];
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    onChange({ ...layout, order });
  }

  function dropBefore(targetId: ModuleId) {
    if (!draggedId || draggedId === targetId) return;
    const order = layout.order.filter((id) => id !== draggedId);
    order.splice(order.indexOf(targetId), 0, draggedId);
    onChange({ ...layout, order });
    setDraggedId(undefined);
  }

  function setCategoryEnabled(category: ModuleCategory, enabled: boolean) {
    const ids = layout.order.filter((id) => MODULE_CATALOG[id].category === category);
    onChange({
      ...layout,
      hidden: enabled
        ? layout.hidden.filter((candidate) => !ids.includes(candidate))
        : [...new Set([...layout.hidden, ...ids])],
    });
  }

  const shownCount = layout.order.length - layout.hidden.length;

  return (
    <>
      <div class="module-manager-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        class="module-manager"
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-manager-title"
      >
        <header>
          <div>
            <p class="overline">{t("manager.overline")}</p>
            <h2 id="module-manager-title">{t("manager.title")}</h2>
          </div>
          <button
            class="icon-button"
            type="button"
            onClick={onClose}
            aria-label={t("manager.close")}
          >
            ×
          </button>
        </header>

        <p class="module-manager__help">
          {t("manager.help", { shown: shownCount, total: layout.order.length })}
        </p>

        {MODULE_CATEGORIES.map((category) => {
          const ids = layout.order.filter((id) => MODULE_CATALOG[id].category === category);
          if (ids.length === 0) return null;
          const allShown = ids.every((id) => !layout.hidden.includes(id));

          return (
            <section class="module-manager__group" key={category}>
              <p class="module-manager__group-label">
                <span
                  class="filter-chip__dot"
                  style={`--chip-accent: ${CATEGORY_ACCENT[category]}`}
                  aria-hidden="true"
                />
                {categoryLabel(t, category)}
                <button
                  class="text-button"
                  type="button"
                  onClick={() => setCategoryEnabled(category, !allShown)}
                >
                  {allShown ? t("manager.hideAll") : t("manager.showAll")}
                </button>
              </p>

              <ol>
                {ids.map((id) => {
                  const enabled = !layout.hidden.includes(id);
                  const index = layout.order.indexOf(id);
                  const title = moduleTitle(t, id);
                  return (
                    <li
                      key={id}
                      draggable
                      class={`${enabled ? "" : "is-hidden"}${draggedId === id ? " is-dragging" : ""}`}
                      style={`--chip-accent: ${CATEGORY_ACCENT[category]}`}
                      onDragStart={() => setDraggedId(id)}
                      onDragEnd={() => setDraggedId(undefined)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => dropBefore(id)}
                    >
                      <span class="drag-grip" aria-hidden="true">⠿</span>
                      <span>
                        <strong>{title}</strong>
                        <small>{moduleKind(t, id)}</small>
                      </span>
                      <label class="module-toggle">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) => setEnabled(id, event.currentTarget.checked)}
                        />
                        <span>{enabled ? t("manager.shown") : t("manager.hidden")}</span>
                      </label>
                      <span class="order-buttons">
                        <button
                          type="button"
                          onClick={() => move(id, -1)}
                          disabled={index === 0}
                          aria-label={t("manager.moveUp", { name: title })}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(id, 1)}
                          disabled={index === layout.order.length - 1}
                          aria-label={t("manager.moveDown", { name: title })}
                        >
                          ↓
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}

        <footer>
          <button
            class="text-button"
            type="button"
            onClick={() => onChange(DEFAULT_DASHBOARD_LAYOUT)}
          >
            {t("manager.reset")}
          </button>
          <button class="button button--primary button--small" type="button" onClick={onClose}>
            {t("manager.done")}
          </button>
        </footer>
      </aside>
    </>
  );
}
