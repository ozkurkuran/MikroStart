import type { ModuleId, ModulePlacement } from "../platform/layoutPreferences";

export interface DragPoint {
  readonly x: number;
  readonly y: number;
}

export interface ModuleBounds {
  readonly id: ModuleId;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export type DropEdge = "top" | "right" | "bottom" | "left";

export interface ModuleDropTarget {
  readonly targetId: ModuleId;
  readonly placement: ModulePlacement;
  readonly edge: DropEdge;
}

function distanceToBounds(point: DragPoint, bounds: ModuleBounds): number {
  const dx = point.x < bounds.left
    ? bounds.left - point.x
    : point.x > bounds.right
      ? point.x - bounds.right
      : 0;
  const dy = point.y < bounds.top
    ? bounds.top - point.y
    : point.y > bounds.bottom
      ? point.y - bounds.bottom
      : 0;
  return dx * dx + dy * dy;
}

function centerDistance(point: DragPoint, bounds: ModuleBounds): number {
  const dx = point.x - (bounds.left + bounds.right) / 2;
  const dy = point.y - (bounds.top + bounds.bottom) / 2;
  return dx * dx + dy * dy;
}

function hasMultipleColumns(bounds: readonly ModuleBounds[]): boolean {
  if (bounds.length < 2) return false;
  const firstLeft = bounds[0].left;
  return bounds.some((candidate) => Math.abs(candidate.left - firstLeft) > 8);
}

function nearestEdge(point: DragPoint, bounds: ModuleBounds): DropEdge {
  const distances: ReadonlyArray<readonly [DropEdge, number]> = [
    ["top", Math.abs(point.y - bounds.top)],
    ["right", Math.abs(point.x - bounds.right)],
    ["bottom", Math.abs(point.y - bounds.bottom)],
    ["left", Math.abs(point.x - bounds.left)],
  ];
  return distances.reduce((best, candidate) => candidate[1] < best[1] ? candidate : best)[0];
}

/** Resolves a two-dimensional pointer position to a deterministic list move. */
export function resolveDropTarget(
  point: DragPoint,
  allBounds: readonly ModuleBounds[],
  draggedId: ModuleId,
): ModuleDropTarget | undefined {
  const candidates = allBounds.filter((bounds) => bounds.id !== draggedId);
  if (candidates.length === 0) return undefined;

  const target = [...candidates].sort((left, right) => {
    const boundaryDifference = distanceToBounds(point, left) - distanceToBounds(point, right);
    return boundaryDifference || centerDistance(point, left) - centerDistance(point, right);
  })[0];

  const edge = hasMultipleColumns(candidates)
    ? nearestEdge(point, target)
    : point.y < (target.top + target.bottom) / 2
      ? "top"
      : "bottom";

  return {
    targetId: target.id,
    placement: edge === "top" || edge === "left" ? "before" : "after",
    edge,
  };
}
