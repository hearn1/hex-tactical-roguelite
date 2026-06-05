import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import {
  ENCOUNTER_REGISTRY,
  ENCOUNTER_POOLS,
  selectEncounterFromPool,
} from "./encounters.ts";
import { NODE_REGISTRY, resolveNodeEncounterId, ALL_NODES } from "./nodes.ts";
import { createCombatFromRun } from "../state/GameState.ts";
import type { RunState, PartyMember } from "../state/RunState.ts";
import { createInventory } from "../run/Inventory.ts";
import { CLASS_REGISTRY } from "./classes.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";

function makeParty(): PartyMember[] {
  return ["class.guardian", "class.acolyte", "class.arcanist"].map((classId, i) => {
    const def = CLASS_REGISTRY[classId];
    return {
      instanceId: `hero_00${i + 1}`,
      classId,
      displayName: def.displayName,
      level: 1,
      xp: 0,
      hp: def.baseStats.maxHp,
      maxHp: def.baseStats.maxHp,
      bonusStats: {},
      equippedItemIds: { weapon: null, armor: null, trinket: null },
    };
  });
}

function makeRun(): RunState {
  return {
    seed: 1,
    gold: 30,
    party: makeParty(),
    inventory: createInventory(),
    mapTemplateId: "long",
    mapState: {
      currentNodeId: "node.long_start",
      visitedNodeIds: ["node.long_start"],
      nodesCleared: 0,
      elitesDefeated: 0,
      bossDefeated: false,
    },
    runStatus: "active",
    shopStates: {},
    campStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
}

const GRID = new Set(hexesWithinRange({ q: 0, r: 0 }, 3).map(hexKey));

describe("encounter variety pack data", () => {
  it("every standard-combat pool entry resolves to a real encounter", () => {
    for (const [poolId, ids] of Object.entries(ENCOUNTER_POOLS)) {
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(ENCOUNTER_REGISTRY[id], `${poolId} -> ${id}`).toBeDefined();
      }
    }
  });

  it("every encounter respects the 5-enemy cap and has non-overlapping in-grid positions", () => {
    for (const def of Object.values(ENCOUNTER_REGISTRY)) {
      const total = def.enemyGroups.reduce((s, g) => s + g.count, 0);
      expect(total, def.id).toBeLessThanOrEqual(5);
      if (def.positions) {
        expect(def.positions.length, `${def.id} positions count`).toBe(total);
        const seen = new Set<string>();
        for (const pos of def.positions) {
          const key = hexKey(pos);
          expect(GRID.has(key), `${def.id} pos ${key} in grid`).toBe(true);
          expect(seen.has(key), `${def.id} pos ${key} duplicate`).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it("includes the new ambusher-bearing encounter using the shadow stalker", () => {
    const defile = ENCOUNTER_REGISTRY["encounter.shadowed_defile"];
    expect(defile).toBeDefined();
    expect(defile.enemyGroups.some((g) => g.enemyId === "enemy.shadow_stalker")).toBe(true);
  });
});

describe("selectEncounterFromPool", () => {
  it("returns a member of the pool", () => {
    const rng = createRng(123);
    for (let i = 0; i < 50; i++) {
      const id = selectEncounterFromPool("pool.standard_combat", rng);
      expect(ENCOUNTER_POOLS["pool.standard_combat"]).toContain(id);
    }
  });

  it("is deterministic for the same seeded stream", () => {
    const a = createRng(777);
    const b = createRng(777);
    const seqA = Array.from({ length: 6 }, () => selectEncounterFromPool("pool.standard_combat", a));
    const seqB = Array.from({ length: 6 }, () => selectEncounterFromPool("pool.standard_combat", b));
    expect(seqA).toEqual(seqB);
  });

  it("throws on an unknown pool", () => {
    expect(() => selectEncounterFromPool("pool.nope", createRng(1))).toThrow();
  });
});

describe("resolveNodeEncounterId", () => {
  it("draws from the pool for combat nodes and stays inside it", () => {
    const node = NODE_REGISTRY["node.long_combat_a"];
    expect(node.encounterPoolId).toBe("pool.standard_combat");
    const rng = createRng(42);
    for (let i = 0; i < 20; i++) {
      const id = resolveNodeEncounterId(node, rng)!;
      expect(ENCOUNTER_POOLS["pool.standard_combat"]).toContain(id);
    }
  });

  it("uses the fixed encounter for boss/elite nodes (no pool)", () => {
    const boss = NODE_REGISTRY["node.long_boss"];
    const elite = NODE_REGISTRY["node.long_elite_a"];
    expect(boss.encounterPoolId).toBeUndefined();
    expect(elite.encounterPoolId).toBeUndefined();
    expect(resolveNodeEncounterId(boss, createRng(1))).toBe("encounter.boss_ogre_hexbreaker");
    expect(resolveNodeEncounterId(elite, createRng(1))).toBe("encounter.long_iron_sergeant_elite");
  });

  it("every combat/elite/boss node resolves to a valid encounter", () => {
    for (const node of ALL_NODES) {
      if (node.type !== "combat" && node.type !== "elite" && node.type !== "boss") continue;
      const id = resolveNodeEncounterId(node, createRng(node.id.length));
      expect(id, node.id).toBeDefined();
      expect(ENCOUNTER_REGISTRY[id!], `${node.id} -> ${id}`).toBeDefined();
    }
  });
});

describe("createCombatFromRun positioning", () => {
  it("places enemies on the encounter's declared positions when present", () => {
    const run = makeRun();
    const combat = createCombatFromRun(run, "encounter.shadowed_defile", createRng(5));
    const enemies = combat.units.filter((u) => u.team === "enemy");
    const expected = ENCOUNTER_REGISTRY["encounter.shadowed_defile"].positions!;
    const enemyKeys = enemies.map((e) => hexKey(e.pos)).sort();
    const expectedKeys = expected.map(hexKey).sort();
    expect(enemyKeys).toEqual(expectedKeys);
  });

  it("falls back to a non-overlapping scatter when no positions are declared", () => {
    const run = makeRun();
    // road_ambush has no positions -> scatter fallback, must not overlap.
    const combat = createCombatFromRun(run, "encounter.road_ambush", createRng(5));
    const enemies = combat.units.filter((u) => u.team === "enemy");
    const keys = enemies.map((e) => hexKey(e.pos));
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(GRID.has(k)).toBe(true);
  });

  it("keeps enemies and heroes on distinct hexes", () => {
    const run = makeRun();
    const combat = createCombatFromRun(run, "encounter.warded_circle", createRng(9));
    const keys = combat.units.map((u) => hexKey(u.pos));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
