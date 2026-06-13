import type { AbilityKey } from "./abilities.ts";
import {
  ARCHETYPE_PASSIVE_BARBARIAN_FRENZY,
  ARCHETYPE_PASSIVE_BARBARIAN_BEAR_TOTEM,
  ARCHETYPE_PASSIVE_SHIELDBEARER_ADJACENCY_ARMOR,
  ARCHETYPE_PASSIVE_VINDICATOR_BELOW_50_ATTACK,
  ARCHETYPE_PASSIVE_BEACON_SAVE_AURA,
  ARCHETYPE_PASSIVE_CLOISTERED_HEAL_BONUS,
  ARCHETYPE_PASSIVE_EVOKER_CRIT_FLOOR,
  ARCHETYPE_PASSIVE_ENCHANTER_ATTACK_DEBUFF_AURA,
  ARCHETYPE_PASSIVE_RANGER_COLOSSUS_SLAYER,
  ARCHETYPE_PASSIVE_RANGER_DREAD_AMBUSHER,
  ARCHETYPE_PASSIVE_BARD_ADDITIONAL_MAGICAL_SECRETS,
  ARCHETYPE_PASSIVE_BARD_COMBAT_INSPIRATION,
  ARCHETYPE_PASSIVE_WARLOCK_DARK_ONES_BLESSING,
  ARCHETYPE_PASSIVE_WARLOCK_AWAKENED_MIND,
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
  | { type: "bonusAttackAfterCantrip"; usesPerCombat: number }
  | { type: "arcaneRecovery"; slotsPerCombat: number }
  | { type: "sculptSpells" }
  | { type: "empoweredEvocation"; stat: AbilityKey }
  | { type: "arcaneWardRegain"; multiplier: number }
  | { type: "colossusSlayer"; dice: string }
  | { type: "dreadAmbusher"; initiativeBonus: number }
  | { type: "wildShapeGrant"; chargesPerCombat: number }
  | { type: "wildShapeBonus"; acBonus: number; strBonus: number }
  | { type: "naturalRecovery"; slotsAfterCombat: number }
  | { type: "jackOfAllTrades"; bonus: number }
  | { type: "fontOfInspiration" }
  | { type: "combatInspiration" }
  | { type: "onKillTempHp"; stat: AbilityKey }
  | { type: "forceReroll"; usesPerCombat: number }
  | { type: "repellingBlast" }
  | { type: "pactBlade" }
  | { type: "pactTome"; cantripsGranted: number }
  | { type: "relentlessAvenger"; moveBonus: number }
  | { type: "dangerSense" }
  | { type: "frenziedAttack"; usesPerCombat: number }
  | { type: "sorceryPointBonus"; amount: number }
  | { type: "empoweredSpell"; usesPerCast: number }
  | { type: "quickenedSpell"; spCost: number }
  | { type: "heightenedSpell"; spCost: number }
  | { type: "draconicResilience" }
  | { type: "elementalAffinity"; stat: AbilityKey }
  | { type: "wildMagicSurge"; chance: number };

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
  "passive.wizard.arcane_recovery": {
    id: "passive.wizard.arcane_recovery",
    displayName: "Arcane Recovery",
    description: "Once per combat, regain 1 expended spell slot as a free action.",
    effect: { type: "arcaneRecovery", slotsPerCombat: 1 },
  },
  "passive.wizard.extra_slot_l5": {
    id: "passive.wizard.extra_slot_l5",
    displayName: "Arcane Reserves (L5)",
    description: "Grants one additional spell slot per Long Rest.",
    effect: { type: "spellSlotBonus", amount: 1 },
  },
  "passive.wizard.sculpt_spells": {
    id: "passive.wizard.sculpt_spells",
    displayName: "Sculpt Spells",
    description: "Allied targets within an AoE spell automatically succeed the saving throw, taking no damage.",
    effect: { type: "sculptSpells" },
  },
  "passive.wizard.empowered_evocation": {
    id: "passive.wizard.empowered_evocation",
    displayName: "Empowered Evocation",
    description: "Add your Intelligence modifier to one damage roll of any Evocation spell you cast.",
    effect: { type: "empoweredEvocation", stat: "int" },
  },
  "passive.wizard.ward_regain": {
    id: "passive.wizard.ward_regain",
    displayName: "Arcane Ward Regain",
    description: "Your Arcane Ward regains HP equal to twice the spell slot level each time you cast a spell.",
    effect: { type: "arcaneWardRegain", multiplier: 2 },
  },
  "passive.ranger.extra_slot_l5": {
    id: "passive.ranger.extra_slot_l5",
    displayName: "Expanded Spellcasting (L5)",
    description: "Grants one additional spell slot per Long Rest.",
    effect: { type: "spellSlotBonus", amount: 1 },
  },
  [ARCHETYPE_PASSIVE_RANGER_COLOSSUS_SLAYER]: {
    id: ARCHETYPE_PASSIVE_RANGER_COLOSSUS_SLAYER,
    displayName: "Colossus Slayer",
    description: "Once per turn, deal +1d8 bonus damage to a target that is below its maximum HP.",
    effect: { type: "colossusSlayer", dice: "1d8" },
  },
  [ARCHETYPE_PASSIVE_RANGER_DREAD_AMBUSHER]: {
    id: ARCHETYPE_PASSIVE_RANGER_DREAD_AMBUSHER,
    displayName: "Dread Ambusher",
    description: "+1 to initiative. On the first round of combat, make one additional attack.",
    effect: { type: "dreadAmbusher", initiativeBonus: 1 },
  },
  // ── Bard passives ─────────────────────────────────────────────────────
  "passive.jack_of_all_trades": {
    id: "passive.jack_of_all_trades",
    displayName: "Jack of All Trades",
    description: "Add +1 to any ability check you aren't proficient in.",
    effect: { type: "jackOfAllTrades", bonus: 1 },
  },
  "passive.bard.font_of_inspiration": {
    id: "passive.bard.font_of_inspiration",
    displayName: "Font of Inspiration",
    description: "Bardic Inspiration recharges after a short rest (post-combat).",
    effect: { type: "fontOfInspiration" },
  },
  [ARCHETYPE_PASSIVE_BARD_ADDITIONAL_MAGICAL_SECRETS]: {
    id: ARCHETYPE_PASSIVE_BARD_ADDITIONAL_MAGICAL_SECRETS,
    displayName: "Additional Magical Secrets",
    description: "Learn 1 spell from any class list at L3 and L5.",
    effect: { type: "spellSlotBonus", amount: 0 },
  },
  [ARCHETYPE_PASSIVE_BARD_COMBAT_INSPIRATION]: {
    id: ARCHETYPE_PASSIVE_BARD_COMBAT_INSPIRATION,
    displayName: "Combat Inspiration",
    description: "Allies may use Bardic Inspiration to add to a damage roll instead of an attack roll.",
    effect: { type: "combatInspiration" },
  },
  "passive.bard.extra_attack": {
    id: "passive.bard.extra_attack",
    displayName: "Extra Attack (Valor)",
    description: "You can attack twice when you take the Attack action on your turn.",
    effect: { type: "extraAttack" },
  },
  // ── Druid passives ────────────────────────────────────────────────────
  "passive.druid.wild_shape": {
    id: "passive.druid.wild_shape",
    displayName: "Wild Shape",
    description: "Twice per combat, assume a beast form: gain +4 temporary HP and +1 AC for 3 turns.",
    effect: { type: "wildShapeGrant", chargesPerCombat: 2 },
  },
  "passive.druid.extra_slot_l5": {
    id: "passive.druid.extra_slot_l5",
    displayName: "Expanded Spellcasting (L5)",
    description: "Grants one additional spell slot per Long Rest.",
    effect: { type: "spellSlotBonus", amount: 1 },
  },
  "passive.druid.combat_wild_shape": {
    id: "passive.druid.combat_wild_shape",
    displayName: "Combat Wild Shape",
    description: "While Wild Shape is active, gain an additional +2 AC and +2 STR.",
    effect: { type: "wildShapeBonus", acBonus: 2, strBonus: 2 },
  },
  "passive.druid.natural_recovery": {
    id: "passive.druid.natural_recovery",
    displayName: "Natural Recovery",
    description: "After each combat, recover 1 expended spell slot from the land's ambient magic.",
    effect: { type: "naturalRecovery", slotsAfterCombat: 1 },
  },
  // ── Warlock passives ──────────────────────────────────────────────────
  "passive.warlock.extra_pact_slot": {
    id: "passive.warlock.extra_pact_slot",
    displayName: "Expanded Pact Magic (L5)",
    description: "Grants one additional Pact Magic slot that recovers on a Short Rest.",
    effect: { type: "spellSlotBonus", amount: 1 },
  },
  "passive.warlock.agonizing_blast": {
    id: "passive.warlock.agonizing_blast",
    displayName: "Agonizing Blast",
    description: "Add your Charisma modifier to the damage of Eldritch Blast on a hit.",
    effect: { type: "empoweredEvocation", stat: "cha" },
  },
  "passive.warlock.devils_sight": {
    id: "passive.warlock.devils_sight",
    displayName: "Devil's Sight",
    description: "Your patron's dark gift lets you see through magical darkness and ignore stealth penalties. +1 to all skill checks.",
    effect: { type: "statCheckBonus", bonus: 1 },
  },
  "passive.warlock.repelling_blast": {
    id: "passive.warlock.repelling_blast",
    displayName: "Repelling Blast",
    description: "When Eldritch Blast hits, push the target 1 hex away from you.",
    effect: { type: "repellingBlast" },
  },
  "passive.warlock.pact_of_blade": {
    id: "passive.warlock.pact_of_blade",
    displayName: "Pact of the Blade",
    description: "Your patron binds a spectral weapon to your hand; melee attacks draw on your Charisma rather than Strength.",
    effect: { type: "pactBlade" },
  },
  "passive.warlock.pact_of_tome": {
    id: "passive.warlock.pact_of_tome",
    displayName: "Pact of the Tome",
    description: "Your Book of Shadows expands your magical repertoire — learn 2 additional cantrips.",
    effect: { type: "pactTome", cantripsGranted: 2 },
  },
  [ARCHETYPE_PASSIVE_WARLOCK_DARK_ONES_BLESSING]: {
    id: ARCHETYPE_PASSIVE_WARLOCK_DARK_ONES_BLESSING,
    displayName: "Dark One's Blessing",
    description: "On kill, gain temporary HP equal to your Charisma modifier + Warlock level.",
    effect: { type: "onKillTempHp", stat: "cha" },
  },
  [ARCHETYPE_PASSIVE_WARLOCK_AWAKENED_MIND]: {
    id: ARCHETYPE_PASSIVE_WARLOCK_AWAKENED_MIND,
    displayName: "Awakened Mind",
    description: "Once per combat, force an enemy to reroll an attack roll targeting you (psychic interference).",
    effect: { type: "forceReroll", usesPerCombat: 1 },
  },
  // ── Barbarian passives ────────────────────────────────────────────────
  [ARCHETYPE_PASSIVE_BARBARIAN_FRENZY]: {
    id: ARCHETYPE_PASSIVE_BARBARIAN_FRENZY,
    displayName: "Frenzy",
    description: "While raging, make one bonus melee attack per turn. After combat ends, suffer exhaustion (−1 to attack rolls) until a long rest.",
    effect: { type: "frenziedAttack", usesPerCombat: 1 },
  },
  [ARCHETYPE_PASSIVE_BARBARIAN_BEAR_TOTEM]: {
    id: ARCHETYPE_PASSIVE_BARBARIAN_BEAR_TOTEM,
    displayName: "Bear Totem",
    description: "The bear's spirit flows through you — while raging, gain resistance to all damage types.",
    effect: { type: "resistance", damageTypes: ["all"] },
  },
  "passive.barbarian.danger_sense": {
    id: "passive.barbarian.danger_sense",
    displayName: "Danger Sense",
    description: "Your primal instincts alert you to hidden threats — gain advantage on Dexterity saving throws.",
    effect: { type: "dangerSense" },
  },
  "passive.barbarian.extra_rage_l2": {
    id: "passive.barbarian.extra_rage_l2",
    displayName: "Relentless Fury (L2)",
    description: "Your rage burns longer — Rage gains one additional use per combat.",
    effect: { type: "actionChargeBonus", actionId: "action.barbarian.rage", amount: 1 },
  },
  "passive.barbarian.extra_rage_l5": {
    id: "passive.barbarian.extra_rage_l5",
    displayName: "Relentless Fury (L5)",
    description: "Your rage burns longer — Rage gains one additional use per combat.",
    effect: { type: "actionChargeBonus", actionId: "action.barbarian.rage", amount: 1 },
  },
  // ── Paladin passives ──────────────────────────────────────────────────
  "passive.paladin.devotion_aura": {
    id: "passive.paladin.devotion_aura",
    displayName: "Devotion Aura",
    description: "Allies within 2 hexes gain +1 to saving throws.",
    effect: { type: "saveAura", bonus: 1, radius: 2, condition: "adjacentAlly" },
  },
  "passive.paladin.relentless_avenger": {
    id: "passive.paladin.relentless_avenger",
    displayName: "Relentless Avenger",
    description: "When you hit a target cursed by Vow of Enmity, gain +1 movement for the rest of your turn.",
    effect: { type: "relentlessAvenger", moveBonus: 1 },
  },
  "passive.paladin.loh_pool_extended": {
    id: "passive.paladin.loh_pool_extended",
    displayName: "Expanded Lay on Hands",
    description: "Your Lay on Hands pool grows — gain one additional use.",
    effect: { type: "actionChargeBonus", actionId: "action.paladin.lay_on_hands", amount: 1 },
  },
  "passive.paladin.extra_slot_l5": {
    id: "passive.paladin.extra_slot_l5",
    displayName: "Expanded Divine Power (L5)",
    description: "Grants one additional spell slot per Long Rest.",
    effect: { type: "spellSlotBonus", amount: 1 },
  },
  // ── Sorcerer passives ─────────────────────────────────────────────────
  "passive.sorcerer.extra_sp_l2": {
    id: "passive.sorcerer.extra_sp_l2",
    displayName: "Font of Magic (L2)",
    description: "Your inner magic deepens — your Sorcery Point pool grows by 2.",
    effect: { type: "sorceryPointBonus", amount: 2 },
  },
  "passive.sorcerer.extra_sp_l5": {
    id: "passive.sorcerer.extra_sp_l5",
    displayName: "Font of Magic (L5)",
    description: "Your inner magic deepens further — your Sorcery Point pool grows by 2.",
    effect: { type: "sorceryPointBonus", amount: 2 },
  },
  "passive.sorcerer.extra_slot_l5": {
    id: "passive.sorcerer.extra_slot_l5",
    displayName: "Expanded Spellcasting (L5)",
    description: "Grants one additional spell slot per Long Rest.",
    effect: { type: "spellSlotBonus", amount: 1 },
  },
  "passive.sorcerer.empowered_spell": {
    id: "passive.sorcerer.empowered_spell",
    displayName: "Empowered Spell",
    description: "Metamagic: spend 1 Sorcery Point to reroll up to 3 damage dice from a spell, keeping the new result.",
    effect: { type: "empoweredSpell", usesPerCast: 1 },
  },
  "passive.sorcerer.quickened_spell": {
    id: "passive.sorcerer.quickened_spell",
    displayName: "Quickened Spell",
    description: "Metamagic: spend 2 Sorcery Points to cast a 1-action spell as a free action this turn.",
    effect: { type: "quickenedSpell", spCost: 2 },
  },
  "passive.sorcerer.heightened_spell": {
    id: "passive.sorcerer.heightened_spell",
    displayName: "Heightened Spell",
    description: "Metamagic: spend 3 Sorcery Points to impose disadvantage on a target's first saving throw against your spell.",
    effect: { type: "heightenedSpell", spCost: 3 },
  },
  "passive.sorcerer.draconic_resilience": {
    id: "passive.sorcerer.draconic_resilience",
    displayName: "Draconic Resilience",
    description: "Dragon blood toughens your form — gain +1 AC and +1 max HP per Sorcerer level when not wearing armor.",
    effect: { type: "draconicResilience" },
  },
  "passive.sorcerer.elemental_affinity": {
    id: "passive.sorcerer.elemental_affinity",
    displayName: "Elemental Affinity",
    description: "Add your Charisma modifier to damage rolls of spells matching your draconic damage type.",
    effect: { type: "elementalAffinity", stat: "cha" },
  },
  "passive.sorcerer.wild_magic_surge": {
    id: "passive.sorcerer.wild_magic_surge",
    displayName: "Wild Magic Surge",
    description: "After casting a spell, a 1-in-6 chance triggers a random surge (push all, heal 1d4, deal 2d6 to self, invisible for 1 turn, etc.).",
    effect: { type: "wildMagicSurge", chance: 1 },
  },
};
