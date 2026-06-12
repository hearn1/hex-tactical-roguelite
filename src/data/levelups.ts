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
export const LEVELUP_CHOICE_MAX_LEVEL = 5;

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
  | { kind: "passive"; passiveId: string }
  /** Archetype/subclass choice (F84). On pick: sets archetypeId and grants the archetype passive. */
  | { kind: "archetype"; archetypeId: string }
  /** Learn a new action from the class's action pool. Pushes the action id to spellsKnown. */
  | { kind: "learnAction"; actionId: string }
  /**
   * 5E Ability Score Improvement. The player distributes `points` across ability scores
   * (each stat capped at +points per ASI). Applied to PartyMember.bonusStats on confirm.
   */
  | { kind: "abilityScoreImprovement"; points: number };

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
        id: "guardian.archetype.shieldbearer",
        name: "Shieldbearer",
        description: "Taunt enemies and gain Armor when adjacent to an ally.",
        upgrade: { kind: "archetype", archetypeId: "archetype.guardian.shieldbearer" },
      },
      {
        id: "guardian.archetype.vindicator",
        name: "Vindicator",
        description: "Strike back when hit and attack harder when wounded.",
        upgrade: { kind: "archetype", archetypeId: "archetype.guardian.vindicator" },
      },
    ],
    4: [
      {
        id: "guardian.learn_cleave",
        name: "Learn Cleave",
        description: "Learn Cleave — AoE melee attack hitting all adjacent enemies.",
        upgrade: { kind: "learnAction", actionId: "action.cleave" },
      },
      {
        id: "guardian.learn_shield_wall",
        name: "Learn Shield Wall",
        description: "Learn Shield Wall — all adjacent allies gain Guarded.",
        upgrade: { kind: "learnAction", actionId: "action.shield_wall" },
      },
      {
        id: "guardian.learn_second_wind",
        name: "Learn Second Wind",
        description: "Learn Second Wind — self-heal 1d6 + level, once per encounter.",
        upgrade: { kind: "learnAction", actionId: "action.second_wind" },
      },
      {
        id: "guardian.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
    ],
    5: [
      {
        id: "guardian.durable_fortress",
        name: "Durable Fortress",
        description: "Permanent +2 max HP and +1 Armor.",
        upgrade: { kind: "stat", stats: { maxHp: 2, armor: 1 } },
      },
      {
        id: "guardian.learn_bulwark",
        name: "Learn Bulwark",
        description: "Learn Bulwark — grant an adjacent ally the Guarded condition.",
        upgrade: { kind: "learnAction", actionId: "action.bulwark" },
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
        id: "acolyte.archetype.beacon",
        name: "Beacon",
        description: "Radiant healing burst and a save-fortifying aura.",
        upgrade: { kind: "archetype", archetypeId: "archetype.acolyte.beacon" },
      },
      {
        id: "acolyte.archetype.cloistered",
        name: "Cloistered",
        description: "Protective Ward and enhanced healing magic.",
        upgrade: { kind: "archetype", archetypeId: "archetype.acolyte.cloistered" },
      },
    ],
    4: [
      {
        id: "acolyte.learn_mass_heal",
        name: "Learn Mass Heal",
        description: "Learn Mass Heal — AoE heal all allies within radius 2.",
        upgrade: { kind: "learnAction", actionId: "action.mass_heal" },
      },
      {
        id: "acolyte.learn_cleanse",
        name: "Learn Cleanse",
        description: "Learn Cleanse — remove all conditions from a target ally.",
        upgrade: { kind: "learnAction", actionId: "action.cleanse" },
      },
      {
        id: "acolyte.learn_sanctuary",
        name: "Learn Sanctuary",
        description: "Learn Sanctuary — ward an ally to negate the next attack against them.",
        upgrade: { kind: "learnAction", actionId: "action.sanctuary" },
      },
    ],
    5: [
      {
        id: "acolyte.faithful_recovery",
        name: "Faithful Recovery",
        description: "Permanent +1 Wisdom and +2 max HP.",
        upgrade: { kind: "stat", stats: { wis: 1, maxHp: 2 } },
      },
      {
        id: "acolyte.learn_shield_of_faith",
        name: "Learn Shield of Faith",
        description: "Learn Shield of Faith — grant an ally +3 armor for 1 round.",
        upgrade: { kind: "learnAction", actionId: "action.shield_of_faith" },
      },
    ],
  },
  "class.fighter": {
    2: [
      {
        id: "fighter.fighting_style_dueling",
        name: "Dueling",
        description: "Precise Strike and Ranged Shot deal +2 damage.",
        upgrade: { kind: "action", actionIds: ["action.fighter.precise_strike", "action.fighter.ranged_shot"], damageBonus: 2 },
      },
      {
        id: "fighter.fighting_style_defense",
        name: "Defense",
        description: "Permanent +1 Armor.",
        upgrade: { kind: "stat", stats: { armor: 1 } },
      },
    ],
    3: [
      {
        id: "fighter.archetype.champion",
        name: "Champion",
        description: "Hone your physical prowess — critical hits on 19-20.",
        upgrade: { kind: "archetype", archetypeId: "archetype.fighter.champion" },
      },
      {
        id: "fighter.archetype.battle_master",
        name: "Battle Master",
        description: "Learn combat maneuvers powered by superiority dice.",
        upgrade: { kind: "archetype", archetypeId: "archetype.fighter.battle_master" },
      },
    ],
    4: [
      {
        id: "fighter.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
      {
        id: "fighter.iron_constitution",
        name: "Iron Constitution",
        description: "Permanent +2 max HP and +1 Constitution.",
        upgrade: { kind: "stat", stats: { maxHp: 2, con: 1 } },
      },
    ],
    5: [
      {
        id: "fighter.battle_hardened",
        name: "Battle Hardened",
        description: "Permanent +2 max HP.",
        upgrade: { kind: "stat", stats: { maxHp: 2 } },
      },
      {
        id: "fighter.combat_reflexes",
        name: "Combat Reflexes",
        description: "Permanent +1 Strength.",
        upgrade: { kind: "stat", stats: { str: 1 } },
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
        id: "arcanist.archetype.evoker",
        name: "Evoker",
        description: "Empower spells and crit on 19-20.",
        upgrade: { kind: "archetype", archetypeId: "archetype.arcanist.evoker" },
      },
      {
        id: "arcanist.archetype.enchanter",
        name: "Enchanter",
        description: "Mesmerize foes and weaken enemy attacks on allies.",
        upgrade: { kind: "archetype", archetypeId: "archetype.arcanist.enchanter" },
      },
    ],
    4: [
      {
        id: "arcanist.learn_fireball",
        name: "Learn Fireball",
        description: "Learn Fireball — AoE damage radius 2 from target hex.",
        upgrade: { kind: "learnAction", actionId: "action.fireball" },
      },
      {
        id: "arcanist.learn_lightning_bolt",
        name: "Learn Lightning Bolt",
        description: "Learn Lightning Bolt — line damage hitting all enemies up to range 4.",
        upgrade: { kind: "learnAction", actionId: "action.lightning_bolt" },
      },
      {
        id: "arcanist.learn_haste",
        name: "Learn Haste",
        description: "Learn Haste — grant an ally +2 movement for 1 round.",
        upgrade: { kind: "learnAction", actionId: "action.haste" },
      },
    ],
    5: [
      {
        id: "arcanist.arcane_reserves",
        name: "Arcane Reserves",
        description: "Permanent +1 Intelligence and +1 max HP.",
        upgrade: { kind: "stat", stats: { int: 1, maxHp: 1 } },
      },
      {
        id: "arcanist.learn_slow",
        name: "Learn Slow",
        description: "Learn Slow — slows all enemies within radius 2 for 2 rounds.",
        upgrade: { kind: "learnAction", actionId: "action.slow" },
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
    description: "Permanent +1 Dexterity.",
    upgrade: { kind: "stat", stats: { dex: 1 } },
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
