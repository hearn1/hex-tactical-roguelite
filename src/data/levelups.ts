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
  "class.rogue": {
    2: [
      {
        id: "rogue.cunning_action_disengage",
        name: "Cunning Action: Disengage",
        description: "Disengage & Dash costs no action — permanent +1 movement.",
        upgrade: { kind: "stat", stats: { move: 1 } },
      },
      {
        id: "rogue.cunning_action_hide",
        name: "Cunning Action: Hide",
        description: "Slip into cover and gain +2 AC — permanent +1 Armor.",
        upgrade: { kind: "stat", stats: { armor: 1 } },
      },
    ],
    3: [
      {
        id: "rogue.archetype.thief",
        name: "Thief",
        description: "Fast hands and quicker feet; use an item as a bonus action.",
        upgrade: { kind: "archetype", archetypeId: "archetype.rogue.thief" },
      },
      {
        id: "rogue.archetype.assassin",
        name: "Assassin",
        description: "Masters of surprise; deal bonus damage against full-HP targets.",
        upgrade: { kind: "archetype", archetypeId: "archetype.rogue.assassin" },
      },
    ],
    4: [
      {
        id: "rogue.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
      {
        id: "rogue.shadow_step",
        name: "Shadow Step",
        description: "Permanent +1 Dexterity and +1 max HP.",
        upgrade: { kind: "stat", stats: { dex: 1, maxHp: 1 } },
      },
    ],
    5: [
      {
        id: "rogue.blade_mastery",
        name: "Blade Mastery",
        description: "Sneak Stab and Shortbow Shot deal +1 damage.",
        upgrade: { kind: "action", actionIds: ["action.rogue.sneak_stab", "action.rogue.shortbow_shot"], damageBonus: 1 },
      },
      {
        id: "rogue.vital_strike",
        name: "Vital Strike",
        description: "Permanent +1 Dexterity.",
        upgrade: { kind: "stat", stats: { dex: 1 } },
      },
    ],
  },
  "class.cleric": {
    2: [
      {
        id: "cleric.improved_channel_divinity",
        name: "Improved Channel Divinity",
        description: "Channel Divinity can be used twice per combat instead of once.",
        upgrade: { kind: "passive", passiveId: "passive.cleric.improved_channel" },
      },
      {
        id: "cleric.learn_divine_favor",
        name: "Learn Divine Favor",
        description: "Learn Divine Favor — bless an ally for +1 to attack rolls for 2 rounds.",
        upgrade: { kind: "learnAction", actionId: "action.divine_favor" },
      },
    ],
    3: [
      {
        id: "cleric.archetype.life_domain",
        name: "Life Domain",
        description: "Healer's blessing; all healing restores +2+WIS extra HP, plus Mass Cure Wounds.",
        upgrade: { kind: "archetype", archetypeId: "archetype.cleric.life_domain" },
      },
      {
        id: "cleric.archetype.war_domain",
        name: "War Domain",
        description: "Blessed warrior; gains martial proficiency, Divine Strike, and a bonus attack after cantrips.",
        upgrade: { kind: "archetype", archetypeId: "archetype.cleric.war_domain" },
      },
    ],
    4: [
      {
        id: "cleric.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
      {
        id: "cleric.learn_bless",
        name: "Learn Bless",
        description: "Learn Bless — grant +2 to an ally's next attack or heal.",
        upgrade: { kind: "learnAction", actionId: "action.bless" },
      },
    ],
    5: [
      {
        id: "cleric.learn_mass_cure_wounds",
        name: "Learn Mass Cure Wounds",
        description: "Learn Mass Cure Wounds — heal 2d8 + Wisdom to all allies in range 2.",
        upgrade: { kind: "learnAction", actionId: "action.cleric.mass_cure_wounds" },
      },
      {
        id: "cleric.faithful_servant",
        name: "Faithful Servant",
        description: "Permanent +1 Wisdom and +2 max HP.",
        upgrade: { kind: "stat", stats: { wis: 1, maxHp: 2 } },
      },
    ],
  },
  "class.wizard": {
    2: [
      {
        id: "wizard.learn_fireball",
        name: "Learn Fireball",
        description: "Learn Fireball — explosive AoE blast dealing 2d6 + Intelligence to all enemies in radius 2.",
        upgrade: { kind: "learnAction", actionId: "action.fireball" },
      },
      {
        id: "wizard.learn_lightning_bolt",
        name: "Learn Lightning Bolt",
        description: "Learn Lightning Bolt — line damage striking all enemies in a 4-hex line.",
        upgrade: { kind: "learnAction", actionId: "action.lightning_bolt" },
      },
    ],
    3: [
      {
        id: "wizard.archetype.evocation",
        name: "School of Evocation",
        description: "Sculpt damaging spells to spare allies in the blast, and empower evocations at L5.",
        upgrade: { kind: "archetype", archetypeId: "archetype.wizard.evocation" },
      },
      {
        id: "wizard.archetype.abjuration",
        name: "School of Abjuration",
        description: "Maintain a magical ward that absorbs damage and recharges when you cast spells.",
        upgrade: { kind: "archetype", archetypeId: "archetype.wizard.abjuration" },
      },
    ],
    4: [
      {
        id: "wizard.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
      {
        id: "wizard.learn_haste",
        name: "Learn Haste",
        description: "Learn Haste — grant an ally +2 movement for 1 round.",
        upgrade: { kind: "learnAction", actionId: "action.haste" },
      },
      {
        id: "wizard.learn_slow",
        name: "Learn Slow",
        description: "Learn Slow — slows all enemies within radius 2 for 2 rounds.",
        upgrade: { kind: "learnAction", actionId: "action.slow" },
      },
    ],
    5: [
      {
        id: "wizard.learn_counterspell",
        name: "Learn Counterspell",
        description: "Learn Counterspell — cancel a telegraphed enemy action or apply Counterspelled.",
        upgrade: { kind: "learnAction", actionId: "action.counterspell" },
      },
      {
        id: "wizard.arcane_mastery",
        name: "Arcane Mastery",
        description: "Permanent +1 Intelligence and +1 max HP.",
        upgrade: { kind: "stat", stats: { int: 1, maxHp: 1 } },
      },
    ],
  },
  "class.ranger": {
    2: [
      {
        id: "ranger.fighting_style_archery",
        name: "Archery",
        description: "Volley and Ensnaring Strike deal +2 damage.",
        upgrade: { kind: "action", actionIds: ["action.ranger.volley", "action.ranger.ensnaring_strike"], damageBonus: 2 },
      },
      {
        id: "ranger.fighting_style_defense",
        name: "Defense",
        description: "Permanent +1 Armor while wearing medium armor.",
        upgrade: { kind: "stat", stats: { armor: 1 } },
      },
    ],
    3: [
      {
        id: "ranger.archetype.hunter",
        name: "Hunter",
        description: "Specialize in hunting big prey — Hail of Arrows and Colossus Slayer.",
        upgrade: { kind: "archetype", archetypeId: "archetype.ranger.hunter" },
      },
      {
        id: "ranger.archetype.gloom_stalker",
        name: "Gloom Stalker",
        description: "Thrive in darkness — Umbral Sight and Dread Ambusher.",
        upgrade: { kind: "archetype", archetypeId: "archetype.ranger.gloom_stalker" },
      },
    ],
    4: [
      {
        id: "ranger.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
      {
        id: "ranger.fleet_footed",
        name: "Fleet-Footed",
        description: "Permanent +1 Dexterity and +1 Wisdom.",
        upgrade: { kind: "stat", stats: { dex: 1, wis: 1 } },
      },
    ],
    5: [
      {
        id: "ranger.extra_spell_slot",
        name: "Expanded Spellcasting",
        description: "Grants one additional spell slot per Long Rest.",
        upgrade: { kind: "passive", passiveId: "passive.ranger.extra_slot_l5" },
      },
      {
        id: "ranger.hunter_instincts",
        name: "Hunter's Instincts",
        description: "Permanent +1 Dexterity and +2 max HP.",
        upgrade: { kind: "stat", stats: { dex: 1, maxHp: 2 } },
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
  "class.bard": {
    2: [
      {
        id: "bard.learn_dissonant_whispers",
        name: "Dissonant Whispers",
        description: "Learn Dissonant Whispers — psychic damage + frightened condition.",
        upgrade: { kind: "learnAction", actionId: "action.bard.dissonant_whispers" },
      },
      {
        id: "bard.learn_healing_song_l2",
        name: "Focused Melody",
        description: "Permanent +1 Charisma.",
        upgrade: { kind: "stat", stats: { cha: 1 } },
      },
    ],
    3: [
      {
        id: "bard.archetype.college_of_lore",
        name: "College of Lore",
        description: "Weave cutting words into battle and steal spell knowledge from other traditions.",
        upgrade: { kind: "archetype", archetypeId: "archetype.bard.college_of_lore" },
      },
      {
        id: "bard.archetype.college_of_valor",
        name: "College of Valor",
        description: "Inspire allies mid-battle; Bardic Inspiration adds to damage rolls.",
        upgrade: { kind: "archetype", archetypeId: "archetype.bard.college_of_valor" },
      },
    ],
    4: [
      {
        id: "bard.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
      {
        id: "bard.learn_hypnotic_pattern",
        name: "Hypnotic Pattern",
        description: "Learn Hypnotic Pattern — slows all enemies in a 2-hex area for 2 turns.",
        upgrade: { kind: "learnAction", actionId: "action.bard.hypnotic_pattern" },
      },
    ],
    5: [
      {
        id: "bard.captivating_presence",
        name: "Captivating Presence",
        description: "Permanent +1 Charisma and +2 max HP.",
        upgrade: { kind: "stat", stats: { cha: 1, maxHp: 2 } },
      },
      {
        id: "bard.learn_dissonant_whispers_l5",
        name: "Dissonant Whispers (Advanced)",
        description: "Learn Dissonant Whispers if not yet known — psychic damage and frightened.",
        upgrade: { kind: "learnAction", actionId: "action.bard.dissonant_whispers" },
      },
    ],
  },
  "class.paladin": {
    2: [
      {
        id: "paladin.fighting_style_dueling",
        name: "Dueling",
        description: "Divine Smite and Sacred Weapon deal +2 damage.",
        upgrade: { kind: "action", actionIds: ["action.paladin.divine_smite", "action.paladin.sacred_weapon"], damageBonus: 2 },
      },
      {
        id: "paladin.fighting_style_defense",
        name: "Defense",
        description: "Permanent +1 Armor from a defensive fighting style.",
        upgrade: { kind: "stat", stats: { armor: 1 } },
      },
    ],
    3: [
      {
        id: "paladin.archetype.devotion",
        name: "Oath of Devotion",
        description: "Pure-hearted champion — Holy Nimbus and a save-fortifying aura for nearby allies.",
        upgrade: { kind: "archetype", archetypeId: "archetype.paladin.devotion" },
      },
      {
        id: "paladin.archetype.vengeance",
        name: "Oath of Vengeance",
        description: "Relentless hunter — Vow of Enmity and a speed bonus when striking cursed prey.",
        upgrade: { kind: "archetype", archetypeId: "archetype.paladin.vengeance" },
      },
    ],
    4: [
      {
        id: "paladin.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
      {
        id: "paladin.iron_will",
        name: "Iron Will",
        description: "Permanent +1 Wisdom and +2 max HP.",
        upgrade: { kind: "stat", stats: { wis: 1, maxHp: 2 } },
      },
    ],
    5: [
      {
        id: "paladin.divine_resolve",
        name: "Divine Resolve",
        description: "Permanent +1 Charisma and +2 max HP.",
        upgrade: { kind: "stat", stats: { cha: 1, maxHp: 2 } },
      },
      {
        id: "paladin.sacred_bastion",
        name: "Sacred Bastion",
        description: "Permanent +1 Strength and +1 Armor.",
        upgrade: { kind: "stat", stats: { str: 1, armor: 1 } },
      },
    ],
  },
  "class.barbarian": {
    2: [
      {
        id: "barbarian.extra_rage_l2",
        name: "Relentless Fury",
        description: "Gain one additional Rage use per combat.",
        upgrade: { kind: "passive", passiveId: "passive.barbarian.extra_rage_l2" },
      },
      {
        id: "barbarian.brutal_strength",
        name: "Brutal Strength",
        description: "Permanent +2 Strength.",
        upgrade: { kind: "stat", stats: { str: 2 } },
      },
    ],
    3: [
      {
        id: "barbarian.archetype.berserker",
        name: "Path of the Berserker",
        description: "Channel battle madness into a bonus attack while raging; risks exhaustion after combat.",
        upgrade: { kind: "archetype", archetypeId: "archetype.barbarian.berserker" },
      },
      {
        id: "barbarian.archetype.totem_bear",
        name: "Path of the Totem (Bear)",
        description: "Bear the spirit of the bear — resist all damage types while raging.",
        upgrade: { kind: "archetype", archetypeId: "archetype.barbarian.totem_bear" },
      },
    ],
    4: [
      {
        id: "barbarian.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
      {
        id: "barbarian.iron_body",
        name: "Iron Body",
        description: "Permanent +2 max HP and +1 Constitution.",
        upgrade: { kind: "stat", stats: { maxHp: 2, con: 1 } },
      },
    ],
    5: [
      {
        id: "barbarian.extra_rage_l5",
        name: "Relentless Fury (L5)",
        description: "Gain one additional Rage use per combat.",
        upgrade: { kind: "passive", passiveId: "passive.barbarian.extra_rage_l5" },
      },
      {
        id: "barbarian.primal_resilience",
        name: "Primal Resilience",
        description: "Permanent +1 Strength and +2 max HP.",
        upgrade: { kind: "stat", stats: { str: 1, maxHp: 2 } },
      },
    ],
  },
  "class.druid": {
    2: [
      {
        id: "druid.learn_produce_flame",
        name: "Produce Flame",
        description: "Learn Produce Flame — a cantrip that hurls spectral fire for 1d8 + Wisdom damage.",
        upgrade: { kind: "learnAction", actionId: "action.druid.produce_flame" },
      },
      {
        id: "druid.learn_entangle",
        name: "Entangle",
        description: "Learn Entangle — root all enemies in a 2-hex area for 2 turns.",
        upgrade: { kind: "learnAction", actionId: "action.druid.entangle" },
      },
    ],
    3: [
      {
        id: "druid.archetype.circle_of_moon",
        name: "Circle of the Moon",
        description: "Wild Shape grants greater power and natural armor.",
        upgrade: { kind: "archetype", archetypeId: "archetype.druid.circle_of_moon" },
      },
      {
        id: "druid.archetype.circle_of_land",
        name: "Circle of the Land",
        description: "Draw power from the terrain; recover a spell slot after each combat.",
        upgrade: { kind: "archetype", archetypeId: "archetype.druid.circle_of_land" },
      },
    ],
    4: [
      {
        id: "druid.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
      {
        id: "druid.learn_moonbeam",
        name: "Moonbeam",
        description: "Learn Moonbeam — a focused column of radiance dealing 2d10 + Wisdom to one target.",
        upgrade: { kind: "learnAction", actionId: "action.druid.moonbeam" },
      },
    ],
    5: [
      {
        id: "druid.learn_produce_flame_l5",
        name: "Produce Flame (Cantrip)",
        description: "Learn Produce Flame if not yet known — a reliable ranged fire cantrip.",
        upgrade: { kind: "learnAction", actionId: "action.druid.produce_flame" },
      },
      {
        id: "druid.natures_resilience",
        name: "Nature's Resilience",
        description: "Permanent +1 Wisdom and +2 max HP.",
        upgrade: { kind: "stat", stats: { wis: 1, maxHp: 2 } },
      },
    ],
  },
  "class.warlock": {
    2: [
      {
        id: "warlock.agonizing_blast",
        name: "Agonizing Blast",
        description: "Add your Charisma modifier to Eldritch Blast's damage on every hit.",
        upgrade: { kind: "passive", passiveId: "passive.warlock.agonizing_blast" },
      },
      {
        id: "warlock.devils_sight",
        name: "Devil's Sight",
        description: "Your patron's dark gift: ignore darkness and stealth penalties. +1 to all skill checks.",
        upgrade: { kind: "passive", passiveId: "passive.warlock.devils_sight" },
      },
    ],
    3: [
      {
        id: "warlock.archetype.fiend",
        name: "The Fiend",
        description: "Pact with a lord of the lower planes — gain temp HP on kill and Hellish Rebuke.",
        upgrade: { kind: "archetype", archetypeId: "archetype.warlock.fiend" },
      },
      {
        id: "warlock.archetype.great_old_one",
        name: "The Great Old One",
        description: "Pact with an alien mind — gain psychic interference and Entropic Ward.",
        upgrade: { kind: "archetype", archetypeId: "archetype.warlock.great_old_one" },
      },
      {
        id: "warlock.pact_of_blade",
        name: "Pact of the Blade",
        description: "Bind a weapon to your patron's power — your melee attacks draw on your Charisma.",
        upgrade: { kind: "passive", passiveId: "passive.warlock.pact_of_blade" },
      },
      {
        id: "warlock.pact_of_tome",
        name: "Pact of the Tome",
        description: "Your patron gifts a Book of Shadows — learn 2 additional cantrips.",
        upgrade: { kind: "passive", passiveId: "passive.warlock.pact_of_tome" },
      },
    ],
    4: [
      {
        id: "warlock.ability_score_improvement",
        name: "Ability Score Improvement",
        description: "Distribute +2 points across your ability scores.",
        upgrade: { kind: "abilityScoreImprovement", points: 2 },
      },
      {
        id: "warlock.repelling_blast",
        name: "Repelling Blast",
        description: "Eldritch Blast pushes its target 1 hex away from you on a hit.",
        upgrade: { kind: "passive", passiveId: "passive.warlock.repelling_blast" },
      },
    ],
    5: [
      {
        id: "warlock.agonizing_blast_l5",
        name: "Agonizing Blast",
        description: "Learn Agonizing Blast — add your Charisma modifier to Eldritch Blast damage.",
        upgrade: { kind: "passive", passiveId: "passive.warlock.agonizing_blast" },
      },
      {
        id: "warlock.eldritch_mastery",
        name: "Eldritch Mastery",
        description: "Permanent +1 Charisma and +2 max HP.",
        upgrade: { kind: "stat", stats: { cha: 1, maxHp: 2 } },
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
