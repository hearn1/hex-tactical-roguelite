import { describe, it, expect } from "vitest";
import { reachableHexes } from "./Movement.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";

function makeGrid(radius: number): Set<string> {
  return new Set(hexesWithinRange({ q: 0, r: 0 }, radius).map(hexKey));
}

describe("Movement", () => {
  const gridR3 = makeGrid(3);

  it("center with 2 move on radius-3 grid reaches 19 hexes (radius-2 disk)", () => {
    const occupied = new Set<string>();
    const result = reachableHexes({ q: 0, r: 0 }, 2, occupied, gridR3);
    expect(result.size).toBe(19);
  });

  it("center with 3 move on radius-3 grid reaches all 37 hexes", () => {
    const occupied = new Set<string>();
    const result = reachableHexes({ q: 0, r: 0 }, 3, occupied, gridR3);
    expect(result.size).toBe(37);
  });

  it("occupied hexes are excluded from reachable destinations", () => {
    const occupied = new Set([hexKey({ q: 1, r: -1 })]);
    const result = reachableHexes({ q: 0, r: 0 }, 1, occupied, gridR3);
    expect(result.has(hexKey({ q: 1, r: -1 }))).toBe(false);
    expect(result.has(hexKey({ q: 1, r: 0 }))).toBe(true);
  });

  it("occupied hex blocks movement through it", () => {
    const occupied = new Set([hexKey({ q: 1, r: -1 })]);
    const result = reachableHexes({ q: 0, r: 0 }, 2, occupied, gridR3);
    expect(result.has(hexKey({ q: 2, r: -2 }))).toBe(false);
    expect(result.has(hexKey({ q: 1, r: 0 }))).toBe(true);
  });

  it("0 move points reaches empty set", () => {
    const occupied = new Set<string>();
    const result = reachableHexes({ q: 0, r: 0 }, 0, occupied, gridR3);
    expect(result.size).toBe(0);
  });
});
