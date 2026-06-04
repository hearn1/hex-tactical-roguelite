import { describe, it, expect } from "vitest";
import {
  ADVENTURE_MODIFIER_REGISTRY,
  ADVENTURE_MODIFIER_IDS,
  generateModifierOffers,
  applyAdventureModifier,
} from "./adventureModifiers.ts";
import type { RunModifier } from "../state/types.ts";

describe("ADVENTURE_MODIFIER_REGISTRY", () => {
  it("contains exactly 5 modifiers", () => {
    expect(ADVENTURE_MODIFIER_IDS.length).toBe(5);
  });

  it("each modifier has valid structure", () => {
    for (const id of ADVENTURE_MODIFIER_IDS) {
      const def = ADVENTURE_MODIFIER_REGISTRY[id];
      expect(def.id).toBe(id);
      expect(typeof def.displayName).toBe("string");
      expect(def.displayName.length).toBeGreaterThan(0);
      expect(typeof def.bonusDescription).toBe("string");
      expect(def.bonusDescription.length).toBeGreaterThan(0);
      expect(typeof def.drawbackDescription).toBe("string");
      expect(def.drawbackDescription.length).toBeGreaterThan(0);
      expect(Array.isArray(def.runModifiers)).toBe(true);
      expect(def.runModifiers.length).toBeGreaterThan(0);
    }
  });

  it("lean_purse: -10 gold, gold multiplier 1.25", () => {
    const def = ADVENTURE_MODIFIER_REGISTRY["modifier.lean_purse"];
    expect(def.startingGoldDelta).toBe(-10);
    expect(def.runModifiers).toEqual([{ kind: "gold_multiplier", value: 1.25 }]);
  });

  it("dangerous_roads: 4 run modifiers for XP, gold, HP, damage", () => {
    const def = ADVENTURE_MODIFIER_REGISTRY["modifier.dangerous_roads"];
    expect(def.runModifiers.length).toBe(4);
    expect(def.runModifiers).toContainEqual({ kind: "reward_xp_multiplier", value: 1.15 });
    expect(def.runModifiers).toContainEqual({ kind: "gold_multiplier", value: 1.15 });
    expect(def.runModifiers).toContainEqual({ kind: "enemy_hp_multiplier", value: 1.1 });
    expect(def.runModifiers).toContainEqual({ kind: "enemy_damage_bonus", value: 1 });
  });

  it("generous_patron: +8 gold, 1 potion, gold multiplier 0.9", () => {
    const def = ADVENTURE_MODIFIER_REGISTRY["modifier.generous_patron"];
    expect(def.startingGoldDelta).toBe(8);
    expect(def.startingPotionId).toBe("potion.healing");
    expect(def.runModifiers).toEqual([{ kind: "gold_multiplier", value: 0.9 }]);
  });

  it("cursed_shrines: +2 DC, event reward multiplier 1.25", () => {
    const def = ADVENTURE_MODIFIER_REGISTRY["modifier.cursed_shrines"];
    expect(def.runModifiers.length).toBe(2);
    expect(def.runModifiers).toContainEqual({ kind: "event_dc_bonus", value: 2 });
    expect(def.runModifiers).toContainEqual({ kind: "event_reward_multiplier", value: 1.25 });
  });

  it("elite_contracts: elite reward 1.3x, enemy HP 1.15x", () => {
    const def = ADVENTURE_MODIFIER_REGISTRY["modifier.elite_contracts"];
    expect(def.runModifiers.length).toBe(2);
    expect(def.runModifiers).toContainEqual({ kind: "elite_reward_multiplier", value: 1.3 });
    expect(def.runModifiers).toContainEqual({ kind: "enemy_hp_multiplier", value: 1.15 });
  });
});

describe("generateModifierOffers", () => {
  it("returns exactly `count` unique offers", () => {
    const offers = generateModifierOffers(12345, 3);
    expect(offers.length).toBe(3);
    expect(new Set(offers).size).toBe(3);
  });

  it("is deterministic from the seed", () => {
    const a = generateModifierOffers(42, 3);
    const b = generateModifierOffers(42, 3);
    expect(a).toEqual(b);
  });

  it("different seeds can produce different offers", () => {
    const a = generateModifierOffers(1, 3);
    const b = generateModifierOffers(999999, 3);
    if (a.length === b.length) {
      // At least one different index or element
      const different = a.some((id, i) => id !== b[i]);
      expect(different).toBe(true);
    }
  });

  it("returns empty array when count is 0", () => {
    expect(generateModifierOffers(999, 0)).toEqual([]);
  });

  it("all returned IDs exist in the registry", () => {
    const offers = generateModifierOffers(54321, 3);
    for (const id of offers) {
      expect(ADVENTURE_MODIFIER_REGISTRY[id]).toBeDefined();
    }
  });

  it("returns fewer than `count` when pool is smaller", () => {
    const offers = generateModifierOffers(77777, 10);
    expect(offers.length).toBe(ADVENTURE_MODIFIER_IDS.length);
    expect(new Set(offers).size).toBe(ADVENTURE_MODIFIER_IDS.length);
  });
});

describe("applyAdventureModifier", () => {
  it("adds the modifier's runModifiers to the run", () => {
    const run = { runModifiers: [] as RunModifier[] };
    applyAdventureModifier(run, "modifier.dangerous_roads");
    expect(run.runModifiers.length).toBe(4);
    expect(run.runModifiers).toContainEqual({ kind: "reward_xp_multiplier", value: 1.15 });
    expect(run.runModifiers).toContainEqual({ kind: "enemy_damage_bonus", value: 1 });
  });

  it("does nothing for an unknown modifier ID", () => {
    const run = { runModifiers: [] as RunModifier[] };
    applyAdventureModifier(run, "modifier.nonexistent");
    expect(run.runModifiers).toEqual([]);
  });

  it("appends to existing runModifiers list", () => {
    const existing: RunModifier = { kind: "gold_multiplier", value: 2 };
    const run = { runModifiers: [existing] };
    applyAdventureModifier(run, "modifier.lean_purse");
    expect(run.runModifiers.length).toBe(2);
    expect(run.runModifiers[0]).toEqual(existing);
    expect(run.runModifiers[1]).toEqual({ kind: "gold_multiplier", value: 1.25 });
  });
});
