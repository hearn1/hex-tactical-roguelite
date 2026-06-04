import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import { getItemHooksForUnit, resolveOncePerCombatBonus, resolveAttackBonus } from "./ItemHooks.ts";
import { resolveAction } from "./Action.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import { applyCondition } from "./Condition.ts";
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

function makeCombatState(units: UnitInstance[]): CombatState {
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: units.map((u) => u.instanceId),
    units,
    log: [],
    status: "active",
    gridKeys: ["0,0", "1,0", "2,0"],
    targetingActionId: null,
  };
}

describe("ItemHooks", () => {
  describe("getItemHooksForUnit", () => {
    it("returns empty for unit with no items", () => {
      const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 } });
      expect(getItemHooksForUnit(unit)).toEqual([]);
    });

    it("returns hooks for equipped items that have hooks", () => {
      const unit = makeUnit({
        instanceId: "u1",
        pos: { q: 0, r: 0 },
        equippedItemIds: { weapon: "item.runemark_blade", armor: "item.ward_stitched_vest", trinket: null },
      });
      const hooks = getItemHooksForUnit(unit);
      expect(hooks.length).toBe(2);
      expect(hooks[0].itemDef.id).toBe("item.runemark_blade");
      expect(hooks[1].itemDef.id).toBe("item.ward_stitched_vest");
    });

    it("only includes items with hooks", () => {
      const unit = makeUnit({
        instanceId: "u1",
        pos: { q: 0, r: 0 },
        equippedItemIds: { weapon: "item.iron_sword", armor: "item.chain_vest", trinket: "item.lucky_charm" },
      });
      expect(getItemHooksForUnit(unit)).toEqual([]);
    });
  });

  describe("resolveOncePerCombatBonus", () => {
    it("fires firstMeleeAttack once and marks hook used", () => {
      const unit = makeUnit({
        instanceId: "u1",
        pos: { q: 0, r: 0 },
        equippedItemIds: { weapon: "item.runemark_blade", armor: null, trinket: null },
      });
      const state = makeCombatState([unit]);

      const result1 = resolveOncePerCombatBonus(unit, "firstMeleeAttack", state);
      expect(result1.damageBonus).toBe(1);
      expect(unit.usedItemHooks).toContain("item.runemark_blade");

      const result2 = resolveOncePerCombatBonus(unit, "firstMeleeAttack", state);
      expect(result2.damageBonus).toBeUndefined();
      expect(state.log.filter((e) => e.text.includes("Runemark Blade")).length).toBe(1);
    });

    it("fires firstHitTaken once and reduces damage", () => {
      const unit = makeUnit({
        instanceId: "u1",
        pos: { q: 0, r: 0 },
        equippedItemIds: { weapon: null, armor: "item.ward_stitched_vest", trinket: null },
      });
      const state = makeCombatState([unit]);

      const result = resolveOncePerCombatBonus(unit, "firstHitTaken", state);
      expect(result.damageReduction).toBe(1);
      expect(unit.usedItemHooks).toContain("item.ward_stitched_vest");

      const result2 = resolveOncePerCombatBonus(unit, "firstHitTaken", state);
      expect(result2.damageReduction).toBeUndefined();
    });

    it("fires firstHealDone once and adds healing bonus", () => {
      const unit = makeUnit({
        instanceId: "u1",
        pos: { q: 0, r: 0 },
        equippedItemIds: { weapon: null, armor: null, trinket: "item.lantern_moth_pin" },
      });
      const state = makeCombatState([unit]);

      const result = resolveOncePerCombatBonus(unit, "firstHealDone", state);
      expect(result.healBonus).toBe(2);

      const result2 = resolveOncePerCombatBonus(unit, "firstHealDone", state);
      expect(result2.healBonus).toBeUndefined();
    });

    it("applies condition for combatStart trigger", () => {
      const unit = makeUnit({
        instanceId: "u1",
        pos: { q: 0, r: 0 },
        equippedItemIds: { weapon: null, armor: null, trinket: "item.hearthstone_charm" },
      });
      const state = makeCombatState([unit]);

      const result = resolveOncePerCombatBonus(unit, "combatStart", state);
      expect(result.damageBonus).toBeUndefined();
      expect(unit.conditions.some((c) => c.id === "guarded")).toBe(true);
      expect(unit.usedItemHooks).toContain("item.hearthstone_charm");
    });

    it("applies move bonus for firstTurn trigger", () => {
      const unit = makeUnit({
        instanceId: "u1",
        pos: { q: 0, r: 0 },
        equippedItemIds: { weapon: null, armor: null, trinket: "item.quickstep_buckle" },
      });
      const state = makeCombatState([unit]);

      const result = resolveOncePerCombatBonus(unit, "firstTurn", state);
      expect(result.moveBonus).toBe(1);

      const result2 = resolveOncePerCombatBonus(unit, "firstTurn", state);
      expect(result2.moveBonus).toBeUndefined();
    });
  });

  describe("resolveAttackBonus", () => {
    it("adds continuous spell damage for Emberglass Wand", () => {
      const unit = makeUnit({
        instanceId: "u1",
        pos: { q: 0, r: 0 },
        equippedItemIds: { weapon: "item.emberglass_wand", armor: null, trinket: null },
      });
      const state = makeCombatState([unit]);

      const bonus = resolveAttackBonus(unit, "spell", state);
      expect(bonus).toBe(1);
      expect(state.log.some((e) => e.text.includes("Emberglass Wand"))).toBe(true);
    });

    it("does not add bonus for wrong attack type", () => {
      const unit = makeUnit({
        instanceId: "u1",
        pos: { q: 0, r: 0 },
        equippedItemIds: { weapon: "item.emberglass_wand", armor: null, trinket: null },
      });
      const state = makeCombatState([unit]);

      const bonus = resolveAttackBonus(unit, "melee", state);
      expect(bonus).toBe(0);
    });
  });
});

describe("ItemHooks integration with resolveAction", () => {
  it("Runemark Blade adds bonus damage on first melee hit each combat", () => {
    const rng = createRng(42);
    const attacker = makeUnit({
      instanceId: "a1",
      pos: { q: 0, r: 0 },
      team: "hero",
      equippedItemIds: { weapon: "item.runemark_blade", armor: null, trinket: null },
      stats: { maxHp: 20, armor: 10, move: 3, might: 5, agility: 0, spirit: 0 },
    });
    const target = makeUnit({
      instanceId: "t1",
      pos: { q: 1, r: 0 },
      team: "enemy",
      hp: 30,
      stats: { maxHp: 30, armor: 10, move: 3, might: 0, agility: 0, spirit: 0 },
    });
    const state = makeCombatState([attacker, target]);

    resolveAction(ACTION_REGISTRY["action.slash"], attacker, target, state, rng);
    const runemarkLogs = state.log.filter((e) => e.text.includes("Runemark Blade"));
    expect(runemarkLogs.length).toBe(1);

    resolveAction(ACTION_REGISTRY["action.slash"], attacker, target, state, rng);
    const runemarkLogs2 = state.log.filter((e) => e.text.includes("Runemark Blade"));
    expect(runemarkLogs2.length).toBe(1);
  });

  it("Emberglass Wand adds spell damage on fire bolt", () => {
    const rng = createRng(42);
    const attacker = makeUnit({
      instanceId: "a1",
      pos: { q: 0, r: 0 },
      team: "hero",
      defId: "class.arcanist",
      equippedItemIds: { weapon: "item.emberglass_wand", armor: null, trinket: null },
      stats: { maxHp: 12, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 },
    });
    const target = makeUnit({
      instanceId: "t1",
      pos: { q: 1, r: 0 },
      team: "enemy",
      hp: 30,
      stats: { maxHp: 30, armor: 10, move: 3, might: 0, agility: 0, spirit: 0 },
    });
    const state = makeCombatState([attacker, target]);

    resolveAction(ACTION_REGISTRY["action.fire_bolt"], attacker, target, state, rng);
    expect(state.log.some((e) => e.text.includes("Emberglass Wand"))).toBe(true);
  });

  it("Ward-Stitched Vest reduces first hit taken", () => {
    const rng = createRng(42);
    const attacker = makeUnit({
      instanceId: "a1",
      pos: { q: 0, r: 0 },
      team: "enemy",
      defId: "enemy.goblin_skirmisher",
      stats: { maxHp: 10, armor: 10, move: 3, might: 5, agility: 0, spirit: 0 },
    });
    const target = makeUnit({
      instanceId: "t1",
      pos: { q: 1, r: 0 },
      team: "hero",
      hp: 20,
      equippedItemIds: { weapon: null, armor: "item.ward_stitched_vest", trinket: null },
      stats: { maxHp: 20, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    const state = makeCombatState([attacker, target]);

    resolveAction(ACTION_REGISTRY["action.slash"], attacker, target, state, rng);
    expect(state.log.some((e) => e.text.includes("Ward-Stitched Vest"))).toBe(true);
    expect(target.hp).toBeGreaterThan(10);
  });

  it("Hearthstone Charm applies Guarded at combat start", () => {
    const unit = makeUnit({
      instanceId: "u1",
      pos: { q: 0, r: 0 },
      equippedItemIds: { weapon: null, armor: null, trinket: "item.hearthstone_charm" },
    });
    const state = makeCombatState([unit]);

    resolveOncePerCombatBonus(unit, "combatStart", state);
    expect(unit.conditions.some((c) => c.id === "guarded")).toBe(true);

    const rng = createRng(42);
    const attacker = makeUnit({
      instanceId: "a1",
      pos: { q: 1, r: 0 },
      team: "enemy",
      defId: "enemy.goblin_skirmisher",
      stats: { maxHp: 10, armor: 10, move: 3, might: 5, agility: 0, spirit: 0 },
    });

    const beforeHp = unit.hp;
    resolveAction(ACTION_REGISTRY["action.slash"], attacker, unit, state, rng);
    const dealt = beforeHp - unit.hp;

    const fullDamage = beforeHp - unit.stats.maxHp + 18;
    expect(dealt).toBeLessThan(fullDamage);
    expect(state.log.some((e) => e.text.includes("Guarded consumed"))).toBe(true);
  });

  it("Quickstep Buckle grants +1 Move on first turn", () => {
    const unit = makeUnit({
      instanceId: "u1",
      pos: { q: 0, r: 0 },
      equippedItemIds: { weapon: null, armor: null, trinket: "item.quickstep_buckle" },
      movePointsRemaining: 3,
    });
    const state = makeCombatState([unit]);
    unit.movePointsRemaining = 3;

    const result = resolveOncePerCombatBonus(unit, "firstTurn", state);
    expect(result.moveBonus).toBe(1);
  });

  it("Lantern Moth Pin adds +2 to first heal", () => {
    const rng = createRng(42);
    const healer = makeUnit({
      instanceId: "h1",
      pos: { q: 0, r: 0 },
      team: "hero",
      defId: "class.acolyte",
      equippedItemIds: { weapon: null, armor: null, trinket: "item.lantern_moth_pin" },
      stats: { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 5 },
    });
    const target = makeUnit({
      instanceId: "t1",
      pos: { q: 1, r: 0 },
      team: "hero",
      hp: 10,
      stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    const state = makeCombatState([healer, target]);

    const beforeHp = target.hp;
    resolveAction(ACTION_REGISTRY["action.mend_wounds"], healer, target, state, rng);
    const healed = target.hp - beforeHp;

    expect(state.log.some((e) => e.text.includes("Lantern Moth Pin"))).toBe(true);
    expect(healed).toBeGreaterThanOrEqual(6);
  });
});

describe("Item description", () => {
  it("describes items with flavor text", () => {
    const def = ITEM_REGISTRY["item.runemark_blade"];
    expect(def?.flavorText).toBeTruthy();
  });

  it("hook items have proper hook definitions", () => {
    const items = ["item.runemark_blade", "item.emberglass_wand", "item.ward_stitched_vest",
      "item.hearthstone_charm", "item.quickstep_buckle", "item.lantern_moth_pin"];
    for (const id of items) {
      const def = ITEM_REGISTRY[id];
      expect(def?.hook).toBeDefined();
    }
  });

  it("items without hooks have no hook field", () => {
    const def = ITEM_REGISTRY["item.moonwell_robe"];
    expect(def?.hook).toBeUndefined();
  });
});
