import { describe, expect, it } from "vitest";
import { hexKey } from "../../core/hex.ts";
import { axialToWorld, hexCornerWorld, worldToAxial } from "./hexWorld.ts";

describe("combat3d hex world mapping", () => {
  it("round-trips axial centers through world coordinates", () => {
    const hexes = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: -2, r: 1 },
      { q: 3, r: -2 },
      { q: -3, r: 3 },
    ];

    for (const hex of hexes) {
      expect(hexKey(worldToAxial(axialToWorld(hex)))).toBe(hexKey(hex));
    }
  });

  it("keeps near-edge picks on the intended side of a seam", () => {
    const origin = axialToWorld({ q: 0, r: 0 });
    const neighbor = axialToWorld({ q: 1, r: 0 });
    const midX = (origin.x + neighbor.x) / 2;
    const midZ = (origin.z + neighbor.z) / 2;

    expect(worldToAxial({ x: midX - 0.01, z: midZ })).toEqual({ q: 0, r: 0 });
    expect(worldToAxial({ x: midX + 0.01, z: midZ })).toEqual({ q: 1, r: 0 });
  });

  it("uses flat-top hex corners with consistent radius", () => {
    const center = axialToWorld({ q: 0, r: 0 });
    const corner = hexCornerWorld({ q: 0, r: 0 }, 0);
    const dist = Math.hypot(corner.x - center.x, corner.z - center.z);

    expect(dist).toBeCloseTo(1, 5);
  });
});
