import type { UnitStats } from "../state/types.ts";

/**
 * Level-up choice content (F29 / #60). On a run-time level-up the player picks one option;
 * the chosen upgrade applies ON TOP of the level's automatic stat gain (maintainer decision).
 *
 * Original fantasy names/prose only — the SRD may be referenced for class *feel*, never copied.
 * First pass covers levels 2 and 3 with 2 options each; higher levels fall back to the auto
 * table (no choice). Keep the upgrade kinds data-driven so deeper class builds can extend this
 * registry without new combat code.
 */

/** Levels that present an interactive choice. Outside this band, leveling stays automatic. */
export const LEVELUP_CHOICE_MIN_LEVEL = 2;
export const LEVELUP_CHOICE_MAX_LEVEL = 3;

/** A single upgrade effect. Discriminated so each is applied + validated uniformly. */
export type LevelUpUpgrade =
  /** Permanent stat bonus(es). A `maxHp` entry also raises current HP. */
  | { kind: "stat"; stats: Partial<UnitStats> }
  /** Per-action numeric buff applied to each listed action id. */
  | {
      kind: "action";
      actionIds: string[];
      damageBonus?: number;
      healBonus?: number;
      rangeBonus?: number;
      conditionDurationBonus?: number;
    }
  /** A flagged passive read by the combat engine (e.g. "start_combat_guarded"). */
  | { kind: "passive"; passiveId: string };

export interface LevelUpOption {
  id: string;
  name: string;
  description: string;
  upgrade: LevelUpUpgrade;
}

/** Passive ids the combat engine knows how to honor (F29). */
export const LEVELUP_PASSIVE_START_COMBAT_GUARDED = "start_combat_guarded";
export const LEVELUP_PASSIVE_FIRST_HEAL_BONUS = "first_heal_bonus";
/** Extra HP granted by the first-heal-bonus passive's first heal each combat. */
export const FIRST_HEAL_BONUS_AMOUNT = 2;

/**
 * Per-class options keyed by `classId → level → options`. Maintainer-approved tables. Where a
 * resolved option offered a richer effect "if supported, otherwise +stat", the simpler
 * maintainer-sanctioned stat fallback is used here and flagged in the PR for sign-off.
 */
export const LEVELUP_CHOICES: Record<string, Record<number, LevelUpOption[]>> = {
  "class.guardian": {
    2: [
      {
        id: "guardian.iron_stance",
        name: "Iron Stance",
        description: "Permanent +2 max HP and +1 Armor.",
        upgrade: { kind: "stat", stats: { maxHp: 2, armor: 1 } },
      },
      {
        id: "guardian.pressing_strike",
        name: "Pressing Strike",
        description: "Slash and Shield Bash deal +1 damage.",
        upgrade: { kind: "action", actionIds: ["action.slash", "action.shield_bash"], damageBonus: 1 },
      },
    ],
    3: [
      {
        id: "guardian.hold_the_line",
        name: "Hold the Line",
        description: "Begin each combat already Guarded.",
        upgrade: { kind: "passive", passiveId: LEVELUP_PASSIVE_START_COMBAT_GUARDED },
      },
      {
        id: "guardian.defenders_reach",
        name: "Defender's Reach",
        description: "Permanent +1 Might.",
        upgrade: { kind: "stat", stats: { might: 1 } },
      },
    ],
  },
  "class.acolyte": {
    2: [
      {
        id: "acolyte.warm_hands",
        name: "Warm Hands",
        description: "Mend Wounds heals +2 HP.",
        upgrade: { kind: "action", actionIds: ["action.mend_wounds"], healBonus: 2 },
      },
      {
        id: "acolyte.steady_benediction",
        name: "Steady Benediction",
        description: "Bless lasts +1 turn.",
        upgrade: { kind: "action", actionIds: ["action.bless"], conditionDurationBonus: 1 },
      },
    ],
    3: [
      {
        id: "acolyte.quiet_resolve",
        name: "Quiet Resolve",
        description: "Permanent +1 Spirit and +1 max HP.",
        upgrade: { kind: "stat", stats: { spirit: 1, maxHp: 1 } },
      },
      {
        id: "acolyte.field_prayer",
        name: "Field Prayer",
        description: "The first heal each combat restores +2 additional HP.",
        upgrade: { kind: "passive", passiveId: LEVELUP_PASSIVE_FIRST_HEAL_BONUS },
      },
    ],
  },
  "class.arcanist": {
    2: [
      {
        id: "arcanist.ember_focus",
        name: "Ember Focus",
        description: "Fire Bolt deals +1 damage.",
        upgrade: { kind: "action", actionIds: ["action.fire_bolt"], damageBonus: 1 },
      },
      {
        id: "arcanist.frost_lore",
        name: "Frost Lore",
        description: "Frost Shard's Slowed lasts +1 turn.",
        upgrade: { kind: "action", actionIds: ["action.frost_shard"], conditionDurationBonus: 1 },
      },
    ],
    3: [
      {
        id: "arcanist.warding_formula",
        name: "Warding Formula",
        description: "Permanent +1 Spirit.",
        upgrade: { kind: "stat", stats: { spirit: 1 } },
      },
      {
        id: "arcanist.far_spark",
        name: "Far Spark",
        description: "Fire Bolt, Frost Shard, and Arcane Ward gain +1 range.",
        upgrade: {
          kind: "action",
          actionIds: ["action.fire_bolt", "action.frost_shard", "action.arcane_ward"],
          rangeBonus: 1,
        },
      },
    ],
  },
};

/**
 * Shared fallback options used when a class has no bespoke table for a level in the choice
 * range. Keeps every in-range level-up a real choice without forcing per-class authoring.
 */
export const SHARED_FALLBACK_CHOICES: LevelUpOption[] = [
  {
    id: "shared.toughened",
    name: "Toughened",
    description: "Permanent +2 max HP.",
    upgrade: { kind: "stat", stats: { maxHp: 2 } },
  },
  {
    id: "shared.honed_reflexes",
    name: "Honed Reflexes",
    description: "Permanent +1 Agility.",
    upgrade: { kind: "stat", stats: { agility: 1 } },
  },
];

/** Flat id → option lookup across every class table and the shared fallback (display/validation). */
export const LEVELUP_OPTION_BY_ID: Record<string, LevelUpOption> = (() => {
  const map: Record<string, LevelUpOption> = {};
  for (const byLevel of Object.values(LEVELUP_CHOICES)) {
    for (const options of Object.values(byLevel)) {
      for (const option of options) map[option.id] = option;
    }
  }
  for (const option of SHARED_FALLBACK_CHOICES) map[option.id] = option;
  return map;
})();
