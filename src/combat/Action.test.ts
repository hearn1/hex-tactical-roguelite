import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import { resolveAction, validTargets, checkVictoryDefeat } from "./Action.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";

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

describe("Action", () => {
  describe("resolveAction damage", () => {
    it("HP floors at 0", () => {
      const rng = createRng(1);
      const attacker = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, stats: { maxHp: 100, armor: 10, move: 3, might: 10, agility: 0, spirit: 0 } });
      const target = makeUnit({ instanceId: "t1", pos: { q: 1, r: 0 }, team: "enemy", hp: 2, stats: { maxHp: 2, armor: 10, move: 3, might: 0, agility: 0, spirit: 0 } });
      const state: CombatState = { round: 1, activeIndex: 0, turnQueue: ["a1", "t1"], units: [attacker, target], log: [], status: "active", gridKeys: ["0,0", "1,0"], targetingActionId: null };
      resolveAction(ACTION_REGISTRY["action.slash"], attacker, target, state, rng);
      expect(target.hp).toBe(0);
    });

    it("natural 20 always hits and damage doubled", () => {
      const rng = createRng(999);
      const attacker = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, stats: { maxHp: 100, armor: 10, move: 3, might: 0, agility: 0, spirit: 0 } });
      const target = makeUnit({ instanceId: "t1", pos: { q: 1, r: 0 }, team: "enemy", hp: 100, stats: { maxHp: 100, armor: 30, move: 3, might: 0, agility: 0, spirit: 0 } });
      const state: CombatState = { round: 1, activeIndex: 0, turnQueue: ["a1", "t1"], units: [attacker, target], log: [], status: "active", gridKeys: ["0,0", "1,0"], targetingActionId: null };
      const before = target.hp;
      resolveAction(ACTION_REGISTRY["action.slash"], attacker, target, state, rng);
      expect(before - target.hp).toBeGreaterThanOrEqual(2);
      expect(before - target.hp).toBeLessThanOrEqual(12);
    });
  });

  describe("resolveAction heal", () => {
    it("heal caps at maxHp", () => {
      const rng = createRng(42);
      const acolyte = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 }, defId: "class.acolyte", stats: { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 5 } });
      const ally = makeUnit({ instanceId: "a2", pos: { q: 1, r: 0 }, hp: 16, stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 } });
      const state: CombatState = { round: 1, activeIndex: 0, turnQueue: ["a1", "a2"], units: [acolyte, ally], log: [], status: "active", gridKeys: ["0,0", "1,0"], targetingActionId: null };
      const before = ally.hp;
      resolveAction(ACTION_REGISTRY["action.mend_wounds"], acolyte, ally, state, rng);
      expect(ally.hp).toBeLessThanOrEqual(ally.stats.maxHp);
      expect(ally.hp).toBeGreaterThanOrEqual(before);
    });
  });

  describe("validTargets", () => {
    it("fire bolt at range 4 includes enemies within 4 and excludes own team", () => {
      const arcanist = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 }, defId: "class.arcanist", stats: { maxHp: 11, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 } });
      const enemyNear = makeUnit({ instanceId: "e1", pos: { q: 0, r: 1 }, team: "enemy", stats: { maxHp: 8, armor: 12, move: 4, might: 1, agility: 3, spirit: 0 } });
      const enemyFar = makeUnit({ instanceId: "e2", pos: { q: 0, r: 5 }, team: "enemy", stats: { maxHp: 8, armor: 12, move: 4, might: 1, agility: 3, spirit: 0 } });
      const deadEnemy = makeUnit({ instanceId: "e3", pos: { q: 1, r: 0 }, team: "enemy", hp: 0, stats: { maxHp: 8, armor: 12, move: 4, might: 1, agility: 3, spirit: 0 } });
      const ally = makeUnit({ instanceId: "h2", pos: { q: 2, r: 0 }, stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 } });
      const state: CombatState = { round: 1, activeIndex: 0, turnQueue: ["h1", "e1", "e2", "e3", "h2"], units: [arcanist, enemyNear, enemyFar, deadEnemy, ally], log: [], status: "active", gridKeys: [], targetingActionId: null };
      const targets = validTargets(ACTION_REGISTRY["action.fire_bolt"], arcanist, state);
      expect(targets.map((t) => t.instanceId)).toContain("e1");
      expect(targets.map((t) => t.instanceId)).not.toContain("e2");
      expect(targets.map((t) => t.instanceId)).not.toContain("e3");
      expect(targets.map((t) => t.instanceId)).not.toContain("h2");
    });
  });
});
