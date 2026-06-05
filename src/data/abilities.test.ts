import { describe, it, expect } from "vitest";
import {
  abilityMod,
  createDefaultAbilityScores,
  isCompleteAbilityScores,
  rollAbilityScore,
  rollAbilityScores,
} from "./abilities.ts";

function sequenceRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? 0;
}

describe("abilityMod", () => {
  it("uses floor((score - 10) / 2)", () => {
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(9)).toBe(-1);
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(11)).toBe(0);
    expect(abilityMod(12)).toBe(1);
    expect(abilityMod(18)).toBe(4);
  });
});

describe("rollAbilityScore", () => {
  it("rolls 4d6 and drops the lowest die", () => {
    const roll = rollAbilityScore(sequenceRng([0, 0.16, 0.5, 0.99]));
    expect(roll.dice).toEqual([1, 1, 4, 6]);
    expect(roll.dropped).toBe(1);
    expect(roll.total).toBe(11);
  });

  it("rolls six deterministic ability scores", () => {
    const rng = sequenceRng([
      0, 0.2, 0.4, 0.6,
      0.8, 0.99, 0.1, 0.3,
      0.5, 0.7, 0.9, 0.15,
      0.25, 0.35, 0.45, 0.55,
      0.65, 0.75, 0.85, 0.95,
      0.05, 0.05, 0.05, 0.05,
    ]);
    const rolls = rollAbilityScores(rng);
    expect(rolls).toHaveLength(6);
    expect(rolls.map((r) => r.total)).toEqual([9, 13, 15, 10, 17, 3]);
    expect(rolls.every((r) => r.total >= 3 && r.total <= 18)).toBe(true);
  });
});

describe("ability score defaults and validation", () => {
  it("creates all-10 default scores", () => {
    expect(createDefaultAbilityScores()).toEqual({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  });

  it("requires all six scores to be assigned", () => {
    expect(isCompleteAbilityScores({ str: 12, dex: 12, con: 12, int: 12, wis: 12 })).toBe(false);
    expect(isCompleteAbilityScores(createDefaultAbilityScores())).toBe(true);
  });
});
