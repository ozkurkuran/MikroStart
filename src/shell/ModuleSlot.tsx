import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

import type { ModuleId } from "../platform/layoutPreferences";

const GRID_ROW_PX = 6;
const GRID_GAP_PX = 8;

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
      const height = node.getBoundingClientRect().height;
      setRowSpan(Math.max(1, Math.ceil((height + GRID_GAP_PX) / (GRID_ROW_PX + GRID_GAP_PX))));
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

  return (
    <div
      ref={element}
      class={`module-slot module-slot--${id}`}
      id={`module-${id}`}
      style={`--module-row-span: ${rowSpan}`}
    >
      {children}
    </div>
  );
}
