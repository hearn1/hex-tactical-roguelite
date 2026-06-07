import { neighbors, hexKey, parseHexKey } from "../core/hex.ts";
import type { Hex } from "../state/types.ts";

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
