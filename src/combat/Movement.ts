import { distance, neighbors, hexKey, parseHexKey } from "../core/hex.ts";

export function reachableHexes(
  start: { q: number; r: number },
  movePoints: number,
  occupiedKeys: Set<string>,
  gridKeys: Set<string>,
): Map<string, number> {
  const result = new Map<string, number>();
  if (movePoints <= 0) return result;

  const startKey = hexKey(start);
  const occupiedWithoutStart = new Set(occupiedKeys);
  occupiedWithoutStart.delete(startKey);

  const visited = new Set<string>();
  const queue: { key: string; cost: number }[] = [{ key: startKey, cost: 0 }];
  visited.add(startKey);
  result.set(startKey, 0);

  let head = 0;
  while (head < queue.length) {
    const { key, cost } = queue[head++];
    const hex = parseHexKey(key);
    for (const n of neighbors(hex)) {
      const nKey = hexKey(n);
      if (visited.has(nKey)) continue;
      if (!gridKeys.has(nKey)) continue;
      if (occupiedWithoutStart.has(nKey)) continue;
      const nextCost = cost + 1;
      if (nextCost > movePoints) continue;
      visited.add(nKey);
      result.set(nKey, nextCost);
      queue.push({ key: nKey, cost: nextCost });
    }
  }

  return result;
}

export function findPath(
  start: { q: number; r: number },
  end: { q: number; r: number },
  occupiedKeys: Set<string>,
  gridKeys: Set<string>,
  maxCost: number,
): { q: number; r: number }[] | null {
  const endKey = hexKey(end);
  const occupiedWithoutStart = new Set(occupiedKeys);
  occupiedWithoutStart.delete(hexKey(start));

  const visited = new Set<string>();
  const cameFrom = new Map<string, string>();
  const cost = new Map<string, number>();
  const startKey = hexKey(start);
  const queue: string[] = [startKey];
  visited.add(startKey);
  cost.set(startKey, 0);
  cameFrom.set(startKey, "");

  let head = 0;
  while (head < queue.length) {
    const curKey = queue[head++];
    const curCost = cost.get(curKey)!;
    if (curKey === endKey) break;
    if (curCost >= maxCost) continue;
    const cur = parseHexKey(curKey);
    for (const n of neighbors(cur)) {
      const nKey = hexKey(n);
      if (visited.has(nKey)) continue;
      if (!gridKeys.has(nKey)) continue;
      if (nKey !== endKey && occupiedWithoutStart.has(nKey)) continue;
      visited.add(nKey);
      cost.set(nKey, curCost + 1);
      cameFrom.set(nKey, curKey);
      queue.push(nKey);
    }
  }

  if (!cost.has(endKey)) return null;

  const path: { q: number; r: number }[] = [];
  let cur = endKey;
  while (cur !== startKey) {
    path.unshift(parseHexKey(cur));
    cur = cameFrom.get(cur)!;
  }
  return path;
}
