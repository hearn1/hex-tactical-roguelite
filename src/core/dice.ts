export function roll(spec: string, rng: () => number): { total: number; rolls: number[] } {
  const cleaned = spec.replace(/\s/g, "");
  const match = cleaned.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!match) throw new Error(`Invalid dice spec: ${spec}`);
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const mod = match[3] ? parseInt(match[3], 10) : 0;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(rng() * sides) + 1);
  }
  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  return { total, rolls };
}
