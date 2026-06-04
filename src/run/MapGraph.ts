import { NODE_REGISTRY } from "../data/nodes.ts";
import type { MapTemplate, NodeDef } from "../data/nodes.ts";

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
}

/** Node types that count as a "recovery" stop for path-guarantee checks. */
export const RECOVERY_NODE_TYPES = new Set<NodeDef["type"]>(["camp"]);

function templateNodeMap(template: MapTemplate): Map<string, NodeDef> {
  return new Map(template.nodes.map((n) => [n.id, n]));
}

/** True if the template's boss node is reachable from its start node. */
export function bfsReachesBoss(template: MapTemplate): boolean {
  const nodes = templateNodeMap(template);
  const visited = new Set<string>([template.startNodeId]);
  const queue: string[] = [template.startNodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === template.bossNodeId) return true;
    const node = nodes.get(cur);
    if (!node) continue;
    for (const next of node.nextNodeIds) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/** All node ids reachable from the template's start node (inclusive). */
export function reachableNodeIds(template: MapTemplate): Set<string> {
  const nodes = templateNodeMap(template);
  const visited = new Set<string>([template.startNodeId]);
  const queue: string[] = [template.startNodeId];
  while (queue.length > 0) {
    const node = nodes.get(queue.shift()!);
    if (!node) continue;
    for (const next of node.nextNodeIds) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

/**
 * Enumerates every simple path from the template's start node to its boss node.
 * The templates are small DAGs, so exhaustive enumeration is cheap and lets tests
 * assert per-path invariants (e.g. every path crosses a shop and a recovery node).
 */
export function enumerateRootToBossPaths(template: MapTemplate): string[][] {
  const nodes = templateNodeMap(template);
  const paths: string[][] = [];
  const walk = (id: string, trail: string[]): void => {
    if (id === template.bossNodeId) {
      paths.push([...trail, id]);
      return;
    }
    const node = nodes.get(id);
    if (!node) return;
    for (const next of node.nextNodeIds) {
      if (trail.includes(id) && trail.includes(next)) continue; // guard against cycles
      walk(next, [...trail, id]);
    }
  };
  walk(template.startNodeId, []);
  return paths;
}
