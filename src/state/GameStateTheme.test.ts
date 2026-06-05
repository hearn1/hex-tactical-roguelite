import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";
import { createInventory } from "../run/Inventory.ts";
import type { RunState, PartyMember } from "./RunState.ts";
import { createCombatFromRun, initCombatState } from "./GameState.ts";

function party(): PartyMember[] {
  return ["class.guardian", "class.acolyte", "class.arcanist"].map((classId, index) => {
    const def = CLASS_REGISTRY[classId];
    return {
      instanceId: `hero_00${index + 1}`,
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

function run(): RunState {
  return {
    seed: 1,
    gold: 30,
    party: party(),
    inventory: createInventory(),
    mapState: {
      currentNodeId: "node.start",
      visitedNodeIds: ["node.start"],
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

describe("combat environment theme propagation", () => {
  it("stores the source node type and resolved theme on run combat", () => {
    const combat = createCombatFromRun(run(), "encounter.road_ambush", createRng(2), "combat");

    expect(combat.sourceNodeType).toBe("combat");
    expect(combat.theme).toBe("forest");
  });

  it("uses distinct elite and boss themes", () => {
    const elite = createCombatFromRun(run(), "encounter.broken_banner_elite", createRng(3), "elite");
    const boss = createCombatFromRun(run(), "encounter.boss_ogre_hexbreaker", createRng(4), "boss");

    expect(elite.theme).toBe("dungeon");
    expect(boss.theme).toBe("boss_arena");
  });

  it("keeps boss arena theme when the encounter identifies the boss", () => {
    const combat = createCombatFromRun(run(), "encounter.boss_ogre_hexbreaker", createRng(5));

    expect(combat.sourceNodeType).toBeUndefined();
    expect(combat.theme).toBe("boss_arena");
  });

  it("gives demo combat a default theme", () => {
    expect(initCombatState(createRng(6)).theme).toBe("forest");
  });
});
