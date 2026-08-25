import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

import type { ModuleId } from "../platform/layoutPreferences";
import { MODULE_CATALOG, moduleAccent } from "./moduleCatalog";

/** Fallbacks only. Real values are read from the grid so CSS stays the source. */
const FALLBACK_ROW_PX = 6;
const FALLBACK_GAP_PX = 12;

interface ModuleSlotProps {
  id: ModuleId;
  children: ComponentChildren;
}

export function ModuleSlot({ id, children }: ModuleSlotProps) {
  const element = useRef<HTMLDivElement>(null);
  const [rowSpan, setRowSpan] = useState(14);

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
    >
      {children}
    </div>
  );
}
