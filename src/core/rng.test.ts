import { describe, it, expect } from "vitest";
import { createRng } from "./rng.ts";

describe("createRng", () => {
  it("produces deterministic values for the same seed", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);

    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it("produces different sequences for different seeds", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(99);

    const val1 = rng1();
    const val2 = rng2();

    expect(val1).not.toEqual(val2);
  });

  it("returns values between 0 (inclusive) and 1 (exclusive)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});
