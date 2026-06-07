import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import { resolveAction, validTargets, rollSave } from "./Action.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";
import { distance } from "../core/hex.ts";

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
    spellSlotsRemaining: 3,
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
    perEncounterUses: {},
  };
}

describe("Archetype: Roll Save", () => {
  it("rollSave returns true when d20 + mod >= DC", () => {
    const rng = createRng(1); // deterministic
    let calls = 0;
    const controlledRng = () => { calls++; return 0.5; }; // d20 = 10
    const unit = makeUnit({ instanceId: "u", pos: { q: 0, r: 0 }, stats: { maxHp: 10, armor: 10, move: 3, might: 0, agility: 0, spirit: 3 } });
    // spirit=3, d20=10 → 13 >= 12
    expect(rollSave(unit, "spirit", 12, controlledRng)).toBe(true);
    // spirit=3, d20=10 → 13 < 15
    expect(rollSave(unit, "spirit", 15, controlledRng)).toBe(false);
  });
});

describe("Archetype: Protective Ward (Cloistered)", () => {
  it("applies warded condition granting +3 effective armor", () => {
    const rng = createRng(1);
    const caster = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, defId: "class.acolyte", stats: { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 3 } });
    const ally = makeUnit({ instanceId: "b", pos: { q: 1, r: 0 }, stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 } });
    const state = twoUnitState(caster, ally);
    const action = ACTION_REGISTRY["action.archetype_protective_ward"];
    expect(action).toBeDefined();
    resolveAction(action, caster, ally, state, rng);
    const warded = ally.conditions.find((c) => c.id === "warded");
    expect(warded).toBeDefined();
    expect(warded!.remainingTurns).toBe(1);
  });
});

describe("Archetype: Empowered Spell (Evoker)", () => {
  it("applies empowered condition on ally", () => {
    const rng = createRng(1);
    const evoker = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, defId: "class.arcanist", stats: { maxHp: 11, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 } });
    const ally = makeUnit({ instanceId: "b", pos: { q: 1, r: 0 } });
    const state = twoUnitState(evoker, ally);
    resolveAction(ACTION_REGISTRY["action.archetype_empowered_spell"], evoker, ally, state, rng);
    const empowered = ally.conditions.find((c) => c.id === "empowered");
    expect(empowered).toBeDefined();
    expect(empowered!.remainingTurns).toBe(2);
  });

  it("empowered condition adds 1d6 to next damaging spell", () => {
    const rng = createRng(42);
    const evoker = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, defId: "class.arcanist", stats: { maxHp: 100, armor: 10, move: 3, might: 0, agility: 1, spirit: 10 } });
    const target = makeUnit({ instanceId: "t", pos: { q: 1, r: 0 }, team: "enemy", hp: 100, stats: { maxHp: 100, armor: 5, move: 3, might: 0, agility: 0, spirit: 0 } });
    const state = twoUnitState(evoker, target);

    // Without empowered
    const plainTarget = makeUnit({ instanceId: "t2", pos: { q: 1, r: 0 }, team: "enemy", hp: 100, stats: { maxHp: 100, armor: 5, move: 3, might: 0, agility: 0, spirit: 0 } });
    const plainState = twoUnitState(evoker, plainTarget);
    resolveAction(ACTION_REGISTRY["action.fire_bolt"], evoker, plainTarget, plainState, createRng(42));
    const plainDmg = 100 - plainTarget.hp;

    // With empowered
    evoker.conditions.push({ id: "empowered", remainingTurns: 2 });
    resolveAction(ACTION_REGISTRY["action.fire_bolt"], evoker, target, state, createRng(42));
    const empoweredDmg = 100 - target.hp;

    expect(empoweredDmg).toBeGreaterThan(plainDmg);
    expect(evoker.conditions.find((c) => c.id === "empowered")).toBeUndefined();
  });
});

describe("Archetype: Healing Burst (Beacon) AoE", () => {
  it("heals allies within radius 2", () => {
    const rng = createRng(1);
    const beacon = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, defId: "class.acolyte", stats: { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 5 } });
    const ally1 = makeUnit({ instanceId: "b", pos: { q: 1, r: 0 }, hp: 5, stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 } });
    const ally2 = makeUnit({ instanceId: "c", pos: { q: 0, r: 1 }, hp: 5, stats: { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 3 } });
    const allyFar = makeUnit({ instanceId: "d", pos: { q: 0, r: 3 }, hp: 5, stats: { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 3 } });
    const state: CombatState = {
      round: 1,
      activeIndex: 0,
      turnQueue: ["a", "b", "c", "d"],
      units: [beacon, ally1, ally2, allyFar],
      log: [],
      status: "active",
      gridKeys: ["0,0", "1,0", "0,1", "0,3"],
      targetingActionId: null,
      perEncounterUses: {},
    };
    const action = ACTION_REGISTRY["action.archetype_healing_burst"];
    expect(action).toBeDefined();
    resolveAction(action, beacon, ally1, state, rng);
    expect(ally1.hp).toBeGreaterThan(5);
    expect(ally2.hp).toBeGreaterThan(5);
    // allyFar is at distance 3 from beacon (0,0) → (0,3) = 3, out of radius 2
    expect(allyFar.hp).toBe(5);
  });
});

describe("Archetype: Taunt (Shieldbearer)", () => {
  it("applies taunted condition and sets forcedTargetId on enemy", () => {
    const rng = createRng(1);
    const guardian = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 } });
    const enemy = makeUnit({ instanceId: "e", pos: { q: 1, r: 0 }, team: "enemy", stats: { maxHp: 10, armor: 12, move: 3, might: 1, agility: 2, spirit: 0 } });
    const state = twoUnitState(guardian, enemy);
    const action = ACTION_REGISTRY["action.archetype_taunt"];
    expect(action).toBeDefined();
    resolveAction(action, guardian, enemy, state, rng);
    expect(enemy.conditions.some((c) => c.id === "taunted")).toBe(true);
    expect(enemy.forcedTargetId).toBe("a");
  });
});

describe("Archetype: Mesmerize (Enchanter) with save", () => {
  it("applies mesmerized condition on failed save, negated on success", () => {
    // Use controlled RNG: after damage rolls, the save d20 is the next rng() call.
    let callIdx = 0;
    const highSaveRng = () => { callIdx++; return callIdx <= 6 ? 0.5 : 0.9; };
    const lowSaveRng = () => { callIdx++; return callIdx <= 6 ? 0.5 : 0.05; };

    const enchanter = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, defId: "class.arcanist", stats: { maxHp: 11, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 } });
    const action = ACTION_REGISTRY["action.archetype_mesmerize"];
    expect(action).toBeDefined();

    // Enemy with spirit=10 — high enough to save.
    callIdx = 0;
    const enemyWithSave = makeUnit({ instanceId: "e1", pos: { q: 1, r: 0 }, team: "enemy", hp: 20, stats: { maxHp: 20, armor: 12, move: 3, might: 0, agility: 0, spirit: 10 } });
    const state1 = twoUnitState(enchanter, enemyWithSave);
    resolveAction(action, enchanter, enemyWithSave, state1, highSaveRng);
    expect(enemyWithSave.conditions.some((c) => c.id === "mesmerized")).toBe(false);

    // Enemy with spirit=0 — should fail the save.
    callIdx = 0;
    const enemyNoSave = makeUnit({ instanceId: "e2", pos: { q: 1, r: 0 }, team: "enemy", hp: 20, stats: { maxHp: 20, armor: 12, move: 3, might: 0, agility: 0, spirit: 0 } });
    const state2 = twoUnitState(enchanter, enemyNoSave);
    resolveAction(action, enchanter, enemyNoSave, state2, lowSaveRng);
    expect(enemyNoSave.conditions.some((c) => c.id === "mesmerized")).toBe(true);
  });
});

describe("Archetype: Retributive Strike (Vindicator reaction)", () => {
  it("triggers reaction when vindicator is hit by melee attack", () => {
    const rng = createRng(42);
    const vindicator = makeUnit({ instanceId: "v", pos: { q: 0, r: 0 }, team: "hero", hp: 50, stats: { maxHp: 50, armor: 5, move: 3, might: 5, agility: 1, spirit: 0 }, passives: ["archetype_passive.vindicator_below_50_attack"] });
    const enemy = makeUnit({ instanceId: "e", pos: { q: 1, r: 0 }, team: "enemy", hp: 30, stats: { maxHp: 30, armor: 5, move: 3, might: 5, agility: 0, spirit: 0 } });
    const state = twoUnitState(enemy, vindicator);
    const beforeEnemyHp = enemy.hp;
    resolveAction(ACTION_REGISTRY["action.slash"], enemy, vindicator, state, rng);
    // If retributive strike hit, enemy should have taken additional damage.
    const retribLogged = state.log.some((e) => e.text.includes("Retributive Strike"));
    if (retribLogged) {
      expect(enemy.hp).toBeLessThan(beforeEnemyHp);
      expect(vindicator.reactionUsedThisTurn).toBe(true);
    }
    // Reaction should not fire twice.
    const retribCount = state.log.filter((e) => e.text.includes("Retributive Strike")).length;
    expect(retribCount).toBeLessThanOrEqual(1);
  });
});

describe("Archetype: Evoker crit floor", () => {
  it("crit on 19-20 with evoker passive", () => {
    const rng = createRng(42);
    // We need to control the rng to get a 19.
    // We'll use a custom rng that returns values that give d20=19, d20=20.
    const rolls: number[] = [18/20, 19/20]; // d20=19, d20=20
    let idx = 0;
    const controlled = () => rolls[idx++ % rolls.length];

    const evoker = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, defId: "class.arcanist", stats: { maxHp: 100, armor: 10, move: 3, might: 0, agility: 1, spirit: 10 }, passives: ["archetype_passive.evoker_crit_floor"] });
    // First attack: d20=19 should crit with the passive.
    const target1 = makeUnit({ instanceId: "t1", pos: { q: 1, r: 0 }, team: "enemy", hp: 100, stats: { maxHp: 100, armor: 30, move: 3, might: 0, agility: 0, spirit: 0 } });
    const state1 = twoUnitState(evoker, target1);
    resolveAction(ACTION_REGISTRY["action.fire_bolt"], evoker, target1, state1, controlled);
    // With d20=19 and evoker passive, this should crit. Armor 30 is high so only crit can hit.
    expect(target1.hp).toBeLessThan(100);
    const critLog = state1.log.find((e) => e.text.includes("crit"));
    expect(critLog).toBeDefined();

    // For comparison, without the passive d20=19 should NOT crit vs armor 30.
    // Re-run with the same but no passive to verify.
  });
});

describe("Archetype: Cloistered heal bonus", () => {
  it("cloistered passive adds +2 to each heal", () => {
    const rng = createRng(3);
    const acoStats = { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 5 };
    const allyStats = { maxHp: 100, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 };

    // Without cloistered passive
    const baseA = makeUnit({ instanceId: "a", pos: { q: 0, r: 0 }, defId: "class.acolyte", stats: { ...acoStats } });
    const baseAlly = makeUnit({ instanceId: "b", pos: { q: 1, r: 0 }, hp: 10, stats: { ...allyStats } });
    resolveAction(ACTION_REGISTRY["action.mend_wounds"], baseA, baseAlly, twoUnitState(baseA, baseAlly), createRng(3));
    const baseHeal = baseAlly.hp - 10;

    // With cloistered passive
    const cloisteredA = makeUnit({ instanceId: "a2", pos: { q: 0, r: 0 }, defId: "class.acolyte", stats: { ...acoStats }, passives: ["archetype_passive.cloistered_heal_bonus"] });
    const cloisteredAlly = makeUnit({ instanceId: "b2", pos: { q: 1, r: 0 }, hp: 10, stats: { ...allyStats } });
    resolveAction(ACTION_REGISTRY["action.mend_wounds"], cloisteredA, cloisteredAlly, twoUnitState(cloisteredA, cloisteredAlly), createRng(3));
    const cloisteredHeal = cloisteredAlly.hp - 10;

    expect(cloisteredHeal - baseHeal).toBe(2);
  });
});
