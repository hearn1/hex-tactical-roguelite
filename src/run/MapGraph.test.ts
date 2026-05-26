import { describe, it, expect } from "vitest";
import { availableNextNodes, visitNode, bfsReachesBoss } from "./MapGraph.ts";
import type { MapState } from "./MapGraph.ts";
import { ALL_NODES, NODE_REGISTRY } from "../data/nodes.ts";

function makeState(currentNodeId: string, visitedNodeIds: string[] = []): MapState {
  return {
    currentNodeId,
    visitedNodeIds,
    nodesCleared: visitedNodeIds.length,
    elitesDefeated: 0,
    bossDefeated: false,
  };
}

describe("MapGraph", () => {
  it("from start available next is combat_a and combat_b", () => {
    const state = makeState("node.start", ["node.start"]);
    const available = availableNextNodes(state);
    expect(available).toContain("node.combat_a");
    expect(available).toContain("node.combat_b");
    expect(available.length).toBe(2);
  });

  it("after visiting combat_a, available next is shop_1 and event_1", () => {
    const state = makeState("node.start", ["node.start"]);
    visitNode(state, "node.combat_a");
    expect(state.currentNodeId).toBe("node.combat_a");
    const available = availableNextNodes(state);
    expect(available).toContain("node.shop_1");
    expect(available).toContain("node.event_1");
    expect(available.length).toBe(2);
  });

  it("BFS from start reaches boss", () => {
    expect(bfsReachesBoss()).toBe(true);
  });

  it("no node points to itself", () => {
    for (const node of ALL_NODES) {
      expect(node.nextNodeIds.includes(node.id)).toBe(false);
    }
  });

  it("no edge points to a non-existent node", () => {
    for (const node of ALL_NODES) {
      for (const nextId of node.nextNodeIds) {
        expect(NODE_REGISTRY[nextId]).toBeDefined();
      }
    }
  });
});
