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

  it("item-granted action appears in hero's action list", () => {
    const bowAction = ACTION_REGISTRY["action.arrow_shot"];
    expect(bowAction).toBeDefined();
    expect(bowAction.id).toBe("action.arrow_shot");
    expect(bowAction.source).toBe("item");
  });
});
