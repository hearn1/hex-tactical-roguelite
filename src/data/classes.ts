import type { UnitStats } from "../state/types.ts";
import type { ClassProgressionTable } from "./progressionTables.ts";
import {
  GUARDIAN_PROGRESSION,
  ACOLYTE_PROGRESSION,
  ARCANIST_PROGRESSION,
  SCOUT_PROGRESSION,
  FIGHTER_PROGRESSION,
  ROGUE_PROGRESSION,
  CLERIC_PROGRESSION,
  WIZARD_PROGRESSION,
  RANGER_PROGRESSION,
  DRUID_PROGRESSION,
  BARD_PROGRESSION,
  WARLOCK_PROGRESSION,
  PALADIN_PROGRESSION,
  BARBARIAN_PROGRESSION,
  SORCERER_PROGRESSION,
  MONK_PROGRESSION,
} from "./progressionTables.ts";

export type ArmorProficiency = "none" | "light" | "medium" | "heavy" | "shield";
export type WeaponProficiency = "simple" | "martial" | "finesse" | "ranged";

export interface ClassDef {
  id: string;
  displayName: string;
  baseStats: UnitStats;
  hitDieSize: number;
  actionIds: string[];
  startingItems: string[];
  /**
   * Spell slots this class refreshes each Long Rest (#118). Spell-slot actions consume these;
   * cantrips and martial actions remain unlimited. Non-casters omit this (treated as 0).
   */
  spellSlotsMax?: number;
  /**
   * Background assigned to this class on the Quick Start path so a one-click party is still
   * complete and flavored (maintainer decision, #53). Custom setup defaults to this too but
   * the player may change it or pick "none".
   */
  defaultBackgroundId: string;
  /** Primary ability score driving attack/spell DCs for this class (e.g. "str" for Guardian). */
  primaryAbility?: keyof UnitStats;
  /** Exactly two saving throw proficiencies (5E-style). */
  savingThrowProficiencies?: [keyof UnitStats, keyof UnitStats];
  /** Armor types this class is trained to wear. */
  armorProficiencies?: ArmorProficiency[];
  /** Weapon categories this class is trained to use. */
  weaponProficiencies?: WeaponProficiency[];
  /** Ability score used for spellcasting (casters only). */
  spellcastingAbility?: keyof UnitStats;
  /** True for classes that recover spell slots on a Short Rest (Warlock-style). */
  pactMagic?: boolean;
  /** Sorcery Point pool refreshed each Long Rest (Sorcerer only). */
  sorceryPointsMax?: number;
  /** Ki point pool restored on Short Rest (Monk only). */
  kiPointsMax?: number;
  /** Per-level progression data: stat gains, features granted, spell slots. */
  progressionTable: ClassProgressionTable;
}

export const CLASS_REGISTRY: Record<string, ClassDef> = {
  "class.guardian": {
    id: "class.guardian",
    displayName: "Guardian",
    baseStats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 2, int: 0, wis: 0, cha: 1 },
    hitDieSize: 10,
    actionIds: ["action.slash", "action.shield_bash", "action.guard"],
    startingItems: ["item.iron_sword", "item.wooden_shield"],
    defaultBackgroundId: "background.caravan_guard",
    primaryAbility: "str",
    savingThrowProficiencies: ["str", "con"],
    armorProficiencies: ["light", "medium", "heavy", "shield"],
    weaponProficiencies: ["simple", "martial"],
    progressionTable: GUARDIAN_PROGRESSION,
  },
  "class.acolyte": {
    id: "class.acolyte",
    displayName: "Acolyte",
    baseStats: { maxHp: 14, armor: 12, move: 3, str: 1, dex: 1, con: 1, int: 0, wis: 3, cha: 1 },
    hitDieSize: 8,
    actionIds: ["action.mace_strike", "action.mend_wounds", "action.bless"],
    startingItems: ["item.padded_armor"],
    spellSlotsMax: 2,
    defaultBackgroundId: "background.field_medic",
    primaryAbility: "wis",
    savingThrowProficiencies: ["wis", "cha"],
    armorProficiencies: ["light", "medium", "shield"],
    weaponProficiencies: ["simple"],
    spellcastingAbility: "wis",
    progressionTable: ACOLYTE_PROGRESSION,
  },
  "class.arcanist": {
    id: "class.arcanist",
    displayName: "Arcanist",
    baseStats: { maxHp: 11, armor: 11, move: 3, str: 0, dex: 1, con: 0, int: 4, wis: 0, cha: 1 },
    hitDieSize: 6,
    actionIds: ["action.fire_bolt", "action.frost_shard", "action.arcane_ward"],
    startingItems: ["item.apprentice_wand"],
    spellSlotsMax: 2,
    defaultBackgroundId: "background.hedge_scholar",
    primaryAbility: "int",
    savingThrowProficiencies: ["int", "wis"],
    armorProficiencies: ["none"],
    weaponProficiencies: ["simple"],
    spellcastingAbility: "int",
    progressionTable: ARCANIST_PROGRESSION,
  },
  "class.scout": {
    id: "class.scout",
    displayName: "Scout",
    baseStats: { maxHp: 13, armor: 13, move: 4, str: 1, dex: 3, con: 1, int: 0, wis: 0, cha: 1 },
    hitDieSize: 8,
    actionIds: ["action.precise_stab", "action.shortbow_shot", "action.cunning_step"],
    startingItems: ["item.fine_dagger"],
    defaultBackgroundId: "background.cutpurse",
    primaryAbility: "dex",
    savingThrowProficiencies: ["dex", "int"],
    armorProficiencies: ["light"],
    weaponProficiencies: ["simple", "martial", "finesse", "ranged"],
    progressionTable: SCOUT_PROGRESSION,
  },
  "class.fighter": {
    id: "class.fighter",
    displayName: "Fighter",
    baseStats: { maxHp: 17, armor: 14, move: 3, str: 3, dex: 1, con: 2, int: 1, wis: 1, cha: 1 },
    hitDieSize: 10,
    actionIds: ["action.fighter.precise_strike", "action.fighter.ranged_shot", "action.fighter.brace"],
    startingItems: ["item.iron_sword"],
    defaultBackgroundId: "background.caravan_guard",
    primaryAbility: "str",
    savingThrowProficiencies: ["str", "con"],
    armorProficiencies: ["light", "medium", "heavy", "shield"],
    weaponProficiencies: ["simple", "martial"],
    progressionTable: FIGHTER_PROGRESSION,
  },
  "class.rogue": {
    id: "class.rogue",
    displayName: "Rogue",
    baseStats: { maxHp: 13, armor: 13, move: 4, str: 1, dex: 3, con: 1, int: 2, wis: 1, cha: 1 },
    hitDieSize: 8,
    actionIds: ["action.rogue.sneak_stab", "action.rogue.shortbow_shot", "action.rogue.disengage_dash"],
    startingItems: ["item.fine_dagger"],
    defaultBackgroundId: "background.cutpurse",
    primaryAbility: "dex",
    savingThrowProficiencies: ["dex", "int"],
    armorProficiencies: ["light"],
    weaponProficiencies: ["simple", "finesse", "ranged"],
    progressionTable: ROGUE_PROGRESSION,
  },
  "class.cleric": {
    id: "class.cleric",
    displayName: "Cleric",
    baseStats: { maxHp: 14, armor: 13, move: 3, str: 1, dex: 1, con: 2, int: 1, wis: 3, cha: 1 },
    hitDieSize: 8,
    actionIds: ["action.cleric.sacred_flame", "action.cleric.healing_word", "action.cleric.channel_divinity"],
    startingItems: [],
    spellSlotsMax: 2,
    defaultBackgroundId: "background.field_medic",
    primaryAbility: "wis",
    savingThrowProficiencies: ["wis", "cha"],
    armorProficiencies: ["light", "medium", "shield"],
    weaponProficiencies: ["simple"],
    spellcastingAbility: "wis",
    progressionTable: CLERIC_PROGRESSION,
  },
  "class.wizard": {
    id: "class.wizard",
    displayName: "Wizard",
    baseStats: { maxHp: 11, armor: 11, move: 3, str: 1, dex: 1, con: 1, int: 4, wis: 1, cha: 1 },
    hitDieSize: 6,
    actionIds: ["action.wizard.fire_bolt", "action.wizard.magic_missile", "action.wizard.mage_armor"],
    startingItems: [],
    spellSlotsMax: 2,
    defaultBackgroundId: "background.hedge_scholar",
    primaryAbility: "int",
    savingThrowProficiencies: ["int", "wis"],
    armorProficiencies: ["none"],
    weaponProficiencies: ["simple"],
    spellcastingAbility: "int",
    progressionTable: WIZARD_PROGRESSION,
  },
  "class.ranger": {
    id: "class.ranger",
    displayName: "Ranger",
    baseStats: { maxHp: 14, armor: 13, move: 4, str: 1, dex: 3, con: 1, int: 1, wis: 2, cha: 1 },
    hitDieSize: 10,
    actionIds: ["action.ranger.hunters_mark", "action.ranger.volley", "action.ranger.ensnaring_strike"],
    startingItems: [],
    spellSlotsMax: 1,
    defaultBackgroundId: "background.caravan_guard",
    primaryAbility: "dex",
    savingThrowProficiencies: ["str", "dex"],
    armorProficiencies: ["light", "medium"],
    weaponProficiencies: ["simple", "martial", "ranged"],
    spellcastingAbility: "wis",
    progressionTable: RANGER_PROGRESSION,
  },
  "class.druid": {
    id: "class.druid",
    displayName: "Druid",
    baseStats: { maxHp: 13, armor: 12, move: 3, str: 1, dex: 1, con: 1, int: 1, wis: 3, cha: 2 },
    hitDieSize: 8,
    actionIds: ["action.druid.shillelagh", "action.druid.thunderwave", "action.druid.healing_rune"],
    startingItems: [],
    spellSlotsMax: 2,
    defaultBackgroundId: "background.field_medic",
    primaryAbility: "wis",
    savingThrowProficiencies: ["int", "wis"],
    armorProficiencies: ["light", "medium"],
    weaponProficiencies: ["simple"],
    spellcastingAbility: "wis",
    progressionTable: DRUID_PROGRESSION,
  },
  "class.bard": {
    id: "class.bard",
    displayName: "Bard",
    baseStats: { maxHp: 13, armor: 12, move: 3, str: 1, dex: 2, con: 1, int: 1, wis: 1, cha: 3 },
    hitDieSize: 8,
    actionIds: ["action.bard.vicious_mockery", "action.bard.inspiration", "action.bard.healing_song"],
    startingItems: [],
    spellSlotsMax: 2,
    defaultBackgroundId: "background.field_medic",
    primaryAbility: "cha",
    savingThrowProficiencies: ["dex", "cha"],
    armorProficiencies: ["light"],
    weaponProficiencies: ["simple", "ranged"],
    spellcastingAbility: "cha",
    progressionTable: BARD_PROGRESSION,
  },
  "class.warlock": {
    id: "class.warlock",
    displayName: "Warlock",
    baseStats: { maxHp: 13, armor: 12, move: 3, str: 1, dex: 1, con: 1, int: 1, wis: 2, cha: 3 },
    hitDieSize: 8,
    actionIds: ["action.warlock.eldritch_blast", "action.warlock.hex", "action.warlock.armor_of_agathys"],
    startingItems: [],
    spellSlotsMax: 1,
    pactMagic: true,
    defaultBackgroundId: "background.hedge_scholar",
    primaryAbility: "cha",
    savingThrowProficiencies: ["wis", "cha"],
    armorProficiencies: ["light"],
    weaponProficiencies: ["simple"],
    spellcastingAbility: "cha",
    progressionTable: WARLOCK_PROGRESSION,
  },
  "class.sorcerer": {
    id: "class.sorcerer",
    displayName: "Sorcerer",
    baseStats: { maxHp: 11, armor: 11, move: 3, str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 4 },
    hitDieSize: 6,
    actionIds: ["action.sorcerer.chromatic_orb", "action.sorcerer.twin_bolt", "action.sorcerer.wild_surge"],
    startingItems: [],
    spellSlotsMax: 2,
    sorceryPointsMax: 2,
    defaultBackgroundId: "background.hedge_scholar",
    primaryAbility: "cha",
    savingThrowProficiencies: ["con", "cha"],
    armorProficiencies: ["none"],
    weaponProficiencies: ["simple"],
    spellcastingAbility: "cha",
    progressionTable: SORCERER_PROGRESSION,
  },
  "class.paladin": {
    id: "class.paladin",
    displayName: "Paladin",
    baseStats: { maxHp: 16, armor: 15, move: 3, str: 3, dex: 1, con: 2, int: 1, wis: 1, cha: 2 },
    hitDieSize: 10,
    actionIds: ["action.paladin.divine_smite", "action.paladin.lay_on_hands", "action.paladin.sacred_weapon"],
    startingItems: [],
    spellSlotsMax: 1,
    defaultBackgroundId: "background.caravan_guard",
    primaryAbility: "str",
    savingThrowProficiencies: ["wis", "cha"],
    armorProficiencies: ["light", "medium", "heavy", "shield"],
    weaponProficiencies: ["simple", "martial"],
    spellcastingAbility: "cha",
    progressionTable: PALADIN_PROGRESSION,
  },
  "class.barbarian": {
    id: "class.barbarian",
    displayName: "Barbarian",
    baseStats: { maxHp: 19, armor: 13, move: 4, str: 4, dex: 1, con: 3, int: 1, wis: 1, cha: 1 },
    hitDieSize: 12,
    actionIds: ["action.barbarian.rage", "action.barbarian.reckless_attack", "action.barbarian.brutal_strike"],
    startingItems: [],
    defaultBackgroundId: "background.caravan_guard",
    primaryAbility: "str",
    savingThrowProficiencies: ["str", "con"],
    armorProficiencies: ["light", "medium"],
    weaponProficiencies: ["simple", "martial"],
    progressionTable: BARBARIAN_PROGRESSION,
  },
  "class.monk": {
    id: "class.monk",
    displayName: "Monk",
    baseStats: { maxHp: 13, armor: 14, move: 4, str: 1, dex: 3, con: 1, int: 1, wis: 3, cha: 1 },
    hitDieSize: 8,
    actionIds: ["action.monk.flurry_of_blows", "action.monk.stunning_strike", "action.monk.step_of_wind"],
    startingItems: [],
    defaultBackgroundId: "background.caravan_guard",
    primaryAbility: "dex",
    savingThrowProficiencies: ["str", "dex"],
    armorProficiencies: ["none"],
    weaponProficiencies: ["simple"],
    kiPointsMax: 2,
    progressionTable: MONK_PROGRESSION,
  },
};

export const HERO_DEFAULT_NAMES: Record<string, string> = {
  "class.guardian": "Mara",
  "class.acolyte": "Sable",
  "class.arcanist": "Eldra",
  "class.scout": "Nyx",
  "class.fighter": "Brant",
  "class.rogue": "Vesper",
  "class.cleric": "Solenne",
  "class.wizard": "Lyra",
  "class.ranger": "Kael",
  "class.druid": "Fern",
  "class.bard": "Lyric",
  "class.warlock": "Vex",
  "class.sorcerer": "Zara",
  "class.paladin": "Vael",
  "class.barbarian": "Krag",
  "class.monk": "Zhen",
};
