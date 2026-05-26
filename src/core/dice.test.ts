import { describe, it, expect } from "vitest";
import { roll } from "./dice.ts";
import { createRng } from "./rng.ts";

describe("roll", () => {
  it('roll("1d6+3") returns total in [4, 9] and rolls of length 1', () => {
    const rng = createRng(42);
    const result = roll("1d6+3", rng);
    expect(result.total).toBeGreaterThanOrEqual(4);
    expect(result.total).toBeLessThanOrEqual(9);
    expect(result.rolls).toHaveLength(1);
  });

  it('roll("2d4") returns total in [2, 8] and rolls of length 2', () => {
    const rng = createRng(42);
    const result = roll("2d4", rng);
    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.total).toBeLessThanOrEqual(8);
    expect(result.rolls).toHaveLength(2);
  });

  it("same seed produces same total", () => {
    const rng1 = createRng(99);
    const rng2 = createRng(99);
    expect(roll("2d6+2", rng1).total).toEqual(roll("2d6+2", rng2).total);
  });
});
