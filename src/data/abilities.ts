export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export type AbilityKey = (typeof ABILITY_KEYS)[number];

export type AbilityScores = Record<AbilityKey, number>;

export interface AbilityRoll {
  dice: number[];
  dropped: number;
  total: number;
}

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

export const ABILITY_FULL_LABELS: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export const DEFAULT_ABILITY_SCORES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

export function createDefaultAbilityScores(): AbilityScores {
  return { ...DEFAULT_ABILITY_SCORES };
}

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function rollAbilityScore(rng: () => number): AbilityRoll {
  const dice = Array.from({ length: 4 }, () => Math.floor(rng() * 6) + 1);
  const sorted = [...dice].sort((a, b) => a - b);
  return {
    dice,
    dropped: sorted[0],
    total: sorted.slice(1).reduce((sum, die) => sum + die, 0),
  };
}

export function rollAbilityScores(rng: () => number): AbilityRoll[] {
  return Array.from({ length: ABILITY_KEYS.length }, () => rollAbilityScore(rng));
}

export function isCompleteAbilityScores(scores: Partial<AbilityScores> | undefined): scores is AbilityScores {
  if (!scores) return false;
  return ABILITY_KEYS.every((key) => Number.isInteger(scores[key]));
}
