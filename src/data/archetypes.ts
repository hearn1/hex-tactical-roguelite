export const ARCHETYPE_PASSIVE_SHIELDBEARER_ADJACENCY_ARMOR = "archetype_passive.shieldbearer_adjacency_armor";
export const ARCHETYPE_PASSIVE_VINDICATOR_BELOW_50_ATTACK = "archetype_passive.vindicator_below_50_attack";
export const ARCHETYPE_PASSIVE_BEACON_SAVE_AURA = "archetype_passive.beacon_save_aura";
export const ARCHETYPE_PASSIVE_CLOISTERED_HEAL_BONUS = "archetype_passive.cloistered_heal_bonus";
export const ARCHETYPE_PASSIVE_EVOKER_CRIT_FLOOR = "archetype_passive.evoker_crit_floor";
export const ARCHETYPE_PASSIVE_ENCHANTER_ATTACK_DEBUFF_AURA = "archetype_passive.enchanter_attack_debuff_aura";

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
}

export const ARCHETYPE_REGISTRY: Record<string, ArchetypeDef> = {
  "archetype.guardian.shieldbearer": {
    id: "archetype.guardian.shieldbearer",
    displayName: "Shieldbearer",
    classId: "class.guardian",
    description: "Taunt enemies into targeting you and gain Armor when fighting shoulder-to-shoulder.",
    grantedActionId: "action.archetype_taunt",
    passiveId: ARCHETYPE_PASSIVE_SHIELDBEARER_ADJACENCY_ARMOR,
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
};

/** Archetypes available for a given class. */
export function archetypesByClass(classId: string): ArchetypeDef[] {
  return Object.values(ARCHETYPE_REGISTRY).filter((a) => a.classId === classId);
}
