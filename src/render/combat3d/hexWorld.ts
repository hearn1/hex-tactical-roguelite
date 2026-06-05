import type { Hex } from "../../state/types.ts";

export const HEX_WORLD_RADIUS = 1;
const SQRT_3 = Math.sqrt(3);

export interface WorldPoint {
  x: number;
  z: number;
}

export function axialToWorld(hex: Hex, radius: number = HEX_WORLD_RADIUS): WorldPoint {
  return {
    x: radius * (SQRT_3 * hex.q + (SQRT_3 / 2) * hex.r),
    z: radius * ((3 / 2) * hex.r),
  };
}

export function worldToAxial(point: WorldPoint, radius: number = HEX_WORLD_RADIUS): Hex {
  const q = ((SQRT_3 / 3) * point.x - (1 / 3) * point.z) / radius;
  const r = ((2 / 3) * point.z) / radius;
  return cubeRound(q, r);
}

export function hexCornerWorld(hex: Hex, cornerIndex: number, radius: number = HEX_WORLD_RADIUS): WorldPoint {
  const center = axialToWorld(hex, radius);
  const angle = (Math.PI / 180) * (60 * cornerIndex - 30);
  return {
    x: center.x + Math.cos(angle) * radius,
    z: center.z + Math.sin(angle) * radius,
  };
}

function cubeRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}
