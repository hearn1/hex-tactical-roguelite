import type { UnitInstance, UnitStats } from "../state/types.ts";
import type { PartyMember } from "../state/RunState.ts";
import { computeStats } from "../combat/Stats.ts";
import { abilityMod } from "../data/abilities.ts";
import { syncHitDiceForPartyMember } from "./Rest.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";

export const XP_THRESHOLDS = [0, 20, 50, 90, 140] as const;
export const MAX_LEVEL = 5;

export function levelForXp(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function nextThresholdXp(level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  return XP_THRESHOLDS[level];
}

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  gains: Partial<UnitStats>;
  /** Each new level number reached by this grant, in order (e.g. 1→3 yields [2, 3]). */
  levelsGained: number[];
  /** Passive/feature IDs auto-granted by featuresGranted entries crossed during this XP award. */
  featuresGranted?: string[];
}

const STAT_KEYS: (keyof UnitStats)[] = ["maxHp", "armor", "move", "str", "dex", "con", "int", "wis", "cha"];

function sumGains(a: Partial<UnitStats>, b: Partial<UnitStats>): Partial<UnitStats> {
  const result: Partial<UnitStats> = {};
  for (const key of STAT_KEYS) {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    if (av !== 0 || bv !== 0) {
      result[key] = av + bv;
    }
  }
  return result;
}

export function applyXp(unit: UnitInstance, xp: number): LevelUpResult {
  const startXp = unit.xp;
  unit.xp += xp;

  const progressionTable = CLASS_REGISTRY[unit.defId]?.progressionTable ?? [];

  let totalGains: Partial<UnitStats> = {};
  let currentLevel = levelForXp(startXp);
  let leveledUp = false;
  const levelsGained: number[] = [];
  const featuresGranted: string[] = [];

  for (let level = currentLevel; level < MAX_LEVEL; level++) {
    if (unit.xp >= XP_THRESHOLDS[level]) {
      leveledUp = true;
      const newLevel = level + 1;
      const entry = progressionTable.find((e) => e.level === newLevel);
      totalGains = sumGains(totalGains, entry?.statGain ?? {});
      if (entry?.featuresGranted) {
        for (const f of entry.featuresGranted) {
          if (!featuresGranted.includes(f)) featuresGranted.push(f);
        }
      }
      currentLevel = newLevel;
      levelsGained.push(currentLevel);
    } else {
      break;
    }
  }

  unit.level = currentLevel;

  if (!leveledUp) {
    return { leveledUp: false, newLevel: currentLevel, gains: {}, levelsGained: [] };
  }

  const previousMaxHp = unit.stats.maxHp;

  for (const key of STAT_KEYS) {
    const val = totalGains[key];
    if (val !== undefined && val !== 0) {
      const existing = unit.bonusStats[key] ?? 0;
      unit.bonusStats[key] = existing + val;
    }
  }

  const newStats = computeStats(unit);
  unit.stats = newStats;

  const maxHpDelta = newStats.maxHp - previousMaxHp;
  if (maxHpDelta > 0) {
    unit.hp += maxHpDelta;
  } else if (unit.hp > newStats.maxHp) {
    unit.hp = newStats.maxHp;
  }

  return {
    leveledUp: true,
    newLevel: currentLevel,
    gains: totalGains,
    levelsGained,
    featuresGranted: featuresGranted.length > 0 ? featuresGranted : undefined,
  };
}

export function applyXpToPartyMember(pm: PartyMember, xp: number): LevelUpResult {
  const startXp = pm.xp;
  pm.xp += xp;

  const progressionTable = CLASS_REGISTRY[pm.classId]?.progressionTable ?? [];

  let totalGains: Partial<UnitStats> = {};
  let currentLevel = levelForXp(startXp);
  let leveledUp = false;
  const levelsGained: number[] = [];
  const featuresGranted: string[] = [];

  for (let level = currentLevel; level < MAX_LEVEL; level++) {
    if (pm.xp >= XP_THRESHOLDS[level]) {
      leveledUp = true;
      const newLevel = level + 1;
      const entry = progressionTable.find((e) => e.level === newLevel);
      totalGains = sumGains(totalGains, entry?.statGain ?? {});
      if (entry?.featuresGranted) {
        for (const f of entry.featuresGranted) {
          if (!featuresGranted.includes(f)) featuresGranted.push(f);
        }
      }
      currentLevel = newLevel;
      levelsGained.push(currentLevel);
    } else {
      break;
    }
  }

  pm.level = currentLevel;

  if (!leveledUp) {
    return { leveledUp: false, newLevel: currentLevel, gains: {}, levelsGained: [] };
  }

  const conLevelDelta = pm.abilityScores ? abilityMod(pm.abilityScores.con) * levelsGained.length : 0;
  const maxHpDelta = (totalGains.maxHp ?? 0) + conLevelDelta;

  if (maxHpDelta !== 0) {
    pm.maxHp = Math.max(1, pm.maxHp + maxHpDelta);
  }
  if (maxHpDelta > 0) {
    pm.hp += maxHpDelta;
  } else if (pm.hp > pm.maxHp) {
    pm.hp = pm.maxHp;
  }

  for (const key of STAT_KEYS) {
    const val = totalGains[key];
    if (val !== undefined && val !== 0) {
      const existing = pm.bonusStats[key] ?? 0;
      pm.bonusStats[key] = existing + val;
    }
  }

  if (featuresGranted.length > 0) {
    pm.passives = pm.passives ?? [];
    for (const f of featuresGranted) {
      if (!pm.passives.includes(f)) pm.passives.push(f);
    }
  }

  return {
    leveledUp: true,
    newLevel: currentLevel,
    gains: totalGains,
    levelsGained,
    featuresGranted: featuresGranted.length > 0 ? featuresGranted : undefined,
  };
}
