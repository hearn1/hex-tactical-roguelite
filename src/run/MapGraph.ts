import { NODE_REGISTRY } from "../data/nodes.ts";

export interface MapState {
  currentNodeId: string;
  visitedNodeIds: string[];
  nodesCleared: number;
  elitesDefeated: number;
  bossDefeated: boolean;
}

export function availableNextNodes(mapState: MapState): string[] {
  const node = NODE_REGISTRY[mapState.currentNodeId];
  if (!node) return [];
  return node.nextNodeIds.filter((id) => !mapState.visitedNodeIds.includes(id));
}

export function visitNode(mapState: MapState, nodeId: string): void {
  if (!NODE_REGISTRY[nodeId]) return;
  const available = availableNextNodes(mapState);
  if (!available.includes(nodeId)) return;
  mapState.currentNodeId = nodeId;
  mapState.visitedNodeIds.push(nodeId);
  if (nodeId === "node.boss") {
    mapState.bossDefeated = true;
  }
}

export function bfsReachesBoss(): boolean {
  const visited = new Set<string>();
  const queue: string[] = ["node.start"];
  visited.add("node.start");
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const node = NODE_REGISTRY[cur];
    if (!node) continue;
    for (const next of node.nextNodeIds) {
      if (next === "node.boss") return true;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}
