import { describe, it, expect } from "vitest";
import type { UnitInstance } from "../state/types.ts";
import { computeStats } from "../combat/Stats.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "test",
    defId: "class.guardian",
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 20, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    hp: 20,
    pos: { q: 0, r: 0 },
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

describe("resolveStats", () => {
  it("Guardian with Iron Sword + Wooden Shield has might=4 and armor=15", () => {
    const unit = makeUnit({
      defId: "class.guardian",
      equippedItemIds: { weapon: "item.iron_sword", armor: null, trinket: "item.wooden_shield" },
    });
    const stats = computeStats(unit);
    expect(stats.might).toBe(4);
    expect(stats.armor).toBe(15);
  });

  it("Arcanist with Apprentice Wand has spirit=5", () => {
    const unit = makeUnit({
      defId: "class.arcanist",
      stats: { maxHp: 11, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 },
      equippedItemIds: { weapon: "item.apprentice_wand", armor: null, trinket: null },
    });
    const stats = computeStats(unit);
    expect(stats.spirit).toBe(5);
  });

  it("removing an item drops the bonus", () => {
    const unit = makeUnit({
      defId: "class.guardian",
      equippedItemIds: { weapon: null, armor: null, trinket: null },
    });
    const stats = computeStats(unit);
    expect(stats.might).toBe(3);
    expect(stats.armor).toBe(14);
  });

  it("all-10 ability scores preserve default combat stats", () => {
    const unit = makeUnit({
      equippedItemIds: { weapon: null, armor: null, trinket: null },
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    const stats = computeStats(unit);
    expect(stats).toEqual({ maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 });
  });

  it("maps STR, DEX, and CON scores onto Guardian combat stats", () => {
    const unit = makeUnit({
      level: 3,
      equippedItemIds: { weapon: null, armor: null, trinket: null },
      abilityScores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    });
    const stats = computeStats(unit);
    expect(stats.might).toBe(6);
    expect(stats.agility).toBe(2);
    expect(stats.armor).toBe(15);
    expect(stats.maxHp).toBe(24);
  });

  it("does not penalize Might for low STR but does apply low DEX", () => {
    const unit = makeUnit({
      equippedItemIds: { weapon: null, armor: null, trinket: null },
      abilityScores: { str: 8, dex: 8, con: 10, int: 10, wis: 10, cha: 10 },
    });
    const stats = computeStats(unit);
    expect(stats.might).toBe(3);
    expect(stats.agility).toBe(0);
    expect(stats.armor).toBe(14);
  });

  it("maps WIS to Acolyte spirit and INT to Arcanist spirit", () => {
    const acolyte = makeUnit({
      defId: "class.acolyte",
      stats: { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 3 },
      abilityScores: { str: 10, dex: 10, con: 10, int: 8, wis: 16, cha: 10 },
    });
    const arcanist = makeUnit({
      defId: "class.arcanist",
      stats: { maxHp: 11, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 },
      abilityScores: { str: 10, dex: 10, con: 10, int: 18, wis: 8, cha: 10 },
    });
    expect(computeStats(acolyte).spirit).toBe(6);
    expect(computeStats(arcanist).spirit).toBe(8);
  });

  it("item-granted action appears in hero's action list", () => {
    const bowAction = ACTION_REGISTRY["action.arrow_shot"];
    expect(bowAction).toBeDefined();
    expect(bowAction.id).toBe("action.arrow_shot");
    expect(bowAction.source).toBe("item");
  });
});
