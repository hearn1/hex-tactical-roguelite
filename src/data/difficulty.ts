import type { Difficulty } from "../state/RunState.ts";

export interface DifficultyModifiers {
  enemyHpMultiplier: number;
  enemyDamageBonus: number;
  rewardGoldMultiplier: number;
  rewardXpMultiplier: number;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyModifiers> = {
  normal: {
    enemyHpMultiplier: 1.0,
    enemyDamageBonus: 0,
    rewardGoldMultiplier: 1.0,
    rewardXpMultiplier: 1.0,
  },
  hard: {
    enemyHpMultiplier: 1.2,
    enemyDamageBonus: 1,
    rewardGoldMultiplier: 1.2,
    rewardXpMultiplier: 1.2,
  },
};

export function scaleStat(value: number, multiplier: number): number {
  return Math.ceil(value * multiplier);
}
