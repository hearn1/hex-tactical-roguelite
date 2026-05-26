export const HEX_SIZE = 36;

export const GRID_ORIGIN = { x: 280, y: 220 };

export const AXIAL_DIRS = [
  { q: +1, r: 0 },
  { q: +1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: +1 },
  { q: 0, r: +1 },
];

export function hexEquals(a: { q: number; r: number }, b: { q: number; r: number }): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexKey(h: { q: number; r: number }): string {
  return `${h.q},${h.r}`;
}

export function parseHexKey(key: string): { q: number; r: number } {
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

export function neighbors(h: { q: number; r: number }): { q: number; r: number }[] {
  return AXIAL_DIRS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

export function distance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function hexesWithinRange(center: { q: number; r: number }, radius: number): { q: number; r: number }[] {
  const results: { q: number; r: number }[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q) + Math.abs(r) + Math.abs(-q - r) <= radius * 2) {
        results.push({ q: center.q + q, r: center.r + r });
      }
    }
  }
  return results;
}

export function hexToPixel(h: { q: number; r: number }): { x: number; y: number } {
  const x = HEX_SIZE * (Math.sqrt(3) * h.q + (Math.sqrt(3) / 2) * h.r);
  const y = HEX_SIZE * ((3 / 2) * h.r);
  return { x: x + GRID_ORIGIN.x, y: y + GRID_ORIGIN.y };
}

export function pixelToHex(px: number, py: number): { q: number; r: number } {
  const cx = px - GRID_ORIGIN.x;
  const cy = py - GRID_ORIGIN.y;
  const q = ((Math.sqrt(3) / 3) * cx - (1 / 3) * cy) / HEX_SIZE;
  const r = ((2 / 3) * cy) / HEX_SIZE;
  return cubeRound(q, r);
}

function cubeRound(q: number, r: number): { q: number; r: number } {
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
