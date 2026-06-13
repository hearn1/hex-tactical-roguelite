import type { LevelUpOption } from "./levelups.ts";

export const ARCHETYPE_PASSIVE_WIZARD_SCULPT_SPELLS = "passive.wizard.sculpt_spells";
export const ARCHETYPE_PASSIVE_WIZARD_WARD_REGAIN = "passive.wizard.ward_regain";
export const ARCHETYPE_PASSIVE_RANGER_COLOSSUS_SLAYER = "passive.ranger.colossus_slayer";
export const ARCHETYPE_PASSIVE_RANGER_DREAD_AMBUSHER = "passive.ranger.dread_ambusher";
export const ARCHETYPE_PASSIVE_DRUID_COMBAT_WILD_SHAPE = "passive.druid.combat_wild_shape";
export const ARCHETYPE_PASSIVE_DRUID_NATURAL_RECOVERY = "passive.druid.natural_recovery";
export const ARCHETYPE_PASSIVE_BARD_ADDITIONAL_MAGICAL_SECRETS = "passive.bard.additional_magical_secrets";
export const ARCHETYPE_PASSIVE_BARD_COMBAT_INSPIRATION = "passive.bard.combat_inspiration";
export const ARCHETYPE_PASSIVE_WARLOCK_DARK_ONES_BLESSING = "passive.warlock.dark_ones_blessing";
export const ARCHETYPE_PASSIVE_WARLOCK_AWAKENED_MIND = "passive.warlock.awakened_mind";
export const ARCHETYPE_PASSIVE_PALADIN_DEVOTION_AURA = "passive.paladin.devotion_aura";
export const ARCHETYPE_PASSIVE_PALADIN_RELENTLESS_AVENGER = "passive.paladin.relentless_avenger";
export const ARCHETYPE_PASSIVE_BARBARIAN_FRENZY = "passive.barbarian.frenzy";
export const ARCHETYPE_PASSIVE_BARBARIAN_BEAR_TOTEM = "passive.barbarian.bear_totem";
export const ARCHETYPE_PASSIVE_SORCERER_DRACONIC_RESILIENCE = "passive.sorcerer.draconic_resilience";
export const ARCHETYPE_PASSIVE_SORCERER_WILD_MAGIC_SURGE = "passive.sorcerer.wild_magic_surge";
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
  "archetype.cleric.life_domain": {
    id: "archetype.cleric.life_domain",
    displayName: "Life Domain",
    classId: "class.cleric",
    chosenAtLevel: 3,
    description: "Blessed healer; all healing spells restore +2+WIS extra HP.",
    grantedActionId: "action.cleric.mass_cure_wounds",
    passiveId: "passive.cleric.disciple_of_life",
  },
  "archetype.cleric.war_domain": {
    id: "archetype.cleric.war_domain",
    displayName: "War Domain",
    classId: "class.cleric",
    chosenAtLevel: 3,
    description: "Blessed warrior; gains Divine Strike and may attack as a bonus action after casting a cantrip.",
    grantedActionId: "action.cleric.divine_strike",
    passiveId: "passive.cleric.war_priest",
  },
  "archetype.wizard.evocation": {
    id: "archetype.wizard.evocation",
    displayName: "School of Evocation",
    classId: "class.wizard",
    chosenAtLevel: 3,
    description: "Sculpts damaging spells to spare allies caught in the blast.",
    passiveId: ARCHETYPE_PASSIVE_WIZARD_SCULPT_SPELLS,
    featuresByHeroLevel: {
      5: { featuresGranted: ["passive.wizard.empowered_evocation"] },
    },
  },
  "archetype.wizard.abjuration": {
    id: "archetype.wizard.abjuration",
    displayName: "School of Abjuration",
    classId: "class.wizard",
    chosenAtLevel: 3,
    description: "Maintains a ward of magical force that absorbs damage and recharges on each spell cast.",
    grantedActionId: "action.wizard.arcane_ward",
    passiveId: ARCHETYPE_PASSIVE_WIZARD_WARD_REGAIN,
  },
  "archetype.ranger.hunter": {
    id: "archetype.ranger.hunter",
    displayName: "Hunter",
    classId: "class.ranger",
    chosenAtLevel: 3,
    description: "Specializes in hunting big prey; deals extra damage to a single marked target.",
    grantedActionId: "action.ranger.hail_of_arrows",
    passiveId: ARCHETYPE_PASSIVE_RANGER_COLOSSUS_SLAYER,
  },
  "archetype.ranger.gloom_stalker": {
    id: "archetype.ranger.gloom_stalker",
    displayName: "Gloom Stalker",
    classId: "class.ranger",
    chosenAtLevel: 3,
    description: "Thrives in darkness; gains a bonus attack on the first round of combat.",
    grantedActionId: "action.ranger.umbral_sight",
    passiveId: ARCHETYPE_PASSIVE_RANGER_DREAD_AMBUSHER,
  },
  "archetype.bard.college_of_lore": {
    id: "archetype.bard.college_of_lore",
    classId: "class.bard",
    chosenAtLevel: 3,
    displayName: "College of Lore",
    description: "Weaves cutting words into battle; steals spell knowledge from other traditions.",
    grantedActionId: "action.bard.cutting_words",
    passiveId: ARCHETYPE_PASSIVE_BARD_ADDITIONAL_MAGICAL_SECRETS,
  },
  "archetype.bard.college_of_valor": {
    id: "archetype.bard.college_of_valor",
    classId: "class.bard",
    chosenAtLevel: 3,
    displayName: "College of Valor",
    description: "Inspires allies mid-battle; Bardic Inspiration adds to damage rolls.",
    passiveId: ARCHETYPE_PASSIVE_BARD_COMBAT_INSPIRATION,
    featuresByHeroLevel: {
      5: { featuresGranted: ["passive.bard.extra_attack"] },
    },
  },
  "archetype.paladin.devotion": {
    id: "archetype.paladin.devotion",
    classId: "class.paladin",
    chosenAtLevel: 3,
    displayName: "Oath of Devotion",
    description: "Pure-hearted champion; aura grants nearby allies +1 to saves.",
    grantedActionId: "action.paladin.holy_nimbus",
    passiveId: ARCHETYPE_PASSIVE_PALADIN_DEVOTION_AURA,
  },
  "archetype.paladin.vengeance": {
    id: "archetype.paladin.vengeance",
    classId: "class.paladin",
    chosenAtLevel: 3,
    displayName: "Oath of Vengeance",
    description: "Relentless hunter; curses prey and pursues them across the battlefield.",
    grantedActionId: "action.paladin.vow_of_enmity",
    passiveId: ARCHETYPE_PASSIVE_PALADIN_RELENTLESS_AVENGER,
  },
  "archetype.barbarian.berserker": {
    id: "archetype.barbarian.berserker",
    classId: "class.barbarian",
    chosenAtLevel: 3,
    displayName: "Path of the Berserker",
    description: "Channels battle madness into a bonus attack while raging; risks exhaustion after combat.",
    grantedActionId: "action.barbarian.frenzied_strike",
    passiveId: ARCHETYPE_PASSIVE_BARBARIAN_FRENZY,
  },
  "archetype.barbarian.totem_bear": {
    id: "archetype.barbarian.totem_bear",
    classId: "class.barbarian",
    chosenAtLevel: 3,
    displayName: "Path of the Totem (Bear)",
    description: "Bears the spirit of the bear; resists all damage types while raging.",
    passiveId: ARCHETYPE_PASSIVE_BARBARIAN_BEAR_TOTEM,
  },
  "archetype.druid.circle_of_moon": {
    id: "archetype.druid.circle_of_moon",
    classId: "class.druid",
    chosenAtLevel: 3,
    displayName: "Circle of the Moon",
    description: "Wild Shape grants greater power and natural armor.",
    passiveId: ARCHETYPE_PASSIVE_DRUID_COMBAT_WILD_SHAPE,
  },
  "archetype.druid.circle_of_land": {
    id: "archetype.druid.circle_of_land",
    classId: "class.druid",
    chosenAtLevel: 3,
    displayName: "Circle of the Land",
    description: "Draws power from the terrain; recovers a spell slot after each combat.",
    grantedActionId: "action.druid.land_stride",
    passiveId: ARCHETYPE_PASSIVE_DRUID_NATURAL_RECOVERY,
  },
  "archetype.warlock.fiend": {
    id: "archetype.warlock.fiend",
    classId: "class.warlock",
    chosenAtLevel: 3,
    displayName: "The Fiend",
    description: "Patron from the lower planes; gains temporary HP when slaying enemies.",
    grantedActionId: "action.warlock.hellish_rebuke",
    passiveId: ARCHETYPE_PASSIVE_WARLOCK_DARK_ONES_BLESSING,
  },
  "archetype.warlock.great_old_one": {
    id: "archetype.warlock.great_old_one",
    classId: "class.warlock",
    chosenAtLevel: 3,
    displayName: "The Great Old One",
    description: "Alien patron grants psychic defenses and unsettling awareness.",
    grantedActionId: "action.warlock.entropic_ward",
    passiveId: ARCHETYPE_PASSIVE_WARLOCK_AWAKENED_MIND,
  },
  "archetype.sorcerer.draconic": {
    id: "archetype.sorcerer.draconic",
    classId: "class.sorcerer",
    chosenAtLevel: 3,
    displayName: "Draconic Bloodline",
    description: "Dragon ancestry toughens the skin and empowers elemental magic.",
    passiveId: ARCHETYPE_PASSIVE_SORCERER_DRACONIC_RESILIENCE,
    featuresByHeroLevel: {
      5: { featuresGranted: ["passive.sorcerer.elemental_affinity"] },
    },
  },
  "archetype.sorcerer.wild_magic": {
    id: "archetype.sorcerer.wild_magic",
    classId: "class.sorcerer",
    chosenAtLevel: 3,
    displayName: "Wild Magic",
    description: "Uncontrolled power surges; spells may trigger random bonus effects.",
    grantedActionId: "action.sorcerer.tides_of_chaos",
    passiveId: ARCHETYPE_PASSIVE_SORCERER_WILD_MAGIC_SURGE,
  },
};

/** Archetypes available for a given class. */
export function archetypesByClass(classId: string): ArchetypeDef[] {
  return Object.values(ARCHETYPE_REGISTRY).filter((a) => a.classId === classId);
}
