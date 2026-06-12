import type { LevelUpOption } from "./levelups.ts";

export const ARCHETYPE_PASSIVE_SHIELDBEARER_ADJACENCY_ARMOR = "archetype_passive.shieldbearer_adjacency_armor";
export const ARCHETYPE_PASSIVE_VINDICATOR_BELOW_50_ATTACK = "archetype_passive.vindicator_below_50_attack";
export const ARCHETYPE_PASSIVE_BEACON_SAVE_AURA = "archetype_passive.beacon_save_aura";
export const ARCHETYPE_PASSIVE_CLOISTERED_HEAL_BONUS = "archetype_passive.cloistered_heal_bonus";
export const ARCHETYPE_PASSIVE_EVOKER_CRIT_FLOOR = "archetype_passive.evoker_crit_floor";
export const ARCHETYPE_PASSIVE_ENCHANTER_ATTACK_DEBUFF_AURA = "archetype_passive.enchanter_attack_debuff_aura";

export interface ArchetypeHeroLevelEntry {
  /** Passive IDs auto-applied when the hero reaches this level. */
  featuresGranted?: string[];
  /** Optional interactive choice offered at this level (in addition to any auto-grants). */
  choiceOffered?: LevelUpOption;
}

export interface ArchetypeDef {
  id: string;
  displayName: string;
  classId: string;
  description: string;
  /** Action this archetype grants to the unit's action bar. */
  grantedActionId?: string;
  /** Passive id checked by the combat engine for conditional/aura effects. */
  passiveId?: string;
  /** Hero level at which the archetype selection is presented. Defaults to 3. */
  chosenAtLevel?: number;
  /** Per-level feature grants and optional choices unlocked after the archetype is chosen. */
  featuresByHeroLevel?: Record<number, ArchetypeHeroLevelEntry>;
}

export const ARCHETYPE_REGISTRY: Record<string, ArchetypeDef> = {
  "archetype.guardian.shieldbearer": {
    id: "archetype.guardian.shieldbearer",
    displayName: "Shieldbearer",
    classId: "class.guardian",
    description: "Taunt enemies into targeting you and gain Armor when fighting shoulder-to-shoulder.",
    grantedActionId: "action.archetype_taunt",
    passiveId: ARCHETYPE_PASSIVE_SHIELDBEARER_ADJACENCY_ARMOR,
    featuresByHeroLevel: {
      5: { featuresGranted: ["archetype_passive.shieldbearer_unyielding"] },
    },
  },
  "archetype.guardian.vindicator": {
    id: "archetype.guardian.vindicator",
    displayName: "Vindicator",
    classId: "class.guardian",
    description: "Strike back when hit and fight harder when wounded.",
    grantedActionId: "action.archetype_retributive_strike",
    passiveId: ARCHETYPE_PASSIVE_VINDICATOR_BELOW_50_ATTACK,
  },
  "archetype.acolyte.beacon": {
    id: "archetype.acolyte.beacon",
    displayName: "Beacon",
    classId: "class.acolyte",
    description: "Radiant healing burst and an aura that fortifies saves for allies.",
    grantedActionId: "action.archetype_healing_burst",
    passiveId: ARCHETYPE_PASSIVE_BEACON_SAVE_AURA,
  },
  "archetype.acolyte.cloistered": {
    id: "archetype.acolyte.cloistered",
    displayName: "Cloistered",
    classId: "class.acolyte",
    description: "Ward allies and enhance all healing magic.",
    grantedActionId: "action.archetype_protective_ward",
    passiveId: ARCHETYPE_PASSIVE_CLOISTERED_HEAL_BONUS,
  },
  "archetype.arcanist.evoker": {
    id: "archetype.arcanist.evoker",
    displayName: "Evoker",
    classId: "class.arcanist",
    description: "Empower spells and strike with devastating criticals on 19-20.",
    grantedActionId: "action.archetype_empowered_spell",
    passiveId: ARCHETYPE_PASSIVE_EVOKER_CRIT_FLOOR,
  },
  "archetype.arcanist.enchanter": {
    id: "archetype.arcanist.enchanter",
    displayName: "Enchanter",
    classId: "class.arcanist",
    description: "Mesmerize foes and weaken enemy attacks against allies.",
    grantedActionId: "action.archetype_mesmerize",
    passiveId: ARCHETYPE_PASSIVE_ENCHANTER_ATTACK_DEBUFF_AURA,
  },
  "archetype.fighter.champion": {
    id: "archetype.fighter.champion",
    displayName: "Champion",
    classId: "class.fighter",
    chosenAtLevel: 3,
    description: "Hones physical prowess to perfection; crits on 19-20.",
    passiveId: "passive.fighter.improved_critical",
    featuresByHeroLevel: {
      5: { featuresGranted: ["passive.fighter.remarkable_athlete"] },
    },
  },
  "archetype.fighter.battle_master": {
    id: "archetype.fighter.battle_master",
    displayName: "Battle Master",
    classId: "class.fighter",
    chosenAtLevel: 3,
    description: "Learns combat maneuvers powered by superiority dice.",
    grantedActionId: "action.fighter.menacing_attack",
    passiveId: "passive.fighter.combat_superiority",
  },
  "archetype.rogue.thief": {
    id: "archetype.rogue.thief",
    displayName: "Thief",
    classId: "class.rogue",
    chosenAtLevel: 3,
    description: "Fast hands and quicker feet; can use an item as a bonus action.",
    grantedActionId: "action.rogue.fast_hands",
    passiveId: "passive.rogue.second_story_work",
  },
  "archetype.rogue.assassin": {
    id: "archetype.rogue.assassin",
    displayName: "Assassin",
    classId: "class.rogue",
    chosenAtLevel: 3,
    description: "Masters of surprise; deals bonus damage against full-HP targets.",
    passiveId: "passive.rogue.assassinate",
  },
};

/** Archetypes available for a given class. */
export function archetypesByClass(classId: string): ArchetypeDef[] {
  return Object.values(ARCHETYPE_REGISTRY).filter((a) => a.classId === classId);
}
