import type { PartyMember, PendingLevelUp } from "../state/RunState.ts";
import type { UnitStats } from "../state/types.ts";
import type { LevelUpOption } from "../data/levelups.ts";
import {
  LEVELUP_CHOICES,
  LEVELUP_CHOICE_MIN_LEVEL,
  LEVELUP_CHOICE_MAX_LEVEL,
  SHARED_FALLBACK_CHOICES,
} from "../data/levelups.ts";

const STAT_KEYS: (keyof UnitStats)[] = ["maxHp", "armor", "move", "might", "agility", "spirit"];

/** True when a level falls inside the interactive choice band (levels 2–3 first pass). */
export function isChoiceLevel(level: number): boolean {
  return level >= LEVELUP_CHOICE_MIN_LEVEL && level <= LEVELUP_CHOICE_MAX_LEVEL;
}

/**
 * Options offered for a class at a given level: the bespoke per-class table when present,
 * else the shared fallback. Returns `[]` for levels outside the choice band so callers know
 * the level stays on the automatic table.
 */
export function getLevelUpOptions(classId: string, level: number): LevelUpOption[] {
  if (!isChoiceLevel(level)) return [];
  const classTable = LEVELUP_CHOICES[classId];
  const options = classTable?.[level];
  return options && options.length > 0 ? options : SHARED_FALLBACK_CHOICES;
}

/** Look up a single option for a class/level by id (used when confirming a choice). */
export function findLevelUpOption(
  classId: string,
  level: number,
  optionId: string,
): LevelUpOption | undefined {
  return getLevelUpOptions(classId, level).find((o) => o.id === optionId);
}

/**
 * Append pending level-up choices for the levels a hero just gained. Only levels inside the
 * choice band enqueue (others stay automatic). Mutates and returns `queue` for chaining.
 */
export function enqueuePendingLevelUps(
  queue: PendingLevelUp[],
  instanceId: string,
  classId: string,
  levelsGained: number[],
): PendingLevelUp[] {
  for (const newLevel of levelsGained) {
    if (isChoiceLevel(newLevel)) {
      queue.push({ instanceId, classId, newLevel });
    }
  }
  return queue;
}

/**
 * Apply a chosen level-up upgrade to a party member, persisting it for the run, and return a
 * human-readable log line. `stat` upgrades fold into `bonusStats` (and bump max/current HP for
 * `maxHp`); `action` upgrades accumulate per-action bonuses; `passive` upgrades record a flag.
 */
export function applyLevelUpChoice(pm: PartyMember, option: LevelUpOption): string {
  const upgrade = option.upgrade;

  switch (upgrade.kind) {
    case "stat": {
      for (const key of STAT_KEYS) {
        const val = upgrade.stats[key];
        if (val === undefined || val === 0) continue;
        pm.bonusStats[key] = (pm.bonusStats[key] ?? 0) + val;
      }
      const maxHpDelta = upgrade.stats.maxHp ?? 0;
      if (maxHpDelta !== 0) {
        pm.maxHp += maxHpDelta;
        pm.hp += maxHpDelta;
      }
      break;
    }
    case "action": {
      pm.actionUpgrades = pm.actionUpgrades ?? {};
      for (const actionId of upgrade.actionIds) {
        const existing = pm.actionUpgrades[actionId] ?? {};
        pm.actionUpgrades[actionId] = {
          damageBonus: (existing.damageBonus ?? 0) + (upgrade.damageBonus ?? 0),
          healBonus: (existing.healBonus ?? 0) + (upgrade.healBonus ?? 0),
          rangeBonus: (existing.rangeBonus ?? 0) + (upgrade.rangeBonus ?? 0),
          conditionDurationBonus:
            (existing.conditionDurationBonus ?? 0) + (upgrade.conditionDurationBonus ?? 0),
        };
      }
      break;
    }
    case "passive": {
      pm.passives = pm.passives ?? [];
      if (!pm.passives.includes(upgrade.passiveId)) {
        pm.passives.push(upgrade.passiveId);
      }
      break;
    }
  }

  pm.levelUpChoiceIds = pm.levelUpChoiceIds ?? [];
  pm.levelUpChoiceIds.push(option.id);

  return `${pm.displayName} gains ${option.name}: ${option.description}`;
}

/**
 * Auto-apply the default (first) option for each in-range level gained. Used for pre-run/meta
 * starting XP, which must not open an interactive choice screen mid-setup (resolved decision).
 */
export function applyDefaultLevelUpChoices(
  pm: PartyMember,
  classId: string,
  levelsGained: number[],
): void {
  for (const newLevel of levelsGained) {
    const options = getLevelUpOptions(classId, newLevel);
    if (options.length > 0) {
      applyLevelUpChoice(pm, options[0]);
    }
  }
}
