import { describe, it, expect } from "vitest";
import {
  availableNextNodes,
  visitNode,
  bfsReachesBoss,
  reachableNodeIds,
  enumerateRootToBossPaths,
  RECOVERY_NODE_TYPES,
} from "./MapGraph.ts";
import type { MapState } from "./MapGraph.ts";
import { ALL_NODES, NODE_REGISTRY, MAP_TEMPLATES, getMapTemplate } from "../data/nodes.ts";
import type { MapTemplate } from "../data/nodes.ts";

function makeState(currentNodeId: string, visitedNodeIds: string[] = []): MapState {
  return {
    currentNodeId,
    visitedNodeIds,
    nodesCleared: visitedNodeIds.length,
    elitesDefeated: 0,
    bossDefeated: false,
  };
}

describe("MapGraph navigation", () => {
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

describe("getMapTemplate", () => {
  it("returns the requested template", () => {
    expect(getMapTemplate("long").id).toBe("long");
    expect(getMapTemplate("short").id).toBe("short");
  });

  it("falls back to short for unknown/undefined ids", () => {
    expect(getMapTemplate(undefined).id).toBe("short");
    expect(getMapTemplate("nope").id).toBe("short");
  });
});

describe.each(Object.values(MAP_TEMPLATES))("MapTemplate invariants: %s", (template: MapTemplate) => {
  it("boss is reachable from start", () => {
    expect(bfsReachesBoss(template)).toBe(true);
  });

  it("every node reachable from start can also reach the boss (no dead ends)", () => {
    // If every reachable non-boss node has at least one outgoing edge and the only
    // sink is the boss, then every valid path necessarily terminates at the boss.
    const reachable = reachableNodeIds(template);
    const nodes = new Map(template.nodes.map((n) => [n.id, n]));
    for (const id of reachable) {
      const node = nodes.get(id)!;
      if (id === template.bossNodeId) {
        expect(node.nextNodeIds.length).toBe(0);
      } else {
        expect(node.nextNodeIds.length).toBeGreaterThan(0);
      }
    }
  });

  it("every root->boss path ends at the boss", () => {
    const paths = enumerateRootToBossPaths(template);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path[0]).toBe(template.startNodeId);
      expect(path[path.length - 1]).toBe(template.bossNodeId);
    }
  });
});

describe("long template structure (F26 / #57)", () => {
  const template = MAP_TEMPLATES.long;
  const nodes = new Map(template.nodes.map((n) => [n.id, n]));
  const paths = enumerateRootToBossPaths(template);

  it("has ~12 nodes across multiple layers", () => {
    expect(template.nodes.length).toBe(12);
    const layerCount = new Set(template.nodes.map((n) => n.layer)).size;
    expect(layerCount).toBeGreaterThanOrEqual(6);
  });

  it("offers at least two meaningful branch points", () => {
    const branchPoints = template.nodes.filter((n) => n.nextNodeIds.length >= 2);
    expect(branchPoints.length).toBeGreaterThanOrEqual(2);
  });

  it("every root->boss path crosses at least one shop", () => {
    for (const path of paths) {
      const hasShop = path.some((id) => nodes.get(id)!.type === "shop");
      expect(hasShop).toBe(true);
    }
  });

  it("every root->boss path crosses at least one recovery (camp) node", () => {
    for (const path of paths) {
      const hasRecovery = path.some((id) => RECOVERY_NODE_TYPES.has(nodes.get(id)!.type));
      expect(hasRecovery).toBe(true);
    }
  });

  it("has an optional elite that at least one path skips and at least one path includes", () => {
    const eliteIds = template.nodes.filter((n) => n.type === "elite").map((n) => n.id);
    expect(eliteIds.length).toBeGreaterThanOrEqual(1);
    const elite = eliteIds[0];
    expect(paths.some((p) => p.includes(elite))).toBe(true); // reachable
    expect(paths.some((p) => !p.includes(elite))).toBe(true); // skippable
  });

  it("all referenced encounters resolve in the registry-merged node set", () => {
    for (const node of template.nodes) {
      if (node.encounterId) {
        expect(NODE_REGISTRY[node.id]?.encounterId).toBe(node.encounterId);
      }
    }
  });
});
