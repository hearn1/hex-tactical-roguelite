import { describe, it, expect } from "vitest";
import { BACKGROUND_REGISTRY, getBackground, describeBackgroundEffect } from "./backgrounds.ts";

describe("BACKGROUND_REGISTRY", () => {
  it("contains the maintainer-confirmed set of 5 backgrounds", () => {
    expect(Object.keys(BACKGROUND_REGISTRY)).toHaveLength(5);
  });

  it("keys all of its entries by their own id and gives each a composite package", () => {
    const perkTypes = new Set<string>();

    for (const [key, def] of Object.entries(BACKGROUND_REGISTRY)) {
      expect(def.id).toBe(key);
      expect(def.displayName.length).toBeGreaterThan(0);
      expect(def.flavor.length).toBeGreaterThan(0);
      expect(def.statBonus.amount).toBe(1);
      expect(def.startingItemId ?? def.startingPotionId).toBeTruthy();
      perkTypes.add(def.perk.type);
    }

    expect(perkTypes).toEqual(new Set([
      "startCombatGuarded",
      "xpMultiplier",
      "revealNodes",
      "bonusGold",
      "shopDiscount",
    ]));
  });

  it("getBackground returns the matching def or undefined", () => {
    expect(getBackground("background.cutpurse")?.statBonus).toEqual({
      stat: "dex",
      amount: 1,
    });
    expect(getBackground("background.cutpurse")?.perk).toEqual({ type: "bonusGold", amount: 10 });
    expect(getBackground("background.nope")).toBeUndefined();
  });
});

describe("describeBackgroundEffect", () => {
  it("summarizes stat, starter, and perk for a guarded background", () => {
    expect(describeBackgroundEffect(BACKGROUND_REGISTRY["background.caravan_guard"])).toBe(
      "Stat: +1 Strength | Item: 1x Healing Potion | Perk: Start each combat Guarded",
    );
  });

  it("summarizes armor and shop discount", () => {
    expect(describeBackgroundEffect(BACKGROUND_REGISTRY["background.merchants_heir"])).toBe(
      "Stat: +1 Armor | Item: Lucky Charm | Perk: 10% shop discount",
    );
  });

  it("summarizes reveal and XP perk copy", () => {
    expect(describeBackgroundEffect(BACKGROUND_REGISTRY["background.hedge_scholar"])).toContain(
      "Perk: Reveal 2 upcoming nodes",
    );
    expect(describeBackgroundEffect(BACKGROUND_REGISTRY["background.field_medic"])).toContain(
      "Perk: +10% XP gains",
    );
  });
});
