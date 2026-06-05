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
import { ENCOUNTER_REGISTRY } from "../data/encounters.ts";
import { generateReward } from "./RewardManager.ts";
import { levelForXp, nextThresholdXp } from "./Leveling.ts";

function makeState(currentNodeId: string, visitedNodeIds: string[] = []): MapState {
  return {
    currentNodeId,
    visitedNodeIds,
    nodesCleared: visitedNodeIds.length,
    elitesDefeated: 0,
    bossDefeated: false,
  };
}

function reachesBossWithout(template: MapTemplate, blockedNodeId: string): boolean {
  if (template.startNodeId === blockedNodeId || template.bossNodeId === blockedNodeId) return false;
  const nodes = new Map(template.nodes.map((n) => [n.id, n]));
  const visited = new Set<string>([template.startNodeId]);
  const queue: string[] = [template.startNodeId];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === template.bossNodeId) return true;
    const node = nodes.get(cur);
    if (!node) continue;
    for (const next of node.nextNodeIds) {
      if (next === blockedNodeId || visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }

  return false;
}

function pathXpBeforeBoss(template: MapTemplate, path: string[]): number {
  const nodes = new Map(template.nodes.map((n) => [n.id, n]));
  return path
    .filter((id) => id !== template.bossNodeId)
    .map((id) => nodes.get(id)!)
    .filter((node) => node.type === "combat" || node.type === "elite")
    .reduce((total, node) => {
      const encounter = ENCOUNTER_REGISTRY[node.encounterId!];
      return total + generateReward(encounter, () => 0.5).xpPerHero;
    }, 0);
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

describe("long template structure (#95)", () => {
  const template = MAP_TEMPLATES.long;
  const nodes = new Map(template.nodes.map((n) => [n.id, n]));
  const paths = enumerateRootToBossPaths(template);

  it("has 15-20 nodes across multiple layers", () => {
    expect(template.nodes.length).toBeGreaterThanOrEqual(15);
    expect(template.nodes.length).toBeLessThanOrEqual(20);
    const layerCount = new Set(template.nodes.map((n) => n.layer)).size;
    expect(layerCount).toBeGreaterThanOrEqual(8);
  });

  it("has the requested single-act composition", () => {
    const combatNodes = template.nodes.filter((n) => n.type === "combat");
    const eliteNodes = template.nodes.filter((n) => n.type === "elite");
    const bossNodes = template.nodes.filter((n) => n.type === "boss");
    const nonCombatNodes = template.nodes.filter((n) =>
      n.type === "shop" || n.type === "camp" || n.type === "event" || n.type === "recruit" || n.type === "pet",
    );

    expect(combatNodes).toHaveLength(8);
    expect(eliteNodes).toHaveLength(1);
    expect(nonCombatNodes).toHaveLength(4);
    expect(bossNodes).toHaveLength(1);
    expect(nonCombatNodes.filter((n) => n.type === "camp")).toHaveLength(2);
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

  it("every root->boss path crosses both recovery (camp) segment boundaries", () => {
    for (const path of paths) {
      const recoveryIds = path.filter((id) => RECOVERY_NODE_TYPES.has(nodes.get(id)!.type));
      expect(recoveryIds).toEqual(["node.long_camp_a", "node.long_camp_b"]);
    }
  });

  it("uses both camps as cut vertices", () => {
    expect(reachesBossWithout(template, "node.long_camp_a")).toBe(false);
    expect(reachesBossWithout(template, "node.long_camp_b")).toBe(false);
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

  it("paces every root->boss path to level 4 before the boss without reaching level 5", () => {
    const level5Threshold = nextThresholdXp(4)!;

    for (const path of paths) {
      const xp = pathXpBeforeBoss(template, path);
      expect(levelForXp(xp), path.join(" -> ")).toBeGreaterThanOrEqual(4);
      expect(xp, path.join(" -> ")).toBeLessThan(level5Threshold);
    }
  });
});
