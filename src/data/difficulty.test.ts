import { describe, it, expect } from "vitest";
import { DIFFICULTY_CONFIG, scaleStat } from "./difficulty.ts";

describe("Difficulty", () => {
  it("normal config has identity multipliers", () => {
    const config = DIFFICULTY_CONFIG.normal;
    expect(config.enemyHpMultiplier).toBe(1.0);
    expect(config.enemyDamageBonus).toBe(0);
    expect(config.rewardGoldMultiplier).toBe(1.0);
    expect(config.rewardXpMultiplier).toBe(1.0);
  });

  it("hard config has correct multipliers", () => {
    const config = DIFFICULTY_CONFIG.hard;
    expect(config.enemyHpMultiplier).toBe(1.2);
    expect(config.enemyDamageBonus).toBe(1);
    expect(config.rewardGoldMultiplier).toBe(1.2);
    expect(config.rewardXpMultiplier).toBe(1.2);
  });

  it("scaleStat applies multiplier rounding up", () => {
    expect(scaleStat(8, 1.2)).toBe(10);
    expect(scaleStat(10, 1.2)).toBe(12);
    expect(scaleStat(16, 1.2)).toBe(20);
    expect(scaleStat(42, 1.2)).toBe(51);
  });

  it("scaleStat with 1.0 multiplier returns same value", () => {
    expect(scaleStat(8, 1.0)).toBe(8);
    expect(scaleStat(16, 1.0)).toBe(16);
  });
});
