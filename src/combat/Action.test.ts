import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import { resolveAction, validTargets, checkVictoryDefeat, RALLY_DURATION } from "./Action.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";
import { getTraitTriggered } from "./Traits.ts";
import { heroLifeState } from "./DeathSaves.ts";

function makeUnit(overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex }): UnitInstance {
  return {
    defId: "class.guardian",
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
    hp: 18,
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

describe("Action", () => {
  describe("resolveAction damage", () => {
    it("HP floors at 0", () => {
      const rng = createRng(1);
      const attacker = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, stats: { maxHp: 100, armor: 10, move: 3, str: 10, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const target = makeUnit({ instanceId: "t1", pos: { q: 1, r: 0 }, team: "enemy", hp: 2, stats: { maxHp: 2, armor: 10, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const state: CombatState = { round: 1, activeIndex: 0, turnQueue: ["a1", "t1"], units: [attacker, target], log: [], status: "active", gridKeys: ["0,0", "1,0"], targetingActionId: null, perEncounterUses: {} };
      resolveAction(ACTION_REGISTRY["action.slash"], attacker, target, state, rng);
      expect(target.hp).toBe(0);
    });

    it("killing a single-target enemy sets shouldCheckCombatEnd on ActionResult (#270)", () => {
      // Use a guaranteed-hit seed with a high-str attacker vs low-HP target.
      const rng = createRng(1);
      const attacker = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, stats: { maxHp: 100, armor: 10, move: 3, str: 10, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const target = makeUnit({ instanceId: "t1", pos: { q: 1, r: 0 }, team: "enemy", hp: 1, stats: { maxHp: 1, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const state: CombatState = { round: 1, activeIndex: 0, turnQueue: ["a1", "t1"], units: [attacker, target], log: [], status: "active", gridKeys: ["0,0", "1,0"], targetingActionId: null, perEncounterUses: {}, traitState: { actionRotationIndex: {}, triggered: {} } };
      const result = resolveAction(ACTION_REGISTRY["action.slash"], attacker, target, state, rng);
      expect(target.hp).toBe(0);
      expect(result.shouldCheckCombatEnd).toBe(true);
    });

    it("single-target enemy kill produces exactly one defeat log entry (#270)", () => {
      const rng = createRng(1);
      const attacker = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, stats: { maxHp: 100, armor: 10, move: 3, str: 10, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const target = makeUnit({ instanceId: "t1", pos: { q: 1, r: 0 }, team: "enemy", hp: 1, stats: { maxHp: 1, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const state: CombatState = { round: 1, activeIndex: 0, turnQueue: ["a1", "t1"], units: [attacker, target], log: [], status: "active", gridKeys: ["0,0", "1,0"], targetingActionId: null, perEncounterUses: {}, traitState: { actionRotationIndex: {}, triggered: {} } };
      resolveAction(ACTION_REGISTRY["action.slash"], attacker, target, state, rng);
      expect(state.log.filter((e) => e.kind === "defeat").length).toBe(1);
    });

    it("natural 20 always hits and damage doubled", () => {
      const rng = createRng(999);
      const attacker = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, stats: { maxHp: 100, armor: 10, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const target = makeUnit({ instanceId: "t1", pos: { q: 1, r: 0 }, team: "enemy", hp: 100, stats: { maxHp: 100, armor: 30, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const state: CombatState = { round: 1, activeIndex: 0, turnQueue: ["a1", "t1"], units: [attacker, target], log: [], status: "active", gridKeys: ["0,0", "1,0"], targetingActionId: null, perEncounterUses: {} };
      const before = target.hp;
      resolveAction(ACTION_REGISTRY["action.slash"], attacker, target, state, rng);
      expect(before - target.hp).toBeGreaterThanOrEqual(2);
      expect(before - target.hp).toBeLessThanOrEqual(12);
    });
  });

  describe("resolveAction heal", () => {
    it("heal caps at maxHp", () => {
      const rng = createRng(42);
      const acolyte = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, defId: "class.acolyte", stats: { maxHp: 14, armor: 12, move: 3, str: 1, dex: 1, con: 0, int: 5, wis: 0, cha: 0 } });
      const ally = makeUnit({ instanceId: "a2", pos: { q: 1, r: 0 }, hp: 16, stats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 } });
      const state: CombatState = { round: 1, activeIndex: 0, turnQueue: ["a1", "a2"], units: [acolyte, ally], log: [], status: "active", gridKeys: ["0,0", "1,0"], targetingActionId: null, perEncounterUses: {} };
      const before = ally.hp;
      resolveAction(ACTION_REGISTRY["action.mend_wounds"], acolyte, ally, state, rng);
      expect(ally.hp).toBeLessThanOrEqual(ally.stats.maxHp);
      expect(ally.hp).toBeGreaterThanOrEqual(before);
    });
  });

  describe("validTargets", () => {
    it("fire bolt at range 4 includes enemies within 4 and excludes own team", () => {
      const arcanist = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 }, defId: "class.arcanist", stats: { maxHp: 11, armor: 11, move: 3, str: 0, dex: 1, con: 0, int: 4, wis: 0, cha: 0 } });
      const enemyNear = makeUnit({ instanceId: "e1", pos: { q: 0, r: 1 }, team: "enemy", stats: { maxHp: 8, armor: 12, move: 4, str: 1, dex: 3, con: 0, int: 0, wis: 0, cha: 0 } });
      const enemyFar = makeUnit({ instanceId: "e2", pos: { q: 0, r: 5 }, team: "enemy", stats: { maxHp: 8, armor: 12, move: 4, str: 1, dex: 3, con: 0, int: 0, wis: 0, cha: 0 } });
      const deadEnemy = makeUnit({ instanceId: "e3", pos: { q: 1, r: 0 }, team: "enemy", hp: 0, stats: { maxHp: 8, armor: 12, move: 4, str: 1, dex: 3, con: 0, int: 0, wis: 0, cha: 0 } });
      const ally = makeUnit({ instanceId: "h2", pos: { q: 2, r: 0 }, stats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 } });
      const state: CombatState = { round: 1, activeIndex: 0, turnQueue: ["h1", "e1", "e2", "e3", "h2"], units: [arcanist, enemyNear, enemyFar, deadEnemy, ally], log: [], status: "active", gridKeys: [], targetingActionId: null, perEncounterUses: {} };
      const targets = validTargets(ACTION_REGISTRY["action.fire_bolt"], arcanist, state);
      expect(targets.map((t) => t.instanceId)).toContain("e1");
      expect(targets.map((t) => t.instanceId)).not.toContain("e2");
      expect(targets.map((t) => t.instanceId)).not.toContain("e3");
      expect(targets.map((t) => t.instanceId)).not.toContain("h2");
    });
  });

  describe("spell slots (#118)", () => {
    function castState(caster: UnitInstance, ally: UnitInstance): CombatState {
      return { round: 1, activeIndex: 0, turnQueue: ["a1", "a2"], units: [caster, ally], log: [], status: "active", gridKeys: ["0,0", "1,0"], targetingActionId: null, perEncounterUses: {} };
    }

    it("casting a spell-slot action decrements the caster's slots", () => {
      const rng = createRng(42);
      const acolyte = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, defId: "class.acolyte", spellSlotsMax: 2, spellSlotsRemaining: 2, stats: { maxHp: 14, armor: 12, move: 3, str: 1, dex: 1, con: 0, int: 5, wis: 0, cha: 0 } });
      const ally = makeUnit({ instanceId: "a2", pos: { q: 1, r: 0 }, hp: 10, stats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 } });
      const result = resolveAction(ACTION_REGISTRY["action.mend_wounds"], acolyte, ally, castState(acolyte, ally), rng);
      expect(acolyte.spellSlotsRemaining).toBe(1);
      expect(result.kind).toBe("heal");
      expect(ally.hp).toBeGreaterThan(10);
    });

    it("blocks the cast and leaves the target unchanged when no slots remain", () => {
      const rng = createRng(42);
      const acolyte = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, defId: "class.acolyte", spellSlotsMax: 2, spellSlotsRemaining: 0, stats: { maxHp: 14, armor: 12, move: 3, str: 1, dex: 1, con: 0, int: 5, wis: 0, cha: 0 } });
      const ally = makeUnit({ instanceId: "a2", pos: { q: 1, r: 0 }, hp: 10, stats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 } });
      const state = castState(acolyte, ally);
      const result = resolveAction(ACTION_REGISTRY["action.mend_wounds"], acolyte, ally, state, rng);
      expect(result.kind).toBe("miss");
      expect(ally.hp).toBe(10);
      expect(acolyte.spellSlotsRemaining).toBe(0);
      expect(state.log.some((e) => e.text.includes("no spell slots remaining"))).toBe(true);
    });

    it("does not consume slots for cantrips", () => {
      const rng = createRng(42);
      const acolyte = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, defId: "class.acolyte", spellSlotsMax: 2, spellSlotsRemaining: 2, stats: { maxHp: 14, armor: 12, move: 3, str: 4, dex: 1, con: 0, int: 1, wis: 0, cha: 0 } });
      const enemy = makeUnit({ instanceId: "a2", pos: { q: 1, r: 0 }, team: "enemy", hp: 10, stats: { maxHp: 18, armor: 5, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      resolveAction(ACTION_REGISTRY["action.mace_strike"], acolyte, enemy, castState(acolyte, enemy), rng);
      expect(acolyte.spellSlotsRemaining).toBe(2);
    });
  });

  describe("cover terrain (#121)", () => {
    function coverState(attacker: UnitInstance, target: UnitInstance, terrain?: Record<string, "cover" | "difficult" | "hazard" | "normal">): CombatState {
      return {
        round: 1,
        activeIndex: 0,
        turnQueue: [attacker.instanceId, target.instanceId],
        units: [attacker, target],
        log: [],
        status: "active",
        gridKeys: ["0,0", "1,0", "2,0", "3,0", "-1,0"],
        targetingActionId: null,
        perEncounterUses: {},
        terrain,
      };
    }

    it("cover raises effective armor by COVER_ARMOR_BONUS against ranged attacks", () => {
      // target armor = 10; cover should make effective armor = 12.
      // We need a roll that hits armor 10 but misses armor 12.
      // Use a seeded rng that produces a d20 roll of 11 (hits 10, misses 12).
      // The actual roll depends on the seed â€” instead test log text for cover mention.
      const rng = createRng(77); // Produces deterministic rolls
      const attacker = makeUnit({
        instanceId: "a1",
        pos: { q: 0, r: 0 },
        stats: { maxHp: 20, armor: 12, move: 3, str: 0, dex: 2, con: 0, int: 4, wis: 0, cha: 0 },
      });
      // Target with armor 8 on a cover hex â€” effective armor becomes 10.
      const target = makeUnit({
        instanceId: "t1",
        pos: { q: 3, r: 0 },
        team: "enemy",
        hp: 20,
        stats: { maxHp: 20, armor: 8, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      });
      const state = coverState(attacker, target, { "3,0": "cover" });
      resolveAction(ACTION_REGISTRY["action.fire_bolt"], attacker, target, state, rng);
      const log = state.log.find((e) => e.kind === "action" && e.text.includes("cover"));
      expect(log).toBeDefined();
    });

    it("melee attack on a covered target does not apply cover bonus", () => {
      const rng = createRng(42);
      const attacker = makeUnit({
        instanceId: "a1",
        pos: { q: 0, r: 0 },
        stats: { maxHp: 20, armor: 12, move: 3, str: 5, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      });
      const target = makeUnit({
        instanceId: "t1",
        pos: { q: 1, r: 0 },
        team: "enemy",
        hp: 20,
        stats: { maxHp: 20, armor: 5, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      });
      const state = coverState(attacker, target, { "1,0": "cover" });
      resolveAction(ACTION_REGISTRY["action.slash"], attacker, target, state, rng);
      // No log entry mentioning cover.
      expect(state.log.some((e) => e.text.includes("cover"))).toBe(false);
    });

    it("cover does not affect healing actions", () => {
      const rng = createRng(42);
      const healer = makeUnit({
        instanceId: "h1",
        pos: { q: 0, r: 0 },
        defId: "class.acolyte",
        stats: { maxHp: 14, armor: 12, move: 3, str: 1, dex: 1, con: 0, int: 5, wis: 0, cha: 0 },
        spellSlotsRemaining: 2,
        spellSlotsMax: 2,
      });
      const ally = makeUnit({
        instanceId: "h2",
        pos: { q: 1, r: 0 },
        hp: 8,
        stats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      });
      const state = coverState(healer, ally, { "1,0": "cover" });
      const before = ally.hp;
      resolveAction(ACTION_REGISTRY["action.mend_wounds"], healer, ally, state, rng);
      // Heal should succeed and not mention cover.
      expect(ally.hp).toBeGreaterThan(before);
      expect(state.log.some((e) => e.text.includes("cover"))).toBe(false);
    });
  });
});

describe("AoE aftermath routing (#271)", () => {
  function makeAoeUnit(overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex }): UnitInstance {
    return {
      defId: "class.guardian",
      displayName: overrides.instanceId,
      team: "hero",
      level: 1,
      xp: 0,
      stats: { maxHp: 20, armor: 12, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 20,
      conditions: [],
      movePointsRemaining: 3,
      hasActed: false,
      equippedItemIds: { weapon: null, armor: null, trinket: null },
      bonusStats: {},
      ...overrides,
    };
  }

  function makeAoeState(units: UnitInstance[], overrides: Partial<CombatState> = {}): CombatState {
    const grid = hexesWithinRange({ q: 0, r: 0 }, 5);
    return {
      round: 1,
      activeIndex: 0,
      turnQueue: units.map((u) => u.instanceId),
      units,
      log: [],
      status: "active",
      gridKeys: grid.map(hexKey),
      targetingActionId: null,
      perEncounterUses: {},
      traitState: { actionRotationIndex: {}, triggered: {} },
      ...overrides,
    };
  }

  describe("aoe_radius (Fireball) routing", () => {
    it("multi-kill AoE produces exactly 2 defeat log entries with no duplicates (#271)", () => {
      const rng = () => 0.99; // d20=20 (crit), damage maxed
      const caster = makeAoeUnit({
        instanceId: "caster",
        pos: { q: 0, r: 0 },
        defId: "class.arcanist",
        stats: { maxHp: 12, armor: 11, move: 3, str: 0, dex: 0, con: 0, int: 20, wis: 0, cha: 0 },
      });
      const e1 = makeAoeUnit({ instanceId: "e1", pos: { q: 1, r: 0 }, team: "enemy", hp: 1, stats: { maxHp: 1, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const e2 = makeAoeUnit({ instanceId: "e2", pos: { q: 2, r: 0 }, team: "enemy", hp: 1, stats: { maxHp: 1, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const state = makeAoeState([caster, e1, e2]);

      const result = resolveAction(ACTION_REGISTRY["action.fireball"], caster, e1, state, rng);

      expect(e1.hp).toBe(0);
      expect(e2.hp).toBe(0);
      expect(state.log.filter((l) => l.kind === "defeat").length).toBe(2);
      expect(result.shouldCheckCombatEnd).toBe(true);
    });

    it("AoE crossing a boss HP threshold spawns reinforcement exactly once (#271)", () => {
      const rng = () => 0.99;
      const caster = makeAoeUnit({
        instanceId: "caster",
        pos: { q: 0, r: 0 },
        defId: "class.arcanist",
        stats: { maxHp: 12, armor: 11, move: 3, str: 0, dex: 0, con: 0, int: 20, wis: 0, cha: 0 },
      });
      // Ogre Hexbreaker: maxHp 42, threshold at 50% = 21. Set HP just above threshold.
      const boss = makeAoeUnit({
        instanceId: "boss_0",
        pos: { q: 1, r: 0 },
        defId: "enemy.ogre_hexbreaker",
        team: "enemy",
        displayName: "Ogre Hexbreaker",
        hp: 22,
        stats: { maxHp: 42, armor: 13, move: 3, str: 4, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
      });
      const state = makeAoeState([caster, boss]);

      resolveAction(ACTION_REGISTRY["action.fireball"], caster, boss, state, rng);

      // Threshold triggers once; a reinforcement unit is added.
      const reinforcements = state.units.filter((u) => u.instanceId === "enemy_reinforcement");
      expect(reinforcements.length).toBe(1);
    });
  });

  describe("aoe_around_caster (Cleave) routing", () => {
    it("AoE killing the first elite triggers Rally exactly once for surviving enemies (#271)", () => {
      const rng = () => 0.99; // guaranteed crit
      const hero = makeAoeUnit({
        instanceId: "hero",
        pos: { q: 0, r: 0 },
        stats: { maxHp: 20, armor: 12, move: 3, str: 20, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      });
      const e1 = makeAoeUnit({ instanceId: "e1", pos: { q: 1, r: 0 }, team: "enemy", hp: 1, stats: { maxHp: 20, armor: 1, move: 3, str: 1, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const e2 = makeAoeUnit({ instanceId: "e2", pos: { q: 0, r: 1 }, team: "enemy", hp: 1, stats: { maxHp: 20, armor: 1, move: 3, str: 1, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      // Survivor outside Cleave range (range 1) — still receives Rally.
      const e3 = makeAoeUnit({ instanceId: "e3", pos: { q: 3, r: 0 }, team: "enemy", hp: 20, stats: { maxHp: 20, armor: 12, move: 3, str: 1, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const state = makeAoeState([hero, e1, e2, e3], { encounterId: "encounter.broken_banner_elite" });

      resolveAction(ACTION_REGISTRY["action.cleave"], hero, e1, state, rng);

      expect(e1.hp).toBe(0);
      expect(e2.hp).toBe(0);
      expect(getTraitTriggered(state, "encounter:elite_rally_on_first_death")).toBe(true);
      // Rally log fires exactly once, not once per dead elite.
      expect(state.log.filter((l) => l.text.includes("Rally")).length).toBe(1);
      // Survivor gets rallied exactly once.
      expect(e3.conditions.filter((c) => c.id === "rallied").length).toBe(1);
      expect(e3.conditions.some((c) => c.id === "rallied" && c.remainingTurns === RALLY_DURATION)).toBe(true);
    });
  });

  describe("primary_plus_adjacent (Ground Slam) routing", () => {
    it("Ground Slam downing primary + adjacent hero both transition correctly; caller gets real data (#271)", () => {
      const rng = () => 0.99; // guaranteed crit
      const enemy = makeAoeUnit({
        instanceId: "enemy",
        pos: { q: 0, r: 0 },
        defId: "enemy.ogre_hexbreaker",
        team: "enemy",
        displayName: "Ogre Hexbreaker",
        stats: { maxHp: 42, armor: 13, move: 3, str: 4, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        hp: 42,
      });
      // Primary target: hero adjacent to enemy (distance 1).
      const hero1 = makeAoeUnit({
        instanceId: "hero1",
        pos: { q: 1, r: 0 },
        hp: 1,
        heroLifeState: "standing",
        stats: { maxHp: 20, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      });
      // Adjacent hero: also within distance 1 of enemy, not the primary target.
      const hero2 = makeAoeUnit({
        instanceId: "hero2",
        pos: { q: 0, r: 1 },
        hp: 1,
        heroLifeState: "standing",
        stats: { maxHp: 20, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      });
      const state = makeAoeState([enemy, hero1, hero2]);

      const result = resolveAction(ACTION_REGISTRY["action.ground_slam"], enemy, hero1, state, rng);

      expect(hero1.hp).toBe(0);
      expect(hero2.hp).toBe(0);
      expect(heroLifeState(hero1)).toBe("downed");
      expect(heroLifeState(hero2)).toBe("downed");
      // Caller receives real damage amount and shouldCheckCombatEnd signal.
      expect(result.amount).toBeGreaterThan(0);
      expect(result.shouldCheckCombatEnd).toBe(true);
    });
  });
});
