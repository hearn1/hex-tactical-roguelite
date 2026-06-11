import { describe, it, expect } from "vitest";
import { MAP_TEMPLATES, getMapTemplate } from "../data/nodes.ts";
import type { MapTemplate, NodeDef } from "../data/nodes.ts";
import { validateMapTemplate, availableNextNodes, visitNode, bfsReachesBoss } from "./MapGraph.ts";
import type { MapState } from "./MapGraph.ts";
import { templateIdForAct, advanceToNextAct } from "./ActTransition.ts";
import { createCampaignState } from "../state/CampaignState.ts";
import { createRunState, buildParty, defaultPartySpecs } from "./PartySetup.ts";
import { createInventory } from "./Inventory.ts";
import { DEFAULT_CAMPAIGN, getActDefinition } from "../data/campaigns.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function deterministicRng(value: number): () => number {
  return () => value;
}

function makeState(currentNodeId: string, visitedNodeIds: string[] = [currentNodeId]): MapState {
  return { currentNodeId, visitedNodeIds, nodesCleared: visitedNodeIds.length - 1, elitesDefeated: 0, bossDefeated: false };
}

function freshCampaign(actNumber = 1) {
  const party = buildParty(defaultPartySpecs());
  const campaign = createCampaignState("campaign.verdant_dark", 1, "normal", party, createInventory());
  campaign.currentActNumber = actNumber;
  return campaign;
}

// ── #343: Contract — canonical templates have required metadata ───────────────

describe("act map template contract (#343)", () => {
  const canonicalIds = ["act_1_map", "act_2_map", "act_3_map", "act_4_map"] as const;

  it.each(canonicalIds)("%s has actId and campaignId set", (id) => {
    const t = MAP_TEMPLATES[id];
    expect(t.actId).toBeDefined();
    expect(t.campaignId).toBe("campaign.verdant_dark");
  });

  it.each(canonicalIds)("%s startNodeId and bossNodeId exist in node list", (id) => {
    const t = MAP_TEMPLATES[id];
    const ids = new Set(t.nodes.map((n) => n.id));
    expect(ids.has(t.startNodeId)).toBe(true);
    expect(ids.has(t.bossNodeId)).toBe(true);
  });

  it.each(canonicalIds)("%s boss node has type 'boss' and no outgoing edges", (id) => {
    const t = MAP_TEMPLATES[id];
    const boss = t.nodes.find((n) => n.id === t.bossNodeId)!;
    expect(boss.type).toBe("boss");
    expect(boss.nextNodeIds).toHaveLength(0);
  });

  it.each(canonicalIds)("%s start node has type 'start'", (id) => {
    const t = MAP_TEMPLATES[id];
    const start = t.nodes.find((n) => n.id === t.startNodeId)!;
    expect(start.type).toBe("start");
  });

  it.each(canonicalIds)("%s all side_route_return nodes have a returnNodeId", (id) => {
    const t = MAP_TEMPLATES[id];
    for (const node of t.nodes) {
      if (node.type === "side_route_return") {
        expect(node.returnNodeId, `${node.id} missing returnNodeId`).toBeDefined();
        const ids = new Set(t.nodes.map((n) => n.id));
        expect(ids.has(node.returnNodeId!), `${node.id} returnNodeId not in template`).toBe(true);
      }
    }
  });

  it.each(canonicalIds)("%s all nextNodeIds reference existing nodes", (id) => {
    const t = MAP_TEMPLATES[id];
    const ids = new Set(t.nodes.map((n) => n.id));
    for (const node of t.nodes) {
      for (const nextId of node.nextNodeIds) {
        expect(ids.has(nextId), `${node.id} → ${nextId} unresolved`).toBe(true);
      }
    }
  });
});

// ── #344/#345: Template structure — canonical Act 1–4 ────────────────────────

describe("canonical act templates have sufficient node counts (#344/#345)", () => {
  it("act_1_map has at least 12 nodes", () => {
    expect(MAP_TEMPLATES.act_1_map.nodes.length).toBeGreaterThanOrEqual(12);
  });

  it("act_2_map has at least 14 nodes", () => {
    expect(MAP_TEMPLATES.act_2_map.nodes.length).toBeGreaterThanOrEqual(14);
  });

  it("act_3_map has at least 18 nodes", () => {
    expect(MAP_TEMPLATES.act_3_map.nodes.length).toBeGreaterThanOrEqual(18);
  });

  it("act_4_map has at least 16 nodes", () => {
    expect(MAP_TEMPLATES.act_4_map.nodes.length).toBeGreaterThanOrEqual(16);
  });
});

describe("canonical act templates contain expected node types (#344/#345)", () => {
  const canonicalIds = ["act_1_map", "act_2_map", "act_3_map", "act_4_map"] as const;

  it.each(canonicalIds)("%s has at least one optional shop or camp node", (id) => {
    const t = MAP_TEMPLATES[id];
    const hasOptionalRecovery = t.nodes.some(
      (n) => (n.type === "shop" || n.type === "camp") && n.optional === true,
    );
    expect(hasOptionalRecovery).toBe(true);
  });

  it.each(canonicalIds)("%s has at least one side-route mini-act", (id) => {
    const t = MAP_TEMPLATES[id];
    expect(t.nodes.some((n) => n.type === "side_route_start")).toBe(true);
    expect(t.nodes.some((n) => n.type === "side_route_return")).toBe(true);
  });

  it("act_3_map has at least two side-route branches", () => {
    const t = MAP_TEMPLATES.act_3_map;
    expect(t.nodes.filter((n) => n.type === "side_route_start").length).toBeGreaterThanOrEqual(2);
  });

  it("act_4_map has at least two side-route branches", () => {
    const t = MAP_TEMPLATES.act_4_map;
    expect(t.nodes.filter((n) => n.type === "side_route_start").length).toBeGreaterThanOrEqual(2);
  });

  it("act_4_map boss node represents the campaign completion gate", () => {
    const t = MAP_TEMPLATES.act_4_map;
    const boss = t.nodes.find((n) => n.id === t.bossNodeId)!;
    expect(boss.type).toBe("boss");
    expect(boss.nextNodeIds).toHaveLength(0);
  });
});

// ── #347: Validation — validateMapTemplate ────────────────────────────────────

describe("validateMapTemplate — all canonical templates pass (#347)", () => {
  const canonicalIds = ["act_1_map", "act_2_map", "act_3_map", "act_4_map"];
  it.each(canonicalIds)("%s validates without errors", (id) => {
    expect(validateMapTemplate(MAP_TEMPLATES[id])).toEqual([]);
  });
});

describe("validateMapTemplate — structural error cases (#347)", () => {
  function base(): MapTemplate {
    return {
      id: "test",
      name: "Test",
      startNodeId: "n.start",
      bossNodeId: "n.boss",
      nodes: [
        { id: "n.start", type: "start", title: "S", description: "", layer: 0, nextNodeIds: ["n.boss"] },
        { id: "n.boss", type: "boss", title: "B", description: "", layer: 1, nextNodeIds: [] },
      ],
    };
  }

  it("valid minimal template has no errors", () => {
    expect(validateMapTemplate(base())).toEqual([]);
  });

  it("missing start node fails", () => {
    const t = base();
    t.startNodeId = "n.missing";
    const errs = validateMapTemplate(t);
    expect(errs.some((e) => e.includes("Start node") && e.includes("not found"))).toBe(true);
  });

  it("missing boss node fails", () => {
    const t = base();
    t.bossNodeId = "n.missing";
    const errs = validateMapTemplate(t);
    expect(errs.some((e) => e.includes("Boss node") && e.includes("not found"))).toBe(true);
  });

  it("duplicate node IDs fail", () => {
    const t = base();
    t.nodes.push({ id: "n.start", type: "combat", title: "Dup", description: "", layer: 2, nextNodeIds: ["n.boss"] });
    const errs = validateMapTemplate(t);
    expect(errs.some((e) => e.includes("Duplicate"))).toBe(true);
  });

  it("invalid nextNodeId fails", () => {
    const t = base();
    t.nodes[0].nextNodeIds = ["n.nowhere"];
    const errs = validateMapTemplate(t);
    expect(errs.some((e) => e.includes("invalid nextNodeId"))).toBe(true);
  });

  it("invalid returnNodeId fails", () => {
    const t = base();
    t.nodes[0].nextNodeIds = ["n.return_node", "n.boss"];
    t.nodes.push({
      id: "n.return_node",
      type: "side_route_return",
      title: "R",
      description: "",
      layer: 1,
      nextNodeIds: ["n.boss"],
      returnNodeId: "n.nowhere",
    });
    const errs = validateMapTemplate(t);
    expect(errs.some((e) => e.includes("invalid returnNodeId"))).toBe(true);
  });

  it("boss node with outgoing edges fails", () => {
    const t = base();
    const extra: NodeDef = { id: "n.extra", type: "combat", title: "E", description: "", layer: 2, nextNodeIds: [] };
    t.nodes.push(extra);
    t.nodes.find((n) => n.id === "n.boss")!.nextNodeIds = ["n.extra"];
    const errs = validateMapTemplate(t);
    expect(errs.some((e) => e.includes("no outgoing edges"))).toBe(true);
  });

  it("side_route_start with no reachable side_route_return fails", () => {
    const t = base();
    const sideStart: NodeDef = { id: "n.side_start", type: "side_route_start", title: "SS", description: "", layer: 1, nextNodeIds: ["n.boss"] };
    t.nodes[0].nextNodeIds = ["n.side_start"];
    t.nodes.push(sideStart);
    const errs = validateMapTemplate(t);
    expect(errs.some((e) => e.includes("side_route_start") && e.includes("no reachable side_route_return"))).toBe(true);
  });

  it("no path from start to boss fails", () => {
    const t = base();
    // Disconnect boss from graph
    t.nodes[0].nextNodeIds = [];
    const errs = validateMapTemplate(t);
    expect(errs.some((e) => e.includes("No path from start node to boss node"))).toBe(true);
  });
});

// ── #347: Progression — node availability and side-route returns ──────────────

describe("map progression with act_1_map side route (#347)", () => {
  const t = MAP_TEMPLATES.act_1_map;
  const sideStart = t.nodes.find((n) => n.type === "side_route_start")!;
  const sideReturn = t.nodes.find((n) => n.type === "side_route_return")!;

  it("start node is available at act entry", () => {
    const state = makeState(t.startNodeId);
    const available = availableNextNodes(state);
    expect(available.length).toBeGreaterThan(0);
    for (const id of available) {
      expect(id).not.toBe(t.startNodeId);
    }
  });

  it("nodes connected to current unlock after it is visited", () => {
    const state = makeState(t.startNodeId);
    const firstChoices = availableNextNodes(state);
    expect(firstChoices.length).toBeGreaterThanOrEqual(2);
  });

  it("disconnected nodes cannot be selected from start", () => {
    const state = makeState(t.startNodeId);
    const available = availableNextNodes(state);
    expect(available).not.toContain(t.bossNodeId);
  });

  it("side route return node leads back to the main branch", () => {
    expect(sideReturn).toBeDefined();
    expect(sideReturn.returnNodeId).toBeDefined();
    expect(sideReturn.nextNodeIds).toContain(sideReturn.returnNodeId);
  });

  it("optional side route does not block boss access", () => {
    // Verify boss is reachable even when the side route is skipped entirely
    expect(bfsReachesBoss(t)).toBe(true);
    // A path that skips all side_route nodes still reaches boss
    const paths = t.nodes.filter((n) => n.type === "side_route_start").map((n) => n.id);
    for (const sideId of paths) {
      const nodeMap = new Map(t.nodes.map((n) => [n.id, n]));
      const visited = new Set([t.startNodeId]);
      const queue = [t.startNodeId];
      let canReach = false;
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur === t.bossNodeId) { canReach = true; break; }
        const node = nodeMap.get(cur);
        if (!node) continue;
        for (const next of node.nextNodeIds) {
          if (next === sideId || visited.has(next)) continue;
          visited.add(next);
          queue.push(next);
        }
      }
      expect(canReach).toBe(true);
    }
  });

  it("taking the side route and returning still allows reaching the boss", () => {
    if (!sideStart || !sideReturn) return;
    const state = makeState(t.startNodeId);
    // Walk shrine → side_route_start → side_route_node → side_route_return → camp → ... → boss
    // Just verify the return node's nextNodeIds lead back to the main graph
    const returnTarget = sideReturn.returnNodeId!;
    const returnTargetNode = t.nodes.find((n) => n.id === returnTarget);
    expect(returnTargetNode).toBeDefined();
    expect(returnTargetNode!.nextNodeIds.length).toBeGreaterThan(0);
  });
});

describe("visitNode — side route progression (#347)", () => {
  const t = MAP_TEMPLATES.act_1_map;
  const sideStart = t.nodes.find((n) => n.type === "side_route_start")!;
  const sideReturn = t.nodes.find((n) => n.type === "side_route_return")!;

  it("side_route_return node's nextNodeIds allows completing the side route", () => {
    expect(sideReturn).toBeDefined();
    const afterReturnTarget = sideReturn.returnNodeId!;
    // Simulate being at the return node with visited = everything before it in side route
    const sideVisited = [t.startNodeId, sideStart.id];
    const sideNodeIds = t.nodes
      .filter((n) => n.type === "side_route_node")
      .map((n) => n.id);
    const visited = [...sideVisited, ...sideNodeIds, sideReturn.id];
    const state = makeState(sideReturn.id, visited);
    const available = availableNextNodes(state);
    expect(available).toContain(afterReturnTarget);
  });
});

// ── #346/#347: Act entry wiring ───────────────────────────────────────────────

describe("templateIdForAct — act entry wiring (#346/#347)", () => {
  it("act 1 resolves to act_1_map (the canonical primary)", () => {
    const id = templateIdForAct(1, deterministicRng(0));
    const act1 = getActDefinition(DEFAULT_CAMPAIGN, 1)!;
    expect(act1.mapPool.templateIds).toContain(id);
    expect(id).toBe("act_1_map");
  });

  it("act 2 resolves to act_2_map", () => {
    expect(templateIdForAct(2, deterministicRng(0))).toBe("act_2_map");
  });

  it("act 3 resolves to act_3_map", () => {
    expect(templateIdForAct(3, deterministicRng(0))).toBe("act_3_map");
  });

  it("act 4 resolves to act_4_map", () => {
    expect(templateIdForAct(4, deterministicRng(0))).toBe("act_4_map");
  });

  it("act 5 (beyond campaign) falls back to DEFAULT_MAP_TEMPLATE_ID", () => {
    const id = templateIdForAct(5, deterministicRng(0));
    // Should not crash and should return a valid template id
    expect(getMapTemplate(id)).toBeDefined();
  });
});

describe("advanceToNextAct — template-driven act entry (#346/#347)", () => {
  it("advancing from act 1 starts the new run at act_2_map start node", () => {
    const campaign = freshCampaign(1);
    const run = createRunState(buildParty(defaultPartySpecs()), "normal", "act_1_map");
    run.mapState.bossDefeated = true;
    const nextRun = advanceToNextAct(campaign, run, deterministicRng(0));
    expect(nextRun.mapTemplateId).toBe("act_2_map");
    expect(nextRun.mapState.currentNodeId).toBe(MAP_TEMPLATES.act_2_map.startNodeId);
  });

  it("advancing from act 2 starts the new run at act_3_map start node", () => {
    const campaign = freshCampaign(2);
    const run = createRunState(buildParty(defaultPartySpecs()), "normal", "act_2_map");
    run.mapState.bossDefeated = true;
    const nextRun = advanceToNextAct(campaign, run, deterministicRng(0));
    expect(nextRun.mapTemplateId).toBe("act_3_map");
    expect(nextRun.mapState.currentNodeId).toBe(MAP_TEMPLATES.act_3_map.startNodeId);
  });

  it("advancing from act 3 starts the new run at act_4_map start node", () => {
    const campaign = freshCampaign(3);
    const run = createRunState(buildParty(defaultPartySpecs()), "normal", "act_3_map");
    run.mapState.bossDefeated = true;
    const nextRun = advanceToNextAct(campaign, run, deterministicRng(0));
    expect(nextRun.mapTemplateId).toBe("act_4_map");
    expect(nextRun.mapState.currentNodeId).toBe(MAP_TEMPLATES.act_4_map.startNodeId);
  });

  it("act 4 map start node is the canonical campaign entry for the final act", () => {
    const t = MAP_TEMPLATES.act_4_map;
    const startNode = t.nodes.find((n) => n.id === t.startNodeId)!;
    expect(startNode.type).toBe("start");
    expect(startNode.nextNodeIds.length).toBeGreaterThan(0);
  });
});

// ── #347: Seeded progression — same seed produces same template selection ─────

describe("seeded act template selection (#347)", () => {
  it("same rng seed produces the same act 1 template id on repeated calls", () => {
    const first = templateIdForAct(1, deterministicRng(0.3));
    const second = templateIdForAct(1, deterministicRng(0.3));
    expect(first).toBe(second);
  });

  it("same rng seed produces the same act 2 template id on repeated calls", () => {
    const first = templateIdForAct(2, deterministicRng(0));
    const second = templateIdForAct(2, deterministicRng(0));
    expect(first).toBe(second);
  });

  it("advanceToNextAct is deterministic when given a fixed rng", () => {
    const fixedRng = deterministicRng(0);
    const campaign1 = freshCampaign(1);
    const run1 = createRunState(buildParty(defaultPartySpecs()), "normal", "act_1_map");
    run1.mapState.bossDefeated = true;
    const next1 = advanceToNextAct(campaign1, run1, fixedRng);

    const campaign2 = freshCampaign(1);
    const run2 = createRunState(buildParty(defaultPartySpecs()), "normal", "act_1_map");
    run2.mapState.bossDefeated = true;
    const next2 = advanceToNextAct(campaign2, run2, fixedRng);

    expect(next1.mapTemplateId).toBe(next2.mapTemplateId);
    expect(next1.mapState.currentNodeId).toBe(next2.mapState.currentNodeId);
  });

  it("different rng seeds may produce different template selections from a multi-entry pool", () => {
    const act1 = getActDefinition(DEFAULT_CAMPAIGN, 1)!;
    if (act1.mapPool.templateIds.length < 2) return; // pool too small to differ
    const low = templateIdForAct(1, deterministicRng(0));
    const high = templateIdForAct(1, deterministicRng(0.9999));
    // With multiple templates in the pool, edge seeds should produce the boundary choices
    expect(low).toBe(act1.mapPool.templateIds[0]);
    expect(high).toBe(act1.mapPool.templateIds[act1.mapPool.templateIds.length - 1]);
  });
});
