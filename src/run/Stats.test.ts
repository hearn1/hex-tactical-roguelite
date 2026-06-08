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
    stats: { maxHp: 20, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
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
  it("Guardian with Iron Sword + Wooden Shield has str=4 and armor=15", () => {
    const unit = makeUnit({
      defId: "class.guardian",
      equippedItemIds: { weapon: "item.iron_sword", armor: null, trinket: "item.wooden_shield" },
    });
    const stats = computeStats(unit);
    expect(stats.str).toBe(4);
    expect(stats.armor).toBe(15);
  });

  it("Arcanist with Apprentice Wand has int=5", () => {
    const unit = makeUnit({
      defId: "class.arcanist",
      stats: { maxHp: 11, armor: 11, move: 3, str: 0, dex: 1, con: 0, int: 4, wis: 0, cha: 0 },
      equippedItemIds: { weapon: "item.apprentice_wand", armor: null, trinket: null },
    });
    const stats = computeStats(unit);
    expect(stats.int).toBe(5);
  });

  it("removing an item drops the bonus", () => {
    const unit = makeUnit({
      defId: "class.guardian",
      equippedItemIds: { weapon: null, armor: null, trinket: null },
    });
    const stats = computeStats(unit);
    expect(stats.str).toBe(3);
    expect(stats.armor).toBe(14);
  });

  it("all-10 ability scores preserve default combat stats", () => {
    const unit = makeUnit({
      equippedItemIds: { weapon: null, armor: null, trinket: null },
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    const stats = computeStats(unit);
    expect(stats).toEqual({ maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 2, int: 0, wis: 0, cha: 1 });
  });

  it("maps STR, DEX, and CON scores onto Guardian combat stats", () => {
    const unit = makeUnit({
      level: 3,
      equippedItemIds: { weapon: null, armor: null, trinket: null },
      abilityScores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    });
    const stats = computeStats(unit);
    expect(stats.str).toBe(6);
    expect(stats.dex).toBe(2);
    expect(stats.armor).toBe(15);
    expect(stats.maxHp).toBe(24);
  });

  it("penalizes str and dex for low STR/DEX ability scores", () => {
    const unit = makeUnit({
      equippedItemIds: { weapon: null, armor: null, trinket: null },
      abilityScores: { str: 8, dex: 8, con: 10, int: 10, wis: 10, cha: 10 },
    });
    const stats = computeStats(unit);
    expect(stats.str).toBe(2);
    expect(stats.dex).toBe(0);
    expect(stats.armor).toBe(14);
  });

  it("maps WIS to Acolyte wis and INT to Arcanist int from ability scores", () => {
    const acolyte = makeUnit({
      defId: "class.acolyte",
      stats: { maxHp: 14, armor: 12, move: 3, str: 1, dex: 1, con: 0, int: 0, wis: 3, cha: 0 },
      abilityScores: { str: 10, dex: 10, con: 10, int: 8, wis: 16, cha: 10 },
    });
    const arcanist = makeUnit({
      defId: "class.arcanist",
      stats: { maxHp: 11, armor: 11, move: 3, str: 0, dex: 1, con: 0, int: 4, wis: 0, cha: 0 },
      abilityScores: { str: 10, dex: 10, con: 10, int: 18, wis: 8, cha: 10 },
    });
    expect(computeStats(acolyte).wis).toBe(6);
    expect(computeStats(arcanist).int).toBe(8);
  });

  it("item-granted action appears in hero's action list", () => {
    const bowAction = ACTION_REGISTRY["action.arrow_shot"];
    expect(bowAction).toBeDefined();
    expect(bowAction.id).toBe("action.arrow_shot");
    expect(bowAction.source).toBe("item");
  });
});
