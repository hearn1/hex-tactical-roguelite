import { NODE_REGISTRY } from "../data/nodes.ts";
import type { MapTemplate, NodeDef, NodeType } from "../data/nodes.ts";
import type { SideQuestDefinition } from "../data/sideQuests.ts";
import type { EventDef } from "../data/events.ts";

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
export const RECOVERY_NODE_TYPES = new Set<NodeType>(["camp"]);

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

/**
 * Validates the structural integrity of a map template.
 * Returns an array of error strings; an empty array means the template is valid.
 *
 * Checks performed:
 * - Start and boss node IDs exist in the template's node list.
 * - No duplicate node IDs.
 * - All nextNodeIds reference nodes within the template.
 * - returnNodeId (on side_route_return nodes) references a node within the template.
 * - Boss node has no outgoing edges.
 * - Boss is reachable from start.
 * - Every side_route_start has at least one reachable side_route_return.
 */
export function validateMapTemplate(template: MapTemplate): string[] {
  const errors: string[] = [];
  const nodeMap = new Map(template.nodes.map((n) => [n.id, n]));

  if (nodeMap.size !== template.nodes.length) {
    const seen = new Set<string>();
    for (const node of template.nodes) {
      if (seen.has(node.id)) errors.push(`Duplicate node id "${node.id}"`);
      seen.add(node.id);
    }
  }

  if (!nodeMap.has(template.startNodeId)) {
    errors.push(`Start node "${template.startNodeId}" not found in template nodes`);
  }

  if (!nodeMap.has(template.bossNodeId)) {
    errors.push(`Boss node "${template.bossNodeId}" not found in template nodes`);
  }

  for (const node of template.nodes) {
    for (const nextId of node.nextNodeIds) {
      if (!nodeMap.has(nextId)) {
        errors.push(`Node "${node.id}" has invalid nextNodeId "${nextId}"`);
      }
    }
    if (node.returnNodeId !== undefined && !nodeMap.has(node.returnNodeId)) {
      errors.push(`Node "${node.id}" has invalid returnNodeId "${node.returnNodeId}"`);
    }
  }

  const bossNode = nodeMap.get(template.bossNodeId);
  if (bossNode && bossNode.nextNodeIds.length > 0) {
    errors.push(`Boss node "${template.bossNodeId}" must have no outgoing edges`);
  }

  if (errors.length === 0 && !bfsReachesBoss(template)) {
    errors.push("No path from start node to boss node");
  }

  for (const node of template.nodes) {
    if (node.type !== "side_route_start") continue;
    const visited = new Set<string>();
    const queue: string[] = [node.id];
    let hasReturn = false;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const curNode = nodeMap.get(cur);
      if (!curNode) continue;
      if (curNode.type === "side_route_return") { hasReturn = true; break; }
      for (const next of curNode.nextNodeIds) queue.push(next);
    }
    if (!hasReturn) {
      errors.push(`side_route_start "${node.id}" has no reachable side_route_return`);
    }
  }

  return errors;
}

/**
 * Validates that quest node metadata in the template references known quest/stage/step IDs
 * and valid outcome hooks. Returns an array of error strings; empty means valid.
 *
 * Called separately from validateMapTemplate so callers can opt in to quest-registry checks
 * without making the core structural validator depend on the side quest registry.
 */
export function validateQuestNodeReferences(
  template: MapTemplate,
  questRegistry: Record<string, SideQuestDefinition>,
  eventRegistry?: Record<string, EventDef>,
): string[] {
  const errors: string[] = [];

  for (const node of template.nodes) {
    if (node.eventId && eventRegistry && !eventRegistry[node.eventId]) {
      errors.push(`Node "${node.id}" references unknown eventId "${node.eventId}"`);
    }

    if (!node.questId) continue;

    const quest = questRegistry[node.questId];
    if (!quest) {
      errors.push(`Node "${node.id}" references unknown questId "${node.questId}"`);
      continue;
    }

    if (node.questStageId) {
      const stage = quest.stages.find((s) => s.id === node.questStageId);
      if (!stage) {
        errors.push(
          `Node "${node.id}" references unknown questStageId "${node.questStageId}" in quest "${node.questId}"`,
        );
      } else if (node.questStepId) {
        const step = stage.steps.find((st) => st.id === node.questStepId);
        if (!step) {
          errors.push(
            `Node "${node.id}" references unknown questStepId "${node.questStepId}" in stage "${node.questStageId}"`,
          );
        }
      }
    }

    if (
      (node.questNodeRole === "complete" || node.questNodeRole === "fail") &&
      node.questOutcomeHookId !== undefined &&
      !quest.outcomeHookIds.includes(node.questOutcomeHookId)
    ) {
      errors.push(
        `Node "${node.id}" questOutcomeHookId "${node.questOutcomeHookId}" is not in quest "${node.questId}" outcomeHookIds`,
      );
    }
  }

  return errors;
}
