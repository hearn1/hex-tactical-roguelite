import { neighbors, hexKey, parseHexKey } from "../core/hex.ts";
import type { Hex, UnitInstance } from "../state/types.ts";
import type { HazardPathResult } from "./Terrain.ts";

/**
 * Shared outcome shape for every movement entry point (enemy AI moves and player clicks),
 * so callers distinguish a completed move from a hazard-interrupted one through one type.
 */
export interface MovementResult {
  /** Unit reached its intended destination without interruption. */
  completed: boolean;
  /** Movement was cut short because a hazard downed / killed / invalidated the unit. */
  stoppedByHazard: boolean;
  /** The moving unit was downed or defeated during this movement. */
  unitDropped: boolean;
  /** Where the unit actually ended up (the hazard tile if interrupted, else the destination). */
  finalPosition: Hex;
  /** Hexes traversed, excluding the starting hex. */
  pathTaken: Hex[];
}

/**
 * Builds a {@link MovementResult} from the unit's post-move position, the traversed path,
 * and the hazard-layer result (null when no path hazards were evaluated). Keeps
 * {@link HazardPathResult} an internal detail of the terrain layer.
 */
export function toMovementResult(
  unit: UnitInstance,
  path: Hex[],
  hazardResult: HazardPathResult | null,
): MovementResult {
  const stopped = hazardResult?.stoppedEarly ?? false;
  return {
    completed: !stopped,
    stoppedByHazard: stopped,
    unitDropped: stopped,
    finalPosition: { ...unit.pos },
    pathTaken: path,
  };
}

export function reachableHexes(
  start: Hex,
  movePoints: number,
  occupiedKeys: Set<string>,
  gridKeys: Set<string>,
  movementCost?: (hex: Hex) => number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (movePoints <= 0) return result;

  const startKey = hexKey(start);
  const occupiedWithoutStart = new Set(occupiedKeys);
  occupiedWithoutStart.delete(startKey);

  // Dijkstra: correct for variable terrain costs (uniform cost = BFS equivalent).
  const dist = new Map<string, number>();
  dist.set(startKey, 0);
  result.set(startKey, 0);

  // Simple priority queue for the small 37-hex grid.
  const queue: { key: string; c: number }[] = [{ key: startKey, c: 0 }];

  while (queue.length > 0) {
    // Extract minimum-cost entry.
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].c < queue[minIdx].c) minIdx = i;
    }
    const { key: curKey, c: curCost } = queue[minIdx];
    queue.splice(minIdx, 1);

    if (curCost > (dist.get(curKey) ?? Infinity)) continue;

    const cur = parseHexKey(curKey);
    for (const n of neighbors(cur)) {
      const nKey = hexKey(n);
      if (!gridKeys.has(nKey)) continue;
      if (occupiedWithoutStart.has(nKey)) continue;
      const stepCost = movementCost ? movementCost(n) : 1;
      const nextCost = curCost + stepCost;
      if (nextCost > movePoints) continue;
      const prev = dist.get(nKey);
      if (prev !== undefined && prev <= nextCost) continue;
      dist.set(nKey, nextCost);
      result.set(nKey, nextCost);
      queue.push({ key: nKey, c: nextCost });
    }
  }

  return result;
}

export function findPath(
  start: Hex,
  end: Hex,
  occupiedKeys: Set<string>,
  gridKeys: Set<string>,
  maxCost: number,
  movementCost?: (hex: Hex) => number,
): Hex[] | null {
  const endKey = hexKey(end);
  const startKey = hexKey(start);
  const occupiedWithoutStart = new Set(occupiedKeys);
  occupiedWithoutStart.delete(startKey);

  // Dijkstra for cheapest path within maxCost.
  const dist = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  dist.set(startKey, 0);
  cameFrom.set(startKey, "");

  const queue: { key: string; c: number }[] = [{ key: startKey, c: 0 }];

  while (queue.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].c < queue[minIdx].c) minIdx = i;
    }
    const { key: curKey, c: curCost } = queue[minIdx];
    queue.splice(minIdx, 1);

    if (curKey === endKey) break;
    if (curCost > (dist.get(curKey) ?? Infinity)) continue;

    const cur = parseHexKey(curKey);
    for (const n of neighbors(cur)) {
      const nKey = hexKey(n);
      if (!gridKeys.has(nKey)) continue;
      if (nKey !== endKey && occupiedWithoutStart.has(nKey)) continue;
      const stepCost = movementCost ? movementCost(n) : 1;
      const nextCost = curCost + stepCost;
      if (nextCost > maxCost) continue;
      const prev = dist.get(nKey);
      if (prev !== undefined && prev <= nextCost) continue;
      dist.set(nKey, nextCost);
      cameFrom.set(nKey, curKey);
      queue.push({ key: nKey, c: nextCost });
    }
  }

  if (!dist.has(endKey)) return null;

  const path: Hex[] = [];
  let cur = endKey;
  while (cur !== startKey) {
    path.unshift(parseHexKey(cur));
    cur = cameFrom.get(cur)!;
  }
  return path;
}
