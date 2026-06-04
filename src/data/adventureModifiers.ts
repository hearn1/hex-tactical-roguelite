import type { RunModifier } from "../state/types.ts";

export interface AdventureModifierDef {
  id: string;
  displayName: string;
  bonusDescription: string;
  drawbackDescription: string;
  runModifiers: RunModifier[];
  /** Gold delta applied at run start (can be negative). */
  startingGoldDelta?: number;
  /** Potion id to add to inventory at run start. */
  startingPotionId?: string;
}

export const ADVENTURE_MODIFIER_REGISTRY: Record<string, AdventureModifierDef> = {
  "modifier.lean_purse": {
    id: "modifier.lean_purse",
    displayName: "Lean Purse",
    bonusDescription: "Combat gold rewards +25%",
    drawbackDescription: "Start with -10 gold (minimum 0)",
    runModifiers: [
      { kind: "gold_multiplier", value: 1.25 },
    ],
    startingGoldDelta: -10,
  },
  "modifier.dangerous_roads": {
    id: "modifier.dangerous_roads",
    displayName: "Dangerous Roads",
    bonusDescription: "Combat XP and gold rewards +15%",
    drawbackDescription: "Enemies gain +10% max HP and +1 damage",
    runModifiers: [
      { kind: "reward_xp_multiplier", value: 1.15 },
      { kind: "gold_multiplier", value: 1.15 },
      { kind: "enemy_hp_multiplier", value: 1.1 },
      { kind: "enemy_damage_bonus", value: 1 },
    ],
  },
  "modifier.generous_patron": {
    id: "modifier.generous_patron",
    displayName: "Generous Patron",
    bonusDescription: "Start with +8 gold and 1 Healing Potion",
    drawbackDescription: "Combat gold rewards -10%",
    runModifiers: [
      { kind: "gold_multiplier", value: 0.9 },
    ],
    startingGoldDelta: 8,
    startingPotionId: "potion.healing",
  },
  "modifier.cursed_shrines": {
    id: "modifier.cursed_shrines",
    displayName: "Cursed Shrines",
    bonusDescription: "Event rewards +25% where numeric",
    drawbackDescription: "Event/check DCs +2",
    runModifiers: [
      { kind: "event_dc_bonus", value: 2 },
      { kind: "event_reward_multiplier", value: 1.25 },
    ],
  },
  "modifier.elite_contracts": {
    id: "modifier.elite_contracts",
    displayName: "Elite Contracts",
    bonusDescription: "Elite rewards +30%",
    drawbackDescription: "Elite enemies gain +15% max HP",
    runModifiers: [
      { kind: "elite_reward_multiplier", value: 1.3 },
      { kind: "enemy_hp_multiplier", value: 1.15 },
    ],
  },
};

export const ADVENTURE_MODIFIER_IDS = Object.keys(ADVENTURE_MODIFIER_REGISTRY);

/**
 * Generate `count` unique modifier offers deterministically from a seed.
 * Uses its own RNG to stay independent of the global game stream.
 */
export function generateModifierOffers(seed: number, count: number): string[] {
  let s = (seed ^ 0xabcdef) >>> 0;
  const rng = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const pool = [...ADVENTURE_MODIFIER_IDS];
  const offers: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    offers.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return offers;
}

/**
 * Push a modifier's effects onto `run.runModifiers`.
 * Starting gold/potion effects must be applied separately.
 */
export function applyAdventureModifier(run: { runModifiers: RunModifier[] }, modifierId: string): void {
  const def = ADVENTURE_MODIFIER_REGISTRY[modifierId];
  if (!def) return;
  for (const mod of def.runModifiers) {
    run.runModifiers.push(mod);
  }
}
