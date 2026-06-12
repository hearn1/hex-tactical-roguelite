import type { PartyMember, PendingLevelUp } from "../state/RunState.ts";
import type { UnitStats } from "../state/types.ts";
import type { LevelUpOption } from "../data/levelups.ts";
import {
  LEVELUP_CHOICES,
  LEVELUP_CHOICE_MIN_LEVEL,
  LEVELUP_CHOICE_MAX_LEVEL,
  SHARED_FALLBACK_CHOICES,
} from "../data/levelups.ts";
import { ARCHETYPE_REGISTRY, archetypesByClass } from "../data/archetypes.ts";

const STAT_KEYS: (keyof UnitStats)[] = ["maxHp", "armor", "move", "str", "dex", "con", "int", "wis", "cha"];

/** True when a level falls inside the interactive choice band (levels 2–3 first pass). */
export function isChoiceLevel(level: number): boolean {
  return level >= LEVELUP_CHOICE_MIN_LEVEL && level <= LEVELUP_CHOICE_MAX_LEVEL;
}

/**
 * Options offered for a class at a given level: the bespoke per-class table when present,
 * else options generated from archetypes with a matching `chosenAtLevel`, else the shared
 * fallback. Returns `[]` for levels outside the choice band with no archetypes due.
 */
export function getLevelUpOptions(classId: string, level: number): LevelUpOption[] {
  const classTable = LEVELUP_CHOICES[classId];
  const explicit = classTable?.[level];
  if (explicit && explicit.length > 0) return explicit;

  const archetypesAtLevel = archetypesByClass(classId).filter(
    (a) => (a.chosenAtLevel ?? 3) === level,
  );
  if (archetypesAtLevel.length > 0) {
    return archetypesAtLevel.map((a) => ({
      id: `${classId}.archetype.${a.id}`,
      name: a.displayName,
      description: a.description,
      upgrade: { kind: "archetype" as const, archetypeId: a.id },
    }));
  }

  if (!isChoiceLevel(level)) return [];
  return SHARED_FALLBACK_CHOICES;
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
 * Append pending level-up choices for the levels a hero just gained. Levels inside the
 * choice band always enqueue; levels outside it enqueue only when archetypes are due at
 * that level (via `chosenAtLevel`). Mutates and returns `queue` for chaining.
 */
export function enqueuePendingLevelUps(
  queue: PendingLevelUp[],
  instanceId: string,
  classId: string,
  levelsGained: number[],
): PendingLevelUp[] {
  for (const newLevel of levelsGained) {
    const hasArchetypeChoice = archetypesByClass(classId).some(
      (a) => (a.chosenAtLevel ?? 3) === newLevel,
    );
    if (isChoiceLevel(newLevel) || hasArchetypeChoice) {
      queue.push({ instanceId, classId, newLevel });
    }
  }
  return queue;
}

/**
 * Apply a chosen level-up upgrade to a party member, persisting it for the run, and return a
 * human-readable log line. `stat` upgrades fold into `bonusStats` (and bump max/current HP for
 * `maxHp`); `action` upgrades accumulate per-action bonuses; `passive` upgrades record a flag.
 * For `abilityScoreImprovement` upgrades, pass `asiStats` with the player's chosen distribution;
 * if omitted (e.g. default auto-apply paths), the ASI is recorded but no stats are changed.
 */
export function applyLevelUpChoice(pm: PartyMember, option: LevelUpOption, asiStats?: Partial<UnitStats>): string {
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
    case "archetype": {
      const archetypeDef = ARCHETYPE_REGISTRY[upgrade.archetypeId];
      pm.archetypeId = upgrade.archetypeId;
      if (archetypeDef?.passiveId) {
        pm.passives = pm.passives ?? [];
        if (!pm.passives.includes(archetypeDef.passiveId)) {
          pm.passives.push(archetypeDef.passiveId);
        }
      }
      break;
    }
    case "learnAction": {
      pm.spellsKnown = pm.spellsKnown ?? [];
      if (!pm.spellsKnown.includes(upgrade.actionId)) {
        pm.spellsKnown.push(upgrade.actionId);
      }
      break;
    }
    case "abilityScoreImprovement": {
      if (asiStats) {
        for (const key of STAT_KEYS) {
          const val = asiStats[key];
          if (val === undefined || val === 0) continue;
          pm.bonusStats[key] = (pm.bonusStats[key] ?? 0) + val;
        }
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
