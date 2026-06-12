import type { UnitStats } from "../state/types.ts";

export interface LevelEntry {
  level: number;
  /** Proficiency bonus at this level (+2 for L1-4, +3 at L5). */
  proficiencyBonus: number;
  /** Spell slots available per spell level; index = spell level - 1, value = slot count. */
  spellSlotsPerLevel?: number[];
  /** Passive/feature IDs automatically added to PartyMember.passives on reaching this level. */
  featuresGranted?: string[];
  /** Automatic stat increases applied on top of level-up choice (added to bonusStats). */
  statGain?: Partial<UnitStats>;
}

export type ClassProgressionTable = LevelEntry[];

export const GUARDIAN_PROGRESSION: ClassProgressionTable = [
  { level: 1, proficiencyBonus: 2 },
  { level: 2, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
  { level: 3, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
  { level: 4, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
  { level: 5, proficiencyBonus: 3, statGain: { maxHp: 2, str: 1 } },
];

export const ACOLYTE_PROGRESSION: ClassProgressionTable = [
  { level: 1, proficiencyBonus: 2 },
  { level: 2, proficiencyBonus: 2, statGain: { maxHp: 1, wis: 1 } },
  { level: 3, proficiencyBonus: 2, statGain: { maxHp: 1, wis: 1 } },
  { level: 4, proficiencyBonus: 2, statGain: { maxHp: 1, wis: 1 } },
  { level: 5, proficiencyBonus: 3, statGain: { maxHp: 1, wis: 1 } },
];

export const ARCANIST_PROGRESSION: ClassProgressionTable = [
  { level: 1, proficiencyBonus: 2 },
  { level: 2, proficiencyBonus: 2, statGain: { maxHp: 1, int: 1 } },
  { level: 3, proficiencyBonus: 2, statGain: { maxHp: 1, int: 1 } },
  { level: 4, proficiencyBonus: 2, statGain: { maxHp: 1, int: 1 } },
  { level: 5, proficiencyBonus: 3, statGain: { maxHp: 1, int: 1 } },
];

export const SCOUT_PROGRESSION: ClassProgressionTable = [
  { level: 1, proficiencyBonus: 2 },
  { level: 2, proficiencyBonus: 2, statGain: { maxHp: 1, dex: 1 } },
  { level: 3, proficiencyBonus: 2, statGain: { maxHp: 1, dex: 1 } },
  { level: 4, proficiencyBonus: 2, statGain: { maxHp: 1, dex: 1 } },
  { level: 5, proficiencyBonus: 3, statGain: { maxHp: 1, dex: 1 } },
];

export const FIGHTER_PROGRESSION: ClassProgressionTable = [
  { level: 1, proficiencyBonus: 2 },
  { level: 2, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
  { level: 3, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
  { level: 4, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
  { level: 5, proficiencyBonus: 3, statGain: { maxHp: 2, str: 1 }, featuresGranted: ["passive.extra_attack"] },
];

export const ROGUE_PROGRESSION: ClassProgressionTable = [
  { level: 1, proficiencyBonus: 2 },
  { level: 2, proficiencyBonus: 2, statGain: { maxHp: 1, dex: 1 } },
  { level: 3, proficiencyBonus: 2, statGain: { maxHp: 1, dex: 1 } },
  { level: 4, proficiencyBonus: 2, statGain: { maxHp: 1, dex: 1 }, featuresGranted: ["passive.uncanny_dodge"] },
  { level: 5, proficiencyBonus: 3, statGain: { maxHp: 1, dex: 1 }, featuresGranted: ["passive.evasion"] },
];

export const CLERIC_PROGRESSION: ClassProgressionTable = [
  { level: 1, proficiencyBonus: 2 },
  { level: 2, proficiencyBonus: 2, statGain: { maxHp: 1, wis: 1 }, featuresGranted: ["passive.cleric.extra_slot_l2"] },
  { level: 3, proficiencyBonus: 2, statGain: { maxHp: 1, wis: 1 } },
  { level: 4, proficiencyBonus: 2, statGain: { maxHp: 1, wis: 1 } },
  { level: 5, proficiencyBonus: 3, statGain: { maxHp: 1, wis: 1 }, featuresGranted: ["passive.cleric.extra_slot_l5"] },
];

export const WIZARD_PROGRESSION: ClassProgressionTable = [
  { level: 1, proficiencyBonus: 2 },
  { level: 2, proficiencyBonus: 2, statGain: { maxHp: 1, int: 1 }, featuresGranted: ["passive.wizard.arcane_recovery"] },
  { level: 3, proficiencyBonus: 2, statGain: { maxHp: 1, int: 1 } },
  { level: 4, proficiencyBonus: 2, statGain: { maxHp: 1, int: 1 } },
  { level: 5, proficiencyBonus: 3, statGain: { maxHp: 1, int: 1 }, featuresGranted: ["passive.wizard.extra_slot_l5"] },
];

export const RANGER_PROGRESSION: ClassProgressionTable = [
  { level: 1, proficiencyBonus: 2 },
  { level: 2, proficiencyBonus: 2, statGain: { maxHp: 2, dex: 1 } },
  { level: 3, proficiencyBonus: 2, statGain: { maxHp: 2, dex: 1 } },
  { level: 4, proficiencyBonus: 2, statGain: { maxHp: 2, dex: 1 } },
  { level: 5, proficiencyBonus: 3, statGain: { maxHp: 2, dex: 1 }, featuresGranted: ["passive.extra_attack"] },
];
