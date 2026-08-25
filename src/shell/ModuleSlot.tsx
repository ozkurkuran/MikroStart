import type { ComponentChildren, JSX } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import type { ModuleId } from "../platform/layoutPreferences";
import { MODULE_CATALOG, moduleAccent } from "./moduleCatalog";
import type { DropEdge } from "./moduleReorder";

/** Fallbacks only. Real values are read from the grid so CSS stays the source. */
const FALLBACK_ROW_PX = 6;
const FALLBACK_GAP_PX = 12;

interface ModuleSlotProps {
  id: ModuleId;
  children: ComponentChildren;
  editMode: boolean;
  dragging: boolean;
  dropEdge?: DropEdge;
  dragLabel: string;
  dragInstructionsId: string;
  onElement: (id: ModuleId, node: HTMLDivElement | null) => void;
  onHandlePointerDown: (
    id: ModuleId,
    event: JSX.TargetedPointerEvent<HTMLButtonElement>,
  ) => void;
  onHandleKeyDown: (
    id: ModuleId,
    event: JSX.TargetedKeyboardEvent<HTMLButtonElement>,
  ) => void;
  onHandleBlur: (id: ModuleId) => void;
}

export function ModuleSlot({
  id,
  children,
  editMode,
  dragging,
  dropEdge,
  dragLabel,
  dragInstructionsId,
  onElement,
  onHandlePointerDown,
  onHandleKeyDown,
  onHandleBlur,
}: ModuleSlotProps) {
  const element = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const [rowSpan, setRowSpan] = useState(14);

  useEffect(() => {
    onElement(id, element.current);
    return () => onElement(id, null);
  }, [id, onElement]);

  useEffect(() => {
    const widget = element.current?.querySelector<HTMLElement>(".widget");
    if (!widget) return;
    widget.inert = editMode;
    if (editMode && widget.contains(document.activeElement)) handle.current?.focus();
    return () => {
      widget.inert = false;
    };
  }, [editMode]);

  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const grid = node.parentElement;
      let rowPx = FALLBACK_ROW_PX;
      let gapPx = FALLBACK_GAP_PX;
      if (grid) {
        const styles = getComputedStyle(grid);
        const parsedRow = Number.parseFloat(styles.gridAutoRows);
        const parsedGap = Number.parseFloat(styles.rowGap);
        if (Number.isFinite(parsedRow) && parsedRow > 0) rowPx = parsedRow;
        if (Number.isFinite(parsedGap) && parsedGap >= 0) gapPx = parsedGap;
      }
      const height = node.getBoundingClientRect().height;
      setRowSpan(Math.max(1, Math.ceil((height + gapPx) / (rowPx + gapPx))));
    };

    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(measure);
    });
    observer.observe(node);
    measure();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const meta = MODULE_CATALOG[id];

  return (
    <div
      ref={element}
      class={`module-slot module-slot--${id} module-slot--${meta.category}`}
      id={`module-${id}`}
      style={`--module-row-span: ${rowSpan}; --accent: ${moduleAccent(id)}`}
      data-editing={editMode || undefined}
      data-dragging={dragging || undefined}
      data-drop-edge={dropEdge}
    >
      <div class="module-slot__drag-surface">
        {editMode && (
          <button
            ref={handle}
            class="module-drag-handle"
            type="button"
            aria-label={dragLabel}
            aria-describedby={dragInstructionsId}
            aria-pressed={dragging}
            onPointerDown={(event) => onHandlePointerDown(id, event)}
            onKeyDown={(event) => onHandleKeyDown(id, event)}
            onBlur={() => onHandleBlur(id)}
          >
            <span aria-hidden="true">⠿</span>
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
