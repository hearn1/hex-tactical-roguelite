import { describe, it, expect } from "vitest";
import { canUseAction, payActionCosts, getTurnEconomy } from "./ActionEconomy.ts";
import { resolveAction } from "./Action.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import type { UnitInstance, CombatState, Hex, TurnEconomyState } from "../state/types.ts";
import { createRng } from "../core/rng.ts";

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
    turnEconomy: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, extraActionsRemaining: 0 },
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex }): UnitInstance {
  return makeUnit({ team: "enemy", ...overrides });
}

function makeState(units: UnitInstance[], perEncounterUses: Record<string, number> = {}): CombatState {
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: units.map((u) => u.instanceId),
    units,
    log: [],
    status: "active",
    gridKeys: units.map((u) => `${u.pos.q},${u.pos.r}`),
    targetingActionId: null,
    perEncounterUses,
  };
}

describe("ActionEconomy — core timing model (#507)", () => {
  describe("canUseAction", () => {
    it("standard action is available when actionUsed is false", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      const state = makeState([hero]);
      const check = canUseAction(hero, ACTION_REGISTRY["action.slash"], state);
      expect(check.canUse).toBe(true);
    });

    it("standard action is blocked when actionUsed is true", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      hero.turnEconomy!.actionUsed = true;
      hero.hasActed = true;
      const state = makeState([hero]);
      const check = canUseAction(hero, ACTION_REGISTRY["action.slash"], state);
      expect(check.canUse).toBe(false);
      expect(check.reason).toMatch(/no action remaining/i);
    });

    it("bonus action does not consume standard action — bonus available while action available", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      const state = makeState([hero]);
      const ba = ACTION_REGISTRY["action.cunning_step"];
      expect(ba.timing).toBe("bonus_action");
      const check = canUseAction(hero, ba, state);
      expect(check.canUse).toBe(true);
    });

    it("standard action does not consume bonus action — action available while bonus used", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      hero.turnEconomy!.bonusActionUsed = true;
      const state = makeState([hero]);
      const check = canUseAction(hero, ACTION_REGISTRY["action.slash"], state);
      expect(check.canUse).toBe(true);
    });

    it("bonus action is blocked when bonusActionUsed is true", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      hero.turnEconomy!.bonusActionUsed = true;
      const state = makeState([hero]);
      const check = canUseAction(hero, ACTION_REGISTRY["action.cunning_step"], state);
      expect(check.canUse).toBe(false);
      expect(check.reason).toMatch(/no bonus action remaining/i);
    });

    it("charges still work — blocked when exhausted", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      const state = makeState([hero], { "action.cunning_step": 1 });
      const check = canUseAction(hero, ACTION_REGISTRY["action.cunning_step"], state);
      expect(check.canUse).toBe(false);
      expect(check.reason).toMatch(/no charges remaining/i);
    });

    it("spell slots still work — blocked when insufficient", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 }, spellSlotsRemaining: 0 });
      const state = makeState([hero]);
      const check = canUseAction(hero, ACTION_REGISTRY["action.mend_wounds"], state);
      expect(check.canUse).toBe(false);
      expect(check.reason).toMatch(/no spell slots remaining/i);
    });

    it("downed hero cannot act", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 }, heroLifeState: "downed" });
      const state = makeState([hero]);
      const check = canUseAction(hero, ACTION_REGISTRY["action.slash"], state);
      expect(check.canUse).toBe(false);
    });

    it("dead hero cannot act", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 }, heroLifeState: "dead" });
      const state = makeState([hero]);
      const check = canUseAction(hero, ACTION_REGISTRY["action.slash"], state);
      expect(check.canUse).toBe(false);
    });

    it("extra action allows an additional standard action when actionUsed is true", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      hero.turnEconomy!.actionUsed = true;
      hero.turnEconomy!.extraActionsRemaining = 1;
      hero.hasActed = true;
      const state = makeState([hero]);
      const check = canUseAction(hero, ACTION_REGISTRY["action.slash"], state);
      expect(check.canUse).toBe(true);
    });
  });

  describe("payActionCosts", () => {
    it("standard action sets actionUsed and hasActed", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      const state = makeState([hero]);
      payActionCosts(hero, ACTION_REGISTRY["action.slash"], state);
      expect(getTurnEconomy(hero).actionUsed).toBe(true);
      expect(hero.hasActed).toBe(true);
    });

    it("bonus action sets bonusActionUsed but NOT actionUsed", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      const state = makeState([hero], { "action.cunning_step": 0 });
      payActionCosts(hero, ACTION_REGISTRY["action.cunning_step"], state);
      expect(getTurnEconomy(hero).bonusActionUsed).toBe(true);
      expect(getTurnEconomy(hero).actionUsed).toBe(false);
      expect(hero.hasActed).toBe(false);
    });

    it("standard action does not set bonusActionUsed", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      const state = makeState([hero]);
      payActionCosts(hero, ACTION_REGISTRY["action.slash"], state);
      expect(getTurnEconomy(hero).bonusActionUsed).toBe(false);
    });

    it("free-timing action sets neither actionUsed nor bonusActionUsed", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      const state = makeState([hero]);
      const freeAction = { ...ACTION_REGISTRY["action.slash"], timing: "free" as const };
      payActionCosts(hero, freeAction, state);
      expect(getTurnEconomy(hero).actionUsed).toBe(false);
      expect(getTurnEconomy(hero).bonusActionUsed).toBe(false);
    });

    it("extra action decrements extraActionsRemaining instead of setting actionUsed", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      hero.turnEconomy!.actionUsed = true;
      hero.turnEconomy!.extraActionsRemaining = 1;
      const state = makeState([hero]);
      payActionCosts(hero, ACTION_REGISTRY["action.slash"], state);
      expect(getTurnEconomy(hero).extraActionsRemaining).toBe(0);
      expect(getTurnEconomy(hero).actionUsed).toBe(true);
    });

    it("spell slot is consumed when paying costs", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 }, spellSlotsRemaining: 2 });
      const state = makeState([hero]);
      payActionCosts(hero, ACTION_REGISTRY["action.mend_wounds"], state);
      expect(hero.spellSlotsRemaining).toBe(1);
    });

    it("charge is consumed when paying costs", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      const state = makeState([hero], {});
      payActionCosts(hero, ACTION_REGISTRY["action.cunning_step"], state);
      expect((state.perEncounterUses as Record<string, number>)["action.cunning_step"]).toBe(1);
    });
  });

  describe("movement — remains separate from action economy", () => {
    it("movement points are tracked independently from action economy", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 }, movePointsRemaining: 3 });
      const state = makeState([hero]);
      payActionCosts(hero, ACTION_REGISTRY["action.slash"], state);
      expect(hero.movePointsRemaining).toBe(3);
    });
  });

  describe("enemy turns still work", () => {
    it("enemy can use resolveAction and the turn economy is tracked", () => {
      const enemy = makeEnemy({ instanceId: "e1", pos: { q: 0, r: 0 }, team: "enemy" });
      const hero = makeUnit({ instanceId: "h1", pos: { q: 1, r: 0 }, stats: { maxHp: 100, armor: 5, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, hp: 100 });
      const state = makeState([enemy, hero]);
      const rng = createRng(1);
      resolveAction(ACTION_REGISTRY["action.slash"], enemy, hero, state, rng);
      expect(getTurnEconomy(enemy).actionUsed).toBe(true);
      expect(enemy.hasActed).toBe(true);
    });

    it("enemy attack can damage heroes (enemy turns work end-to-end)", () => {
      const enemy = makeEnemy({ instanceId: "e1", pos: { q: 0, r: 0 }, team: "enemy", stats: { maxHp: 20, armor: 10, move: 3, str: 5, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
      const hero = makeUnit({ instanceId: "h1", pos: { q: 1, r: 0 }, stats: { maxHp: 100, armor: 5, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, hp: 100 });
      const state = makeState([enemy, hero]);
      const rng = createRng(42);
      resolveAction(ACTION_REGISTRY["action.slash"], enemy, hero, state, rng);
      expect(hero.hp).toBeLessThan(100);
    });
  });

  describe("getTurnEconomy", () => {
    it("creates economy state if absent (save compat)", () => {
      const hero = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
      delete (hero as any).turnEconomy;
      const eco: TurnEconomyState = getTurnEconomy(hero);
      expect(eco.actionUsed).toBe(false);
      expect(eco.bonusActionUsed).toBe(false);
      expect(eco.reactionUsed).toBe(false);
      expect(eco.extraActionsRemaining).toBe(0);
    });
  });
});
