export interface MetaProgressionState {
  renown: number;
  upgradeRanks: Record<string, number>;
  completedRuns: number;
  bossWins: number;
}

export function createDefaultMetaProgression(): MetaProgressionState {
  return {
    renown: 0,
    upgradeRanks: {},
    completedRuns: 0,
    bossWins: 0,
  };
}
