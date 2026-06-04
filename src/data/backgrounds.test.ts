import { describe, it, expect } from "vitest";
import { BACKGROUND_REGISTRY, getBackground, describeBackgroundEffect } from "./backgrounds.ts";

describe("BACKGROUND_REGISTRY", () => {
  it("contains the maintainer-confirmed set of 5 backgrounds", () => {
    expect(Object.keys(BACKGROUND_REGISTRY)).toHaveLength(5);
  });

  it("keys all of its entries by their own id", () => {
    for (const [key, def] of Object.entries(BACKGROUND_REGISTRY)) {
      expect(def.id).toBe(key);
      expect(def.displayName.length).toBeGreaterThan(0);
      expect(def.flavor.length).toBeGreaterThan(0);
    }
  });

  it("getBackground returns the matching def or undefined", () => {
    expect(getBackground("background.cutpurse")?.effect).toEqual({
      type: "statBonus",
      stat: "agility",
      amount: 1,
    });
    expect(getBackground("background.nope")).toBeUndefined();
  });
});

describe("describeBackgroundEffect", () => {
  it("summarizes a stat-bonus background", () => {
    expect(describeBackgroundEffect(BACKGROUND_REGISTRY["background.caravan_guard"])).toBe(
      "+1 Might (checks)",
    );
  });

  it("summarizes a gold background", () => {
    expect(describeBackgroundEffect(BACKGROUND_REGISTRY["background.merchants_heir"])).toBe(
      "+10 starting gold",
    );
  });

  it("summarizes a potion background with the potion's display name", () => {
    expect(describeBackgroundEffect(BACKGROUND_REGISTRY["background.field_medic"])).toBe(
      "Start with 1× Healing Potion",
    );
  });
});
