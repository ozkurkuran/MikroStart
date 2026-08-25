import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import {
  moveModule,
  moveModuleToIndex,
  type DashboardLayout,
  type ModuleId,
} from "../platform/layoutPreferences";
import {
  resolveDropTarget,
  type ModuleBounds,
  type ModuleDropTarget,
} from "./moduleReorder";

const AUTO_SCROLL_EDGE_PX = 88;
const AUTO_SCROLL_MAX_PX = 18;

export type ReorderAnnouncementKind = "picked" | "preview" | "moved" | "cancelled";

export interface ReorderAnnouncement {
  readonly kind: ReorderAnnouncementKind;
  readonly id: ModuleId;
  readonly position: number;
  readonly total: number;
}

export interface ModuleReorderState {
  readonly activeId?: ModuleId;
  readonly mode?: "pointer" | "keyboard";
  readonly dropTarget?: ModuleDropTarget;
}

interface PointerSession {
  readonly mode: "pointer";
  readonly id: ModuleId;
  readonly pointerId: number;
  readonly handle: HTMLButtonElement;
  readonly startX: number;
  readonly startY: number;
  readonly bounds: readonly ModuleBounds[];
  clientX: number;
  clientY: number;
}

interface KeyboardSession {
  readonly mode: "keyboard";
  readonly id: ModuleId;
  readonly handle: HTMLButtonElement;
  proposedIndex: number;
}

type ReorderSession = PointerSession | KeyboardSession;

interface UseModuleReorderOptions {
  readonly enabled: boolean;
  readonly layout: DashboardLayout;
  readonly visibleIds: readonly ModuleId[];
  readonly onCommit: (layout: DashboardLayout) => void;
  readonly onAnnounce: (announcement: ReorderAnnouncement) => void;
}

interface UseModuleReorderResult {
  readonly state: ModuleReorderState;
  readonly registerSlot: (id: ModuleId, node: HTMLDivElement | null) => void;
  readonly onHandlePointerDown: (
    id: ModuleId,
    event: JSX.TargetedPointerEvent<HTMLButtonElement>,
  ) => void;
  readonly onHandleKeyDown: (
    id: ModuleId,
    event: JSX.TargetedKeyboardEvent<HTMLButtonElement>,
  ) => void;
  readonly onHandleBlur: (id: ModuleId) => void;
  readonly cancel: () => void;
}

function sameDropTarget(
  left: ModuleDropTarget | undefined,
  right: ModuleDropTarget | undefined,
): boolean {
  return left?.targetId === right?.targetId
    && left?.placement === right?.placement
    && left?.edge === right?.edge;
}

function keyboardDropTarget(
  order: readonly ModuleId[],
  draggedId: ModuleId,
  requestedIndex: number,
): ModuleDropTarget | undefined {
  const remaining = order.filter((id) => id !== draggedId);
  if (remaining.length === 0) return undefined;
  if (requestedIndex >= remaining.length) {
    return { targetId: remaining.at(-1)!, placement: "after", edge: "bottom" };
  }
  return { targetId: remaining[Math.max(0, requestedIndex)], placement: "before", edge: "top" };
}

export function useModuleReorder({
  enabled,
  layout,
  visibleIds,
  onCommit,
  onAnnounce,
}: UseModuleReorderOptions): UseModuleReorderResult {
  const [state, setState] = useState<ModuleReorderState>({});
  const stateRef = useRef<ModuleReorderState>({});
  const sessionRef = useRef<ReorderSession>();
  const slotsRef = useRef(new Map<ModuleId, HTMLDivElement>());
  const autoScrollFrameRef = useRef(0);
  const layoutAnimationFrameRef = useRef(0);
  const layoutRef = useRef(layout);
  const visibleIdsRef = useRef(visibleIds);
  const onCommitRef = useRef(onCommit);
  const onAnnounceRef = useRef(onAnnounce);

  layoutRef.current = layout;
  visibleIdsRef.current = visibleIds;
  onCommitRef.current = onCommit;
  onAnnounceRef.current = onAnnounce;

  const updateState = useCallback((next: ModuleReorderState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const announce = useCallback((kind: ReorderAnnouncementKind, id: ModuleId, position: number) => {
    onAnnounceRef.current({
      kind,
      id,
      position: position + 1,
      total: layoutRef.current.order.length,
    });
  }, []);

  const clearSession = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = undefined;
    if (autoScrollFrameRef.current) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = 0;
    }
    if (session?.mode === "pointer") {
      const slot = slotsRef.current.get(session.id);
      slot?.style.removeProperty("--drag-x");
      slot?.style.removeProperty("--drag-y");
      if (session.handle.hasPointerCapture(session.pointerId)) {
        session.handle.releasePointerCapture(session.pointerId);
      }
    }
    updateState({});
  }, [updateState]);

  const cancel = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const currentIndex = layoutRef.current.order.indexOf(session.id);
    announce("cancelled", session.id, Math.max(0, currentIndex));
    clearSession();
  }, [announce, clearSession]);

  const captureSlotPositions = useCallback(() => {
    const positions = new Map<ModuleId, { left: number; top: number }>();
    for (const id of visibleIdsRef.current) {
      const rect = slotsRef.current.get(id)?.getBoundingClientRect();
      if (rect) positions.set(id, { left: rect.left, top: rect.top });
    }
    return positions;
  }, []);

  const animateLayoutFrom = useCallback((before: ReadonlyMap<ModuleId, { left: number; top: number }>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (layoutAnimationFrameRef.current) cancelAnimationFrame(layoutAnimationFrameRef.current);
    layoutAnimationFrameRef.current = requestAnimationFrame(() => {
      layoutAnimationFrameRef.current = 0;
      for (const [id, previous] of before) {
        const node = slotsRef.current.get(id);
        if (!node) continue;
        const current = node.getBoundingClientRect();
        const deltaX = previous.left - current.left;
        const deltaY = previous.top - current.top;
        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue;
        node.getAnimations().forEach((animation) => animation.cancel());
        node.animate(
          [
            { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
            { transform: "translate3d(0, 0, 0)" },
          ],
          { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
      }
    });
  }, []);

  const applyPointerPosition = useCallback((session: PointerSession) => {
    const point = {
      x: session.clientX + window.scrollX,
      y: session.clientY + window.scrollY,
    };
    const slot = slotsRef.current.get(session.id);
    slot?.style.setProperty("--drag-x", `${point.x - session.startX}px`);
    slot?.style.setProperty("--drag-y", `${point.y - session.startY}px`);

    const dropTarget = resolveDropTarget(point, session.bounds, session.id);
    if (!sameDropTarget(dropTarget, stateRef.current.dropTarget)) {
      updateState({ activeId: session.id, mode: "pointer", dropTarget });
    }
  }, [updateState]);

  const tickAutoScroll = useCallback(function tickAutoScroll() {
    autoScrollFrameRef.current = 0;
    const session = sessionRef.current;
    if (!session || session.mode !== "pointer") return;

    let velocity = 0;
    if (session.clientY < AUTO_SCROLL_EDGE_PX) {
      velocity = -AUTO_SCROLL_MAX_PX * (1 - session.clientY / AUTO_SCROLL_EDGE_PX);
    } else if (session.clientY > window.innerHeight - AUTO_SCROLL_EDGE_PX) {
      velocity = AUTO_SCROLL_MAX_PX
        * (1 - (window.innerHeight - session.clientY) / AUTO_SCROLL_EDGE_PX);
    }

    if (Math.abs(velocity) < 0.5) return;
    const previousScrollY = window.scrollY;
    window.scrollBy(0, velocity);
    if (window.scrollY === previousScrollY) return;
    applyPointerPosition(session);
    autoScrollFrameRef.current = requestAnimationFrame(tickAutoScroll);
  }, [applyPointerPosition]);

  const ensureAutoScroll = useCallback(() => {
    if (!autoScrollFrameRef.current) {
      autoScrollFrameRef.current = requestAnimationFrame(tickAutoScroll);
    }
  }, [tickAutoScroll]);

  const finishPointer = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.mode !== "pointer") return;
    const dropTarget = stateRef.current.dropTarget;
    const currentLayout = layoutRef.current;
    const next = dropTarget
      ? moveModule(currentLayout, session.id, dropTarget.targetId, dropTarget.placement)
      : currentLayout;
    if (next !== currentLayout) {
      const before = captureSlotPositions();
      onCommitRef.current(next);
      animateLayoutFrom(before);
    }
    announce("moved", session.id, next.order.indexOf(session.id));
    clearSession();
  }, [animateLayoutFrom, announce, captureSlotPositions, clearSession]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || session.mode !== "pointer" || event.pointerId !== session.pointerId) return;
      event.preventDefault();
      session.clientX = event.clientX;
      session.clientY = event.clientY;
      applyPointerPosition(session);
      ensureAutoScroll();
    }

    function handlePointerUp(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || session.mode !== "pointer" || event.pointerId !== session.pointerId) return;
      finishPointer();
    }

    function handlePointerCancel(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || session.mode !== "pointer" || event.pointerId !== session.pointerId) return;
      cancel();
    }

    function handleLostCapture(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || session.mode !== "pointer" || event.pointerId !== session.pointerId) return;
      cancel();
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !sessionRef.current) return;
      event.preventDefault();
      cancel();
    }

    function handleScroll() {
      const session = sessionRef.current;
      if (session?.mode === "pointer") applyPointerPosition(session);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("lostpointercapture", handleLostCapture);
    window.addEventListener("keydown", handleWindowKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("lostpointercapture", handleLostCapture);
      window.removeEventListener("keydown", handleWindowKeyDown);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("blur", cancel);
      if (layoutAnimationFrameRef.current) {
        cancelAnimationFrame(layoutAnimationFrameRef.current);
        layoutAnimationFrameRef.current = 0;
      }
      clearSession();
    };
  }, [applyPointerPosition, cancel, clearSession, ensureAutoScroll, finishPointer]);

  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  const registerSlot = useCallback((id: ModuleId, node: HTMLDivElement | null) => {
    if (node) slotsRef.current.set(id, node);
    else slotsRef.current.delete(id);
  }, []);

  const onHandlePointerDown = useCallback((
    id: ModuleId,
    event: JSX.TargetedPointerEvent<HTMLButtonElement>,
  ) => {
    if (!enabled || !event.isPrimary || event.button !== 0) return;
    cancel();
    event.preventDefault();

    const bounds = visibleIdsRef.current.flatMap((moduleId): ModuleBounds[] => {
      const node = slotsRef.current.get(moduleId);
      if (!node) return [];
      const rect = node.getBoundingClientRect();
      return [{
        id: moduleId,
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        right: rect.right + window.scrollX,
        bottom: rect.bottom + window.scrollY,
      }];
    });

    const handle = event.currentTarget;
    const pointX = event.clientX + window.scrollX;
    const pointY = event.clientY + window.scrollY;
    const session: PointerSession = {
      mode: "pointer",
      id,
      pointerId: event.pointerId,
      handle,
      startX: pointX,
      startY: pointY,
      bounds,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    sessionRef.current = session;
    handle.setPointerCapture(event.pointerId);
    updateState({ activeId: id, mode: "pointer" });
    announce("picked", id, layoutRef.current.order.indexOf(id));
  }, [announce, cancel, enabled, updateState]);

  const onHandleKeyDown = useCallback((
    id: ModuleId,
    event: JSX.TargetedKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!enabled) return;
    const session = sessionRef.current;
    if (!session) {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      const index = layoutRef.current.order.indexOf(id);
      if (index < 0) return;
      sessionRef.current = {
        mode: "keyboard",
        id,
        handle: event.currentTarget,
        proposedIndex: index,
      };
      updateState({ activeId: id, mode: "keyboard" });
      announce("picked", id, index);
      return;
    }
    if (session.mode !== "keyboard" || session.id !== id) return;

    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const currentLayout = layoutRef.current;
      const next = moveModuleToIndex(currentLayout, id, session.proposedIndex);
      if (next !== currentLayout) {
        const before = captureSlotPositions();
        onCommitRef.current(next);
        animateLayoutFrom(before);
      }
      announce("moved", id, next.order.indexOf(id));
      clearSession();
      return;
    }

    let nextIndex = session.proposedIndex;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex -= 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex += 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = layoutRef.current.order.length - 1;
    else return;

    event.preventDefault();
    nextIndex = Math.max(0, Math.min(nextIndex, layoutRef.current.order.length - 1));
    session.proposedIndex = nextIndex;
    const dropTarget = keyboardDropTarget(layoutRef.current.order, id, nextIndex);
    updateState({ activeId: id, mode: "keyboard", dropTarget });
    announce("preview", id, nextIndex);
  }, [animateLayoutFrom, announce, cancel, captureSlotPositions, clearSession, enabled, updateState]);

  const onHandleBlur = useCallback((id: ModuleId) => {
    const session = sessionRef.current;
    if (session?.mode === "keyboard" && session.id === id) cancel();
  }, [cancel]);

  return {
    state,
    registerSlot,
    onHandlePointerDown,
    onHandleKeyDown,
    onHandleBlur,
    cancel,
  };
}
