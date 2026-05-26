import { describe, it, expect } from "vitest";
import { levelForXp, nextThresholdXp, applyXp, MAX_LEVEL, XP_THRESHOLDS } from "./Leveling.ts";
import type { UnitInstance } from "../state/types.ts";

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "test",
    defId: "class.guardian",
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    hp: 18,
    pos: { q: 0, r: 0 },
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

describe("levelForXp", () => {
  it("levelForXp(0) === 1", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("levelForXp(19) === 1", () => {
    expect(levelForXp(19)).toBe(1);
  });

  it("levelForXp(20) === 2", () => {
    expect(levelForXp(20)).toBe(2);
  });

  it("levelForXp(140) === 5", () => {
    expect(levelForXp(140)).toBe(5);
  });

  it("levelForXp(999) === 5", () => {
    expect(levelForXp(999)).toBe(5);
  });
});

describe("nextThresholdXp", () => {
  it("level 1 returns 20", () => {
    expect(nextThresholdXp(1)).toBe(20);
  });

  it("level 5 returns null", () => {
    expect(nextThresholdXp(5)).toBeNull();
  });
});

describe("applyXp", () => {
  it("Guardian crossing 19 -> 20 gains maxHp=2, might=1", () => {
    const unit = makeUnit({
      defId: "class.guardian",
      xp: 19,
      level: 1,
      stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
      hp: 10,
    });
    const result = applyXp(unit, 1);
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(result.gains.maxHp).toBe(2);
    expect(result.gains.might).toBe(1);
  });

  it("applyXp on level-1 Arcanist with 200 XP reaches level 5", () => {
    const unit = makeUnit({
      defId: "class.arcanist",
      xp: 0,
      level: 1,
      stats: { maxHp: 11, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 },
      hp: 11,
    });
    const result = applyXp(unit, 200);
    expect(result.leveledUp).toBe(true);
    expect(unit.level).toBe(5);
    expect(result.gains.maxHp).toBe(4);
    expect(result.gains.spirit).toBe(4);
  });

  it("current HP increases by maxHp delta, not refilled", () => {
    const unit = makeUnit({
      defId: "class.guardian",
      xp: 19,
      level: 1,
      stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
      hp: 10,
    });
    applyXp(unit, 1);
    expect(unit.hp).toBe(12);
    expect(unit.stats.maxHp).toBe(20);
  });
});
