import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import { resolveAction, validTargets } from "./Action.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import { createCombatFromRun } from "../state/GameState.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";
import type { RunState, PartyMember } from "../state/RunState.ts";
import { createInventory } from "../run/Inventory.ts";
import {
  LEVELUP_PASSIVE_START_COMBAT_GUARDED,
  LEVELUP_PASSIVE_FIRST_HEAL_BONUS,
  FIRST_HEAL_BONUS_AMOUNT,
} from "../data/levelups.ts";

function makeUnit(overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex }): UnitInstance {
  return {
    defId: "class.guardian",
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    hp: 18,
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function twoUnitState(a: UnitInstance, t: UnitInstance): CombatState {
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: [a.instanceId, t.instanceId],
    units: [a, t],
    log: [],
    status: "active",
    gridKeys: ["0,0", "1,0", "0,1"],
    targetingActionId: null,
  };
}

describe("level-up action upgrades in combat", () => {
  it("damageBonus adds flat damage on a hit (Pressing Strike)", () => {
    const seed = 2;
    // Hits in both runs: huge might + low armor means only a natural 1 could miss (seed avoids it).
    const stats = { maxHp: 100, armor: 10, move: 3, might: 10, agility: 0, spirit: 0 };
    const enemyStats = { maxHp: 100, armor: 5, move: 3, might: 0, agility: 0, spirit: 0 };

    const baseA = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, stats: { ...stats } });
    const baseT = makeUnit({ instanceId: "t", pos: { q: 1, r: 0 }, team: "enemy", hp: 100, stats: { ...enemyStats } });
    const baseState = twoUnitState(baseA, baseT);
    resolveAction(ACTION_REGISTRY["action.slash"], baseA, baseT, baseState, createRng(seed));
    const baseDamage = 100 - baseT.hp;

    const upA = makeUnit({
      instanceId: "a",
      pos: { q: 0, r: 0 },
      stats: { ...stats },
      actionUpgrades: { "action.slash": { damageBonus: 1 } },
    });
    const upT = makeUnit({ instanceId: "t", pos: { q: 1, r: 0 }, team: "enemy", hp: 100, stats: { ...enemyStats } });
    const upState = twoUnitState(upA, upT);
    resolveAction(ACTION_REGISTRY["action.slash"], upA, upT, upState, createRng(seed));
    const upDamage = 100 - upT.hp;

    expect(baseDamage).toBeGreaterThan(0);
    expect(upDamage - baseDamage).toBe(1);
  });

  it("healBonus adds flat healing (Warm Hands)", () => {
    const seed = 3;
    const acoStats = { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 5 };
    const allyStats = { maxHp: 100, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 };

    const baseA = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, defId: "class.acolyte", stats: { ...acoStats } });
    const baseAlly = makeUnit({ instanceId: "b", pos: { q: 1, r: 0 }, hp: 10, stats: { ...allyStats } });
    resolveAction(ACTION_REGISTRY["action.mend_wounds"], baseA, baseAlly, twoUnitState(baseA, baseAlly), createRng(seed));
    const baseHeal = baseAlly.hp - 10;

    const upA = makeUnit({
      instanceId: "a",
      pos: { q: 0, r: 0 },
      defId: "class.acolyte",
      stats: { ...acoStats },
      actionUpgrades: { "action.mend_wounds": { healBonus: 2 } },
    });
    const upAlly = makeUnit({ instanceId: "b", pos: { q: 1, r: 0 }, hp: 10, stats: { ...allyStats } });
    resolveAction(ACTION_REGISTRY["action.mend_wounds"], upA, upAlly, twoUnitState(upA, upAlly), createRng(seed));
    const upHeal = upAlly.hp - 10;

    expect(baseHeal).toBeGreaterThan(0);
    expect(upHeal - baseHeal).toBe(2);
  });

  it("rangeBonus extends targeting range (Far Spark)", () => {
    const arc = makeUnit({
      instanceId: "h1",
      pos: { q: 0, r: 0 },
      defId: "class.arcanist",
      stats: { maxHp: 11, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 },
      actionUpgrades: { "action.fire_bolt": { rangeBonus: 1 } },
    });
    const enemyAt5 = makeUnit({ instanceId: "e1", pos: { q: 0, r: 5 }, team: "enemy", stats: { maxHp: 8, armor: 12, move: 4, might: 1, agility: 3, spirit: 0 } });
    const state = twoUnitState(arc, enemyAt5);

    // Fire Bolt base range is 4 → distance 5 is out of reach without the upgrade.
    const without = validTargets(ACTION_REGISTRY["action.fire_bolt"], { ...arc, actionUpgrades: undefined }, state);
    expect(without.map((t) => t.instanceId)).not.toContain("e1");

    const withUpgrade = validTargets(ACTION_REGISTRY["action.fire_bolt"], arc, state);
    expect(withUpgrade.map((t) => t.instanceId)).toContain("e1");
  });

  it("conditionDurationBonus extends an applied condition (Steady Benediction)", () => {
    const aco = makeUnit({
      instanceId: "a",
      pos: { q: 0, r: 0 },
      defId: "class.acolyte",
      stats: { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 3 },
      actionUpgrades: { "action.bless": { conditionDurationBonus: 1 } },
    });
    const ally = makeUnit({ instanceId: "b", pos: { q: 1, r: 0 } });
    resolveAction(ACTION_REGISTRY["action.bless"], aco, ally, twoUnitState(aco, ally), createRng(1));
    const blessed = ally.conditions.find((c) => c.id === "blessed");
    // Bless base duration is 2; +1 from the upgrade.
    expect(blessed?.remainingTurns).toBe(3);
  });

  it("first_heal_bonus passive adds extra HP once per combat (Field Prayer)", () => {
    const seed = 9;
    const acoStats = { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 5 };
    const allyStats = { maxHp: 100, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 };

    const baseA = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, defId: "class.acolyte", stats: { ...acoStats } });
    const baseAlly = makeUnit({ instanceId: "b", pos: { q: 1, r: 0 }, hp: 10, stats: { ...allyStats } });
    resolveAction(ACTION_REGISTRY["action.mend_wounds"], baseA, baseAlly, twoUnitState(baseA, baseAlly), createRng(seed));
    const baseHeal = baseAlly.hp - 10;

    const upA = makeUnit({
      instanceId: "a",
      pos: { q: 0, r: 0 },
      defId: "class.acolyte",
      stats: { ...acoStats },
      passives: [LEVELUP_PASSIVE_FIRST_HEAL_BONUS],
    });
    const upAlly = makeUnit({ instanceId: "b", pos: { q: 1, r: 0 }, hp: 10, stats: { ...allyStats } });
    resolveAction(ACTION_REGISTRY["action.mend_wounds"], upA, upAlly, twoUnitState(upA, upAlly), createRng(seed));

    expect(upAlly.hp - 10 - baseHeal).toBe(FIRST_HEAL_BONUS_AMOUNT);
    expect(upA.firstHealDone).toBe(true);
  });
});

function makeRun(party: PartyMember[]): RunState {
  return {
    seed: 1,
    gold: 0,
    party,
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
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
}

function makePm(overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    instanceId: "hero_001",
    classId: "class.guardian",
    displayName: "Mara",
    level: 3,
    xp: 0,
    hp: 18,
    maxHp: 18,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    ...overrides,
  };
}

describe("start_combat_guarded passive (Hold the Line)", () => {
  it("a hero with the passive begins combat Guarded", () => {
    const guarded = makePm({ instanceId: "hero_001", passives: [LEVELUP_PASSIVE_START_COMBAT_GUARDED] });
    const plain = makePm({ instanceId: "hero_002", classId: "class.acolyte", displayName: "Sable" });
    const run = makeRun([guarded, plain]);
    const combat = createCombatFromRun(run, "encounter.road_ambush", createRng(1));

    const guardedUnit = combat.units.find((u) => u.instanceId === "hero_001")!;
    const plainUnit = combat.units.find((u) => u.instanceId === "hero_002")!;
    expect(guardedUnit.conditions.some((c) => c.id === "guarded")).toBe(true);
    expect(plainUnit.conditions.some((c) => c.id === "guarded")).toBe(false);
  });
});
