import type { AbilityKey } from "./abilities.ts";
import {
  ARCHETYPE_PASSIVE_SHIELDBEARER_ADJACENCY_ARMOR,
  ARCHETYPE_PASSIVE_VINDICATOR_BELOW_50_ATTACK,
  ARCHETYPE_PASSIVE_BEACON_SAVE_AURA,
  ARCHETYPE_PASSIVE_CLOISTERED_HEAL_BONUS,
  ARCHETYPE_PASSIVE_EVOKER_CRIT_FLOOR,
  ARCHETYPE_PASSIVE_ENCHANTER_ATTACK_DEBUFF_AURA,
} from "./archetypes.ts";

export type PassiveEffect =
  | { type: "armorBonus"; amount: number; condition: "adjacentAlly" | "always" }
  | { type: "critRangeExpansion"; expandBy: number }
  | { type: "damageBonus"; amount: number; condition: "below50Pct" | "always" }
  | { type: "extraAttack" }
  | { type: "resistance"; damageTypes: string[] }
  | { type: "healBonus"; amount: number; addStat?: AbilityKey; condition: "always" }
  | { type: "saveAura"; bonus: number; radius: number; condition: "adjacentAlly" }
  | { type: "attackPenaltyAura"; penalty: number; appliesTo: "enemies" }
  | { type: "statCheckBonus"; bonus: number }
  | { type: "superiorityDice"; dieSize: number; count: number }
  | { type: "halfDamageOnHit" }
  | { type: "evasion" }
  | { type: "climbCostReduction" }
  | { type: "firstAttackBonusDice"; dice: string; condition: "targetAtFullHp" }
  | { type: "spellSlotBonus"; amount: number }
  | { type: "actionChargeBonus"; actionId: string; amount: number }
  | { type: "bonusAttackAfterCantrip"; usesPerCombat: number };

export interface PassiveDef {
  id: string;
  displayName: string;
  description: string;
  effect: PassiveEffect;
}

export const PASSIVE_REGISTRY: Record<string, PassiveDef> = {
  [ARCHETYPE_PASSIVE_SHIELDBEARER_ADJACENCY_ARMOR]: {
    id: ARCHETYPE_PASSIVE_SHIELDBEARER_ADJACENCY_ARMOR,
    displayName: "Shoulder-to-Shoulder",
    description: "Gain +2 Armor while an ally stands adjacent.",
    effect: { type: "armorBonus", amount: 2, condition: "adjacentAlly" },
  },
  [ARCHETYPE_PASSIVE_VINDICATOR_BELOW_50_ATTACK]: {
    id: ARCHETYPE_PASSIVE_VINDICATOR_BELOW_50_ATTACK,
    displayName: "Wounded Fury",
    description: "Deal +2 to attack rolls while below 50% HP.",
    effect: { type: "damageBonus", amount: 2, condition: "below50Pct" },
  },
  [ARCHETYPE_PASSIVE_BEACON_SAVE_AURA]: {
    id: ARCHETYPE_PASSIVE_BEACON_SAVE_AURA,
    displayName: "Radiant Aura",
    description: "Allies within 1 hex gain +1 to saving throws.",
    effect: { type: "saveAura", bonus: 1, radius: 1, condition: "adjacentAlly" },
  },
  [ARCHETYPE_PASSIVE_CLOISTERED_HEAL_BONUS]: {
    id: ARCHETYPE_PASSIVE_CLOISTERED_HEAL_BONUS,
    displayName: "Enhanced Healing",
    description: "All healing actions restore +2 additional HP.",
    effect: { type: "healBonus", amount: 2, condition: "always" },
  },
  [ARCHETYPE_PASSIVE_EVOKER_CRIT_FLOOR]: {
    id: ARCHETYPE_PASSIVE_EVOKER_CRIT_FLOOR,
    displayName: "Empowered Strikes",
    description: "Critical hits on 19 or 20 instead of only 20.",
    effect: { type: "critRangeExpansion", expandBy: 1 },
  },
  [ARCHETYPE_PASSIVE_ENCHANTER_ATTACK_DEBUFF_AURA]: {
    id: ARCHETYPE_PASSIVE_ENCHANTER_ATTACK_DEBUFF_AURA,
    displayName: "Weakening Presence",
    description: "Enemies suffer -1 to attack rolls while any ally carries this aura.",
    effect: { type: "attackPenaltyAura", penalty: 1, appliesTo: "enemies" },
  },
  "archetype_passive.shieldbearer_unyielding": {
    id: "archetype_passive.shieldbearer_unyielding",
    displayName: "Unyielding",
    description: "Reduce incoming damage by 1 while you have at least 1 Armor.",
    effect: { type: "armorBonus", amount: 1, condition: "always" },
  },
  "passive.extra_attack": {
    id: "passive.extra_attack",
    displayName: "Extra Attack",
    description: "You can attack twice whenever you take the Attack action on your turn.",
    effect: { type: "extraAttack" },
  },
  "passive.fighter.improved_critical": {
    id: "passive.fighter.improved_critical",
    displayName: "Improved Critical",
    description: "Your weapon attacks score a critical hit on a roll of 19 or 20.",
    effect: { type: "critRangeExpansion", expandBy: 1 },
  },
  "passive.fighter.remarkable_athlete": {
    id: "passive.fighter.remarkable_athlete",
    displayName: "Remarkable Athlete",
    description: "+1 bonus to all Strength, Dexterity, and Constitution checks.",
    effect: { type: "statCheckBonus", bonus: 1 },
  },
  "passive.fighter.combat_superiority": {
    id: "passive.fighter.combat_superiority",
    displayName: "Combat Superiority",
    description: "You have a pool of 3 superiority dice (d8). Spend one die to fuel combat maneuvers.",
    effect: { type: "superiorityDice", dieSize: 8, count: 3 },
  },
  "passive.uncanny_dodge": {
    id: "passive.uncanny_dodge",
    displayName: "Uncanny Dodge",
    description: "When struck by an attacker you can see, halve the incoming damage once per round.",
    effect: { type: "halfDamageOnHit" },
  },
  "passive.evasion": {
    id: "passive.evasion",
    displayName: "Evasion",
    description: "When an AoE effect allows a DEX save, you take no damage on a success and half on a failure.",
    effect: { type: "evasion" },
  },
  "passive.rogue.second_story_work": {
    id: "passive.rogue.second_story_work",
    displayName: "Second-Story Work",
    description: "Climbing costs no extra movement — traverse elevated terrain without penalty.",
    effect: { type: "climbCostReduction" },
  },
  "passive.rogue.assassinate": {
    id: "passive.rogue.assassinate",
    displayName: "Assassinate",
    description: "Your first attack each combat against a target at full HP deals +2d6 bonus damage.",
    effect: { type: "firstAttackBonusDice", dice: "2d6", condition: "targetAtFullHp" },
  },
  "passive.cleric.extra_slot_l2": {
    id: "passive.cleric.extra_slot_l2",
    displayName: "Expanded Channels (L2)",
    description: "Grants one additional spell slot per Long Rest.",
    effect: { type: "spellSlotBonus", amount: 1 },
  },
  "passive.cleric.extra_slot_l5": {
    id: "passive.cleric.extra_slot_l5",
    displayName: "Expanded Channels (L5)",
    description: "Grants one additional spell slot per Long Rest.",
    effect: { type: "spellSlotBonus", amount: 1 },
  },
  "passive.cleric.improved_channel": {
    id: "passive.cleric.improved_channel",
    displayName: "Improved Channel Divinity",
    description: "Channel Divinity can be used twice per combat instead of once.",
    effect: { type: "actionChargeBonus", actionId: "action.cleric.channel_divinity", amount: 1 },
  },
  "passive.cleric.disciple_of_life": {
    id: "passive.cleric.disciple_of_life",
    displayName: "Disciple of Life",
    description: "Your healing spells restore +2 additional HP, plus your Wisdom modifier.",
    effect: { type: "healBonus", amount: 2, addStat: "wis", condition: "always" },
  },
  "passive.cleric.war_priest": {
    id: "passive.cleric.war_priest",
    displayName: "War Priest",
    description: "Twice per combat, you may make a weapon attack as a bonus action after casting a cantrip.",
    effect: { type: "bonusAttackAfterCantrip", usesPerCombat: 2 },
  },
};
