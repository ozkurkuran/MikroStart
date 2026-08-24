import { useState } from "preact/hooks";

import {
  DEFAULT_DASHBOARD_LAYOUT,
  type DashboardLayout,
  type ModuleId,
} from "../platform/layoutPreferences";

const LABELS: Record<ModuleId, { title: string; kind: string }> = {
  "bragg-spacing": { title: "Bragg / d-spacing", kind: "Calculator" },
  "scherrer-size": { title: "Scherrer crystallite size", kind: "Calculator" },
  "sheet-resistance": { title: "Sheet resistance", kind: "Calculator" },
  "hall-measurement": { title: "Hall measurement", kind: "Calculator" },
  "vacuum-kinetics": { title: "Vacuum kinetics", kind: "Calculator" },
  "research-feed": { title: "Research feed", kind: "Literature" },
  "on-device-ai": { title: "On-device AI", kind: "Analysis" },
  "translation-tools": { title: "Çeviri", kind: "Language tool" },
  "tureng-dictionary": { title: "Tureng sözlük", kind: "Language tool" },
  "codata-constants": { title: "CODATA constants", kind: "Offline reference" },
  "periodic-table": { title: "Periodic table", kind: "Offline reference" },
  "component-series": { title: "Component series", kind: "Offline reference" },
  "countdown-timers": { title: "Geri sayım", kind: "Workflow" },
  "stopwatch": { title: "Kronometre", kind: "Workflow" },
  "sample-id": { title: "Numune kimliği", kind: "Workflow" },
  "quick-note": { title: "Hızlı not", kind: "Workflow" },
  "lab-notebook": { title: "Lab notebook", kind: "Record" },
};

interface ModuleManagerProps {
  layout: DashboardLayout;
  onChange: (layout: DashboardLayout) => void;
  onClose: () => void;
}

export function ModuleManager({ layout, onChange, onClose }: ModuleManagerProps) {
  const [draggedId, setDraggedId] = useState<ModuleId>();

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

  return (
    <aside class="module-manager" aria-labelledby="module-manager-title">
      <header>
        <div>
          <p class="overline">BOARD CONFIGURATION</p>
          <h2 id="module-manager-title">Modules</h2>
        </div>
        <button class="icon-button" type="button" onClick={onClose} aria-label="Close module manager">×</button>
      </header>
      <p class="module-manager__help">Drag to reorder, or use the arrow buttons. Hidden modules keep their local data.</p>
      <ol>
        {layout.order.map((id, index) => {
          const enabled = !layout.hidden.includes(id);
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDraggedId(id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropBefore(id)}
            >
              <span class="drag-grip" aria-hidden="true">⠿</span>
              <span>
                <strong>{LABELS[id].title}</strong>
                <small>{LABELS[id].kind}</small>
              </span>
              <label class="module-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(id, event.currentTarget.checked)}
                />
                <span>{enabled ? "Shown" : "Hidden"}</span>
              </label>
              <span class="order-buttons">
                <button type="button" onClick={() => move(id, -1)} disabled={index === 0} aria-label={`Move ${LABELS[id].title} up`}>↑</button>
                <button type="button" onClick={() => move(id, 1)} disabled={index === layout.order.length - 1} aria-label={`Move ${LABELS[id].title} down`}>↓</button>
              </span>
            </li>
          );
        })}
      </ol>
      <footer>
        <button class="text-button" type="button" onClick={() => onChange(DEFAULT_DASHBOARD_LAYOUT)}>Reset layout</button>
        <button class="button button--small" type="button" onClick={onClose}>Done</button>
      </footer>
    </aside>
  );
}
