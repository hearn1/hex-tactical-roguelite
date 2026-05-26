import { describe, it, expect } from "vitest";
import { distance, neighbors, hexesWithinRange, hexToPixel, pixelToHex, hexEquals } from "./hex.ts";

describe("hex", () => {
  it("distance from self is 0", () => {
    expect(distance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
  });

  it("distance is symmetric", () => {
    const a = { q: 2, r: -1 };
    const b = { q: -1, r: 3 };
    expect(distance(a, b)).toBe(distance(b, a));
    expect(distance(a, b)).toBe(4);
  });

  it("neighbors of origin are 6 and all distance 1", () => {
    const ns = neighbors({ q: 0, r: 0 });
    expect(ns).toHaveLength(6);
    for (const n of ns) {
      expect(distance({ q: 0, r: 0 }, n)).toBe(1);
    }
  });

  it("hexesWithinRange radius 0 => 1, radius 1 => 7, radius 2 => 19, radius 3 => 37", () => {
    expect(hexesWithinRange({ q: 0, r: 0 }, 0)).toHaveLength(1);
    expect(hexesWithinRange({ q: 0, r: 0 }, 1)).toHaveLength(7);
    expect(hexesWithinRange({ q: 0, r: 0 }, 2)).toHaveLength(19);
    expect(hexesWithinRange({ q: 0, r: 0 }, 3)).toHaveLength(37);
  });

  it("pixelToHex round-trips", () => {
    const orig = { q: 2, r: -1 };
    const pixel = hexToPixel(orig);
    const round = pixelToHex(pixel.x, pixel.y);
    expect(hexEquals(round, orig)).toBe(true);
  });
});
