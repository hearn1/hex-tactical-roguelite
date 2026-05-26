import type { UnitInstance, UnitStats } from "../state/types.ts";
import { computeStats } from "../combat/Stats.ts";

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
}

const CLASS_LEVEL_GAINS: Record<string, Partial<UnitStats>> = {
  "class.guardian": { maxHp: 2, might: 1 },
  "class.acolyte": { maxHp: 1, spirit: 1 },
  "class.arcanist": { maxHp: 1, spirit: 1 },
};

const STAT_KEYS: (keyof UnitStats)[] = ["maxHp", "armor", "move", "might", "agility", "spirit"];

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

  const classId = unit.defId;
  const perLevelGains = CLASS_LEVEL_GAINS[classId] ?? { maxHp: 1, spirit: 1 };

  let totalGains: Partial<UnitStats> = {};
  let currentLevel = levelForXp(startXp);
  let leveledUp = false;

  for (let level = currentLevel; level < MAX_LEVEL; level++) {
    if (unit.xp >= XP_THRESHOLDS[level]) {
      leveledUp = true;
      totalGains = sumGains(totalGains, perLevelGains);
      currentLevel = level + 1;
    } else {
      break;
    }
  }

  unit.level = currentLevel;

  if (!leveledUp) {
    return { leveledUp: false, newLevel: currentLevel, gains: {} };
  }

  const maxHpDelta = totalGains.maxHp ?? 0;

  for (const key of STAT_KEYS) {
    const val = totalGains[key];
    if (val !== undefined && val !== 0) {
      const existing = unit.bonusStats[key] ?? 0;
      unit.bonusStats[key] = existing + val;
    }
  }

  const newStats = computeStats(unit);
  unit.stats = newStats;

  if (maxHpDelta > 0) {
    unit.hp += maxHpDelta;
  }

  return { leveledUp: true, newLevel: currentLevel, gains: totalGains };
}
