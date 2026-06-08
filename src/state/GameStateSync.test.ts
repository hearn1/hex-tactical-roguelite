import { describe, expect, it } from "vitest";
import { CLASS_REGISTRY } from "../data/classes.ts";
import { createInventory } from "../run/Inventory.ts";
import type { RunState, PartyMember } from "./RunState.ts";
import type { CombatState, UnitInstance } from "./types.ts";
import { syncPartyFromCombat } from "./GameState.ts";

function makePartyMember(classId: string, index: number): PartyMember {
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
    spellSlotsMax: 0,
    spellSlotsRemaining: 0,
  };
}

function makeRun(members: PartyMember[]): RunState {
  return {
    seed: 1,
    gold: 30,
    party: members,
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

function makeUnit(pm: PartyMember): UnitInstance {
  const def = CLASS_REGISTRY[pm.classId];
  return {
    instanceId: pm.instanceId,
    defId: pm.classId,
    displayName: pm.displayName,
    team: "hero",
    level: pm.level,
    xp: pm.xp,
    stats: { ...def.baseStats },
    hp: pm.hp,
    pos: { q: -3, r: 0 },
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { ...pm.equippedItemIds },
    bonusStats: {},
    spellsKnown: [],
    preparedActionIds: [],
    heroLifeState: "standing",
  };
}

function makeCombat(units: UnitInstance[]): CombatState {
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: units.map((u) => u.instanceId),
    units,
    log: [],
    status: "victory",
    gridKeys: [],
    targetingActionId: null,
    perEncounterUses: {},
    traitState: { actionRotationIndex: {}, triggered: {} },
    theme: "forest",
  };
}

describe("syncPartyFromCombat — reward-time equipment persistence (#142)", () => {
  it("persists equippedItemIds assigned during reward phase", () => {
    const pm = makePartyMember("class.guardian", 0);
    const run = makeRun([pm]);
    const unit = makeUnit(pm);
    unit.equippedItemIds.weapon = "item.iron_sword";
    const cs = makeCombat([unit]);

    syncPartyFromCombat(cs, run);

    expect(run.party[0].equippedItemIds.weapon).toBe("item.iron_sword");
  });

  it("persists spellSlotsRemaining after reward continue", () => {
    const pm = makePartyMember("class.acolyte", 0);
    pm.spellSlotsRemaining = 2;
    const run = makeRun([pm]);
    const unit = makeUnit(pm);
    unit.spellSlotsRemaining = 1;
    const cs = makeCombat([unit]);

    syncPartyFromCombat(cs, run);

    expect(run.party[0].spellSlotsRemaining).toBe(1);
  });

  it("persists XP and level from reward-time level-up", () => {
    const pm = makePartyMember("class.arcanist", 0);
    const run = makeRun([pm]);
    const unit = makeUnit(pm);
    unit.xp = 100;
    unit.level = 2;
    const cs = makeCombat([unit]);

    syncPartyFromCombat(cs, run);

    expect(run.party[0].xp).toBe(100);
    expect(run.party[0].level).toBe(2);
  });

  it("does not revive a dead-for-run hero", () => {
    const pm = makePartyMember("class.guardian", 0);
    pm.deadForRun = true;
    pm.hp = 0;
    const run = makeRun([pm]);
    const cs = makeCombat([]);

    syncPartyFromCombat(cs, run);

    expect(run.party[0].deadForRun).toBe(true);
    expect(run.party[0].hp).toBe(0);
  });

  it("sets deadForRun when heroLifeState is dead", () => {
    const pm = makePartyMember("class.guardian", 0);
    const run = makeRun([pm]);
    const unit = makeUnit(pm);
    unit.heroLifeState = "dead";
    unit.hp = 0;
    const cs = makeCombat([unit]);

    syncPartyFromCombat(cs, run);

    expect(run.party[0].deadForRun).toBe(true);
    expect(run.party[0].hp).toBe(0);
  });

  it("survivor hp is capped at maxHp", () => {
    const pm = makePartyMember("class.guardian", 0);
    const run = makeRun([pm]);
    const unit = makeUnit(pm);
    unit.hp = 999;
    const cs = makeCombat([unit]);

    syncPartyFromCombat(cs, run);

    expect(run.party[0].hp).toBeLessThanOrEqual(run.party[0].maxHp);
  });

  it("survivor hp is at least 1", () => {
    const pm = makePartyMember("class.guardian", 0);
    const run = makeRun([pm]);
    const unit = makeUnit(pm);
    unit.hp = 0;
    unit.heroLifeState = "standing";
    const cs = makeCombat([unit]);

    syncPartyFromCombat(cs, run);

    expect(run.party[0].hp).toBeGreaterThanOrEqual(1);
  });
});
