import type { Difficulty } from "../state/RunState.ts";

export interface DifficultyModifiers {
  enemyHpMultiplier: number;
  enemyCountBonus: number;
  startingGoldMultiplier: number;
  rewardGoldMultiplier: number;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyModifiers> = {
  normal: {
    enemyHpMultiplier: 1.0,
    enemyCountBonus: 0,
    startingGoldMultiplier: 1.0,
    rewardGoldMultiplier: 1.0,
  },
  hard: {
    enemyHpMultiplier: 1.25,
    enemyCountBonus: 1,
    startingGoldMultiplier: 0.5,
    rewardGoldMultiplier: 0.75,
  },
};

export function scaleStat(value: number, multiplier: number): number {
  return Math.ceil(value * multiplier);
}
