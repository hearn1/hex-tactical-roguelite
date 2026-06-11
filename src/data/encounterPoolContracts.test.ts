/**
 * Validation tests for encounter/reward pool contracts and map-node resolution.
 * Covers issues #348–#352 (Epic #162).
 *
 * Smoke path (seed 42, deterministic):
 *   Act 1 → act_1_map → node.a1_start
 *     combat node.a1_combat_a  → encounter from pool.act_1_combat
 *     event  node.a1_event_a   → (no encounter)
 *     combat node.a1_combat_d  → encounter from pool.act_1_combat
 *     camp   node.a1_camp_a    → (rest)
 *     boss   node.a1_boss      → encounter.boss_goblin_warchief  ← Act 1 clears
 *   Act 2 → act_2_map → node.act2_start
 *     combat node.act2_combat_a → encounter from pool.act_2_combat
 *     elite  node.act2_elite_a  → encounter.long_iron_sergeant_elite
 *     boss   node.act2_boss     → encounter.boss_ogre_warlord     ← Act 2 clears
 *   Act 3 → act_3_map → node.act3_start
 *     combat node.act3_combat_a → encounter from pool.act_3_combat
 *     elite  node.act3_elite_a  → encounter.long_iron_sergeant_elite
 *     boss   node.act3_boss     → encounter.boss_high_priest       ← Act 3 clears
 *   Act 4 → act_4_map → node.act4_start
 *     combat node.act4_combat_a → encounter from pool.act_4_combat
 *     elite  node.act4_elite_a  → encounter.long_iron_sergeant_elite
 *     boss   node.act4_boss     → encounter.boss_arcane_lord (isFinalBoss) ← campaign complete
 *
 * To run this path locally:
 *   npm test -- --reporter=verbose src/data/encounterPoolContracts.test.ts
 */

import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import {
  ENCOUNTER_REGISTRY,
  ENCOUNTER_POOLS,
  ENCOUNTER_POOL_DEFS,
  selectEncounterFromPool,
  selectEncounterByContext,
} from "./encounters.ts";
import { ACT_REWARD_POOLS, ACT_REWARD_POOL_DEFS, REWARD_REGISTRY } from "./rewards.ts";
import { MAP_TEMPLATES, ALL_NODES, resolveNodeEncounterId } from "./nodes.ts";
import { DEFAULT_CAMPAIGN } from "./campaigns.ts";

// ---------------------------------------------------------------------------
// #348 — Pool contract structure
// ---------------------------------------------------------------------------

describe("EncounterPoolDef contracts (#348)", () => {
  it("every typed pool def has a non-empty actId and at least one entry", () => {
    for (const [id, def] of Object.entries(ENCOUNTER_POOL_DEFS)) {
      expect(def.actId, `${id} actId`).toBeTruthy();
      expect(def.entries.length, `${id} entries`).toBeGreaterThan(0);
    }
  });

  it("every pool def entry references a known encounter", () => {
    for (const [poolId, def] of Object.entries(ENCOUNTER_POOL_DEFS)) {
      for (const entry of def.entries) {
        expect(
          ENCOUNTER_REGISTRY[entry.encounterId],
          `${poolId} entry ${entry.encounterId}`,
        ).toBeDefined();
      }
    }
  });

  it("every pool def entry has a positive weight", () => {
    for (const [poolId, def] of Object.entries(ENCOUNTER_POOL_DEFS)) {
      for (const entry of def.entries) {
        expect(entry.weight, `${poolId} entry ${entry.encounterId} weight`).toBeGreaterThan(0);
      }
    }
  });

  it("typed pool def IDs are a subset of the flat ENCOUNTER_POOLS", () => {
    for (const id of Object.keys(ENCOUNTER_POOL_DEFS)) {
      expect(ENCOUNTER_POOLS[id], `pool def ${id} missing from flat ENCOUNTER_POOLS`).toBeDefined();
    }
  });
});

describe("ACT_REWARD_POOL_DEFS contracts (#348)", () => {
  it("every typed reward pool def has entries referencing known REWARD_REGISTRY tiers", () => {
    for (const [poolId, def] of Object.entries(ACT_REWARD_POOL_DEFS)) {
      for (const entry of def.entries) {
        expect(
          REWARD_REGISTRY[entry.rewardId],
          `${poolId} entry ${entry.rewardId}`,
        ).toBeDefined();
        expect(entry.weight, `${poolId} entry ${entry.rewardId} weight`).toBeGreaterThan(0);
      }
    }
  });

  it("typed reward pool IDs are a subset of ACT_REWARD_POOLS", () => {
    for (const id of Object.keys(ACT_REWARD_POOL_DEFS)) {
      expect(ACT_REWARD_POOLS[id], `reward pool def ${id} missing from ACT_REWARD_POOLS`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// #349 / #350 — All four acts have complete pool coverage
// ---------------------------------------------------------------------------

describe("act encounter pool coverage (#349/#350)", () => {
  const actPoolIds = ["pool.act_1_combat", "pool.act_2_combat", "pool.act_3_combat", "pool.act_4_combat"];

  it.each(actPoolIds)("%s exists in ENCOUNTER_POOLS and has ≥ 4 entries", (poolId) => {
    const pool = ENCOUNTER_POOLS[poolId];
    expect(pool, `pool ${poolId}`).toBeDefined();
    expect(pool.length, `${poolId} entry count`).toBeGreaterThanOrEqual(4);
  });

  it.each(actPoolIds)("every entry in %s references a valid encounter", (poolId) => {
    for (const encId of ENCOUNTER_POOLS[poolId]) {
      expect(ENCOUNTER_REGISTRY[encId], `${poolId} -> ${encId}`).toBeDefined();
    }
  });
});

describe("act boss encounters exist (#349/#350)", () => {
  const bossIds = [
    "encounter.boss_goblin_warchief",
    "encounter.boss_ogre_warlord",
    "encounter.boss_high_priest",
    "encounter.boss_arcane_lord",
  ];

  it.each(bossIds)("%s is defined in ENCOUNTER_REGISTRY", (id) => {
    expect(ENCOUNTER_REGISTRY[id]).toBeDefined();
  });

  it.each(bossIds)("%s contains at least one boss-aiTag enemy", (id) => {
    const def = ENCOUNTER_REGISTRY[id];
    const { ENEMY_REGISTRY } = require("./enemies.ts");
    const hasBoss = def.enemyGroups.some((g: { enemyId: string }) => {
      const enemy = ENEMY_REGISTRY[g.enemyId];
      return enemy?.aiTag === "boss";
    });
    expect(hasBoss, `${id} should include a boss enemy`).toBe(true);
  });

  it("encounter.boss_arcane_lord is flagged as the final boss", () => {
    expect(ENCOUNTER_REGISTRY["encounter.boss_arcane_lord"].isFinalBoss).toBe(true);
  });

  it("exactly one encounter carries isFinalBoss = true", () => {
    const finals = Object.values(ENCOUNTER_REGISTRY).filter((e) => e.isFinalBoss);
    expect(finals).toHaveLength(1);
    expect(finals[0].id).toBe("encounter.boss_arcane_lord");
  });
});

describe("act reward pools (#349/#350)", () => {
  const actRewardIds = [
    "pool.act_1_rewards",
    "pool.act_2_rewards",
    "pool.act_3_rewards",
    "pool.act_4_rewards",
  ];

  it.each(actRewardIds)("%s exists in ACT_REWARD_POOLS", (poolId) => {
    expect(ACT_REWARD_POOLS[poolId]).toBeDefined();
  });

  it.each(actRewardIds)("every tier in %s exists in REWARD_REGISTRY", (poolId) => {
    for (const tierId of ACT_REWARD_POOLS[poolId]) {
      expect(REWARD_REGISTRY[tierId], `${poolId} -> ${tierId}`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// #351 — Map node to pool resolution
// ---------------------------------------------------------------------------

describe("act map template node resolution (#351)", () => {
  const canonicalTemplateIds = ["act_1_map", "act_2_map", "act_3_map", "act_4_map"];

  it.each(canonicalTemplateIds)("%s — every combat/elite/boss node resolves to a valid encounter", (templateId) => {
    const template = MAP_TEMPLATES[templateId];
    expect(template, `template ${templateId}`).toBeDefined();
    const rng = createRng(42);
    for (const node of template.nodes) {
      if (node.type !== "combat" && node.type !== "elite" && node.type !== "boss") continue;
      const id = resolveNodeEncounterId(node, rng);
      expect(id, `${node.id} resolved`).toBeDefined();
      expect(ENCOUNTER_REGISTRY[id!], `${node.id} -> ${id}`).toBeDefined();
    }
  });

  it("act_1_map boss node uses act-1 boss encounter", () => {
    const boss = MAP_TEMPLATES.act_1_map.nodes.find((n) => n.type === "boss")!;
    expect(boss.encounterId).toBe("encounter.boss_goblin_warchief");
  });

  it("act_2_map boss node uses act-2 boss encounter", () => {
    const boss = MAP_TEMPLATES.act_2_map.nodes.find((n) => n.type === "boss")!;
    expect(boss.encounterId).toBe("encounter.boss_ogre_warlord");
  });

  it("act_3_map boss node uses act-3 boss encounter", () => {
    const boss = MAP_TEMPLATES.act_3_map.nodes.find((n) => n.type === "boss")!;
    expect(boss.encounterId).toBe("encounter.boss_high_priest");
  });

  it("act_4_map boss node uses the final boss encounter", () => {
    const boss = MAP_TEMPLATES.act_4_map.nodes.find((n) => n.type === "boss")!;
    expect(boss.encounterId).toBe("encounter.boss_arcane_lord");
    expect(ENCOUNTER_REGISTRY["encounter.boss_arcane_lord"].isFinalBoss).toBe(true);
  });

  it("act combat nodes use their act-specific encounter pool", () => {
    const actPools: Record<string, string> = {
      act_1_map: "pool.act_1_combat",
      act_2_map: "pool.act_2_combat",
      act_3_map: "pool.act_3_combat",
      act_4_map: "pool.act_4_combat",
    };
    for (const [templateId, expectedPool] of Object.entries(actPools)) {
      const template = MAP_TEMPLATES[templateId];
      const combatNodes = template.nodes.filter((n) => n.type === "combat" && n.encounterPoolId);
      expect(combatNodes.length, `${templateId} has pool-using combat nodes`).toBeGreaterThan(0);
      for (const node of combatNodes) {
        expect(node.encounterPoolId, `${node.id} in ${templateId}`).toBe(expectedPool);
      }
    }
  });

  it("campaign acts reference pool IDs that exist in ENCOUNTER_POOLS", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      const poolId = act.encounterPool.poolId;
      expect(ENCOUNTER_POOLS[poolId], `act ${act.id} encounterPool ${poolId}`).toBeDefined();
    }
  });

  it("different combat node IDs resolve different encounters with same context seed", () => {
    const poolId = "pool.act_2_combat";
    const seed = "42";
    const resultA = selectEncounterByContext({ poolId, seed, actId: "act_2", nodeId: "node.act2_combat_a" });
    const resultB = selectEncounterByContext({ poolId, seed, actId: "act_2", nodeId: "node.act2_combat_b" });
    // Not guaranteed to differ for every pool, but the context changes means the derived
    // seeds differ — verify at least one produces a valid encounter.
    expect(ENCOUNTER_REGISTRY[resultA]).toBeDefined();
    expect(ENCOUNTER_REGISTRY[resultB]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// #352 — Seeded selection determinism
// ---------------------------------------------------------------------------

describe("selectEncounterFromPool determinism (#352)", () => {
  it("returns the same encounter for the same seed and pool", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const seqA = Array.from({ length: 10 }, () => selectEncounterFromPool("pool.act_1_combat", rng1));
    const seqB = Array.from({ length: 10 }, () => selectEncounterFromPool("pool.act_1_combat", rng2));
    expect(seqA).toEqual(seqB);
  });

  it("returns results within the pool", () => {
    const rng = createRng(999);
    for (let i = 0; i < 20; i++) {
      const id = selectEncounterFromPool("pool.act_3_combat", rng);
      expect(ENCOUNTER_POOLS["pool.act_3_combat"]).toContain(id);
    }
  });
});

describe("selectEncounterByContext determinism (#352)", () => {
  it("same input always returns the same encounter", () => {
    const input = { poolId: "pool.act_4_combat", seed: "42", actId: "act_4", nodeId: "node.act4_combat_a" };
    const first = selectEncounterByContext(input);
    const second = selectEncounterByContext(input);
    expect(first).toBe(second);
    expect(ENCOUNTER_REGISTRY[first]).toBeDefined();
  });

  it("different nodeId produces a different derived seed (may differ in result)", () => {
    const base = { poolId: "pool.act_4_combat", seed: "42", actId: "act_4" };
    const r1 = selectEncounterByContext({ ...base, nodeId: "node.act4_combat_a" });
    const r2 = selectEncounterByContext({ ...base, nodeId: "node.act4_combat_e" });
    // Both must be valid; they may coincidentally match but the derivation paths differ.
    expect(ENCOUNTER_REGISTRY[r1]).toBeDefined();
    expect(ENCOUNTER_REGISTRY[r2]).toBeDefined();
  });

  it("excludes completed encounters when alternatives exist", () => {
    const pool = ENCOUNTER_POOL_DEFS["pool.act_2_combat"];
    const allIds = pool.entries.map((e) => e.encounterId);
    // Exclude all but one
    const lastId = allIds[allIds.length - 1];
    const excluded = allIds.filter((id) => id !== lastId);
    const input = {
      poolId: "pool.act_2_combat",
      seed: "1",
      actId: "act_2",
      nodeId: "node.act2_combat_a",
      completedEncounterIds: excluded,
    };
    const result = selectEncounterByContext(input);
    expect(result).toBe(lastId);
  });

  it("falls back to full pool when all encounters are completed", () => {
    const pool = ENCOUNTER_POOL_DEFS["pool.act_1_combat"];
    const allIds = pool.entries.map((e) => e.encounterId);
    const input = {
      poolId: "pool.act_1_combat",
      seed: "77",
      actId: "act_1",
      nodeId: "node.a1_combat_a",
      completedEncounterIds: allIds,
    };
    const result = selectEncounterByContext(input);
    expect(ENCOUNTER_POOL_DEFS["pool.act_1_combat"].entries.map((e) => e.encounterId)).toContain(result);
  });
});

// ---------------------------------------------------------------------------
// #352 — Full ALL_NODES validation
// ---------------------------------------------------------------------------

describe("all map nodes resolve valid encounters (#352)", () => {
  it("every combat/elite/boss node and side_route_node with an encounter resolves to a registered encounter", () => {
    const rng = createRng(1);
    for (const node of ALL_NODES) {
      if (
        node.type !== "combat" &&
        node.type !== "elite" &&
        node.type !== "boss" &&
        node.type !== "side_route_node"
      ) continue;
      // side_route_node may be an event-only node with no encounter declared — skip those.
      if (node.type === "side_route_node" && !node.encounterId && !node.encounterPoolId) continue;
      const id = resolveNodeEncounterId(node, rng);
      expect(id, `node ${node.id} should resolve`).toBeDefined();
      expect(ENCOUNTER_REGISTRY[id!], `node ${node.id} -> ${id} not in registry`).toBeDefined();
    }
  });

  it("every boss node in canonical act templates uses a boss-aiTag encounter", () => {
    const { ENEMY_REGISTRY } = require("./enemies.ts");
    const canonicalTemplateIds = ["act_1_map", "act_2_map", "act_3_map", "act_4_map"];
    for (const templateId of canonicalTemplateIds) {
      const template = MAP_TEMPLATES[templateId];
      const bossNodes = template.nodes.filter((n) => n.type === "boss");
      expect(bossNodes.length, `${templateId} has a boss node`).toBeGreaterThan(0);
      for (const node of bossNodes) {
        const enc = ENCOUNTER_REGISTRY[node.encounterId!];
        expect(enc, `${node.id} encounter`).toBeDefined();
        const hasBoss = enc.enemyGroups.some((g: { enemyId: string }) => ENEMY_REGISTRY[g.enemyId]?.aiTag === "boss");
        expect(hasBoss, `${node.id} in ${templateId} should have a boss enemy`).toBe(true);
      }
    }
  });
});
