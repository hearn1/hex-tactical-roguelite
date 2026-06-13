/**
 * Centralized spell and feature pool registries for class-based level-up choice generation.
 * These registries define the learnable actions / optional passive features available to each
 * class beyond their fixed starting kit.  The `learnFromPool` LevelUpUpgrade kind draws from
 * these at runtime, filtering out already-known options before presenting choices.
 *
 * Part of epic #190.
 */

/**
 * Maps caster classId → ordered list of learnable action IDs.  Every ID here must exist in
 * ACTION_REGISTRY (validated by DataRepository.validate()).
 */
export const SPELL_POOL_REGISTRY: Record<string, string[]> = {
  "class.wizard": [
    "action.fireball",
    "action.lightning_bolt",
    "action.haste",
    "action.slow",
    "action.counterspell",
    "action.wizard.thunderclap",
    "action.wizard.misty_step",
    "action.wizard.web",
  ],
  "class.cleric": [
    "action.divine_favor",
    "action.bless",
    "action.cleric.mass_cure_wounds",
    "action.cleric.spiritual_weapon",
    "action.cleric.prayer_of_healing",
    "action.cleric.guardian_of_faith",
  ],
  "class.druid": [
    "action.druid.produce_flame",
    "action.druid.entangle",
    "action.druid.moonbeam",
    "action.druid.land_stride",
    "action.druid.barkskin",
    "action.druid.call_lightning",
  ],
  "class.bard": [
    "action.bard.dissonant_whispers",
    "action.bard.hypnotic_pattern",
    "action.bard.charm_person",
    "action.bard.sleep",
    "action.bard.faerie_fire",
    "action.bard.shatter",
  ],
  "class.warlock": [
    "action.warlock.hellish_rebuke",
    "action.warlock.entropic_ward",
    "action.warlock.hunger_of_hadar",
    "action.warlock.shadow_lance",
    "action.warlock.beguiling_influence",
  ],
  "class.sorcerer": [
    "action.sorcerer.scorching_ray",
    "action.sorcerer.cone_of_cold",
    "action.sorcerer.mirror_image",
    "action.sorcerer.blur",
    "action.sorcerer.chain_lightning",
    "action.sorcerer.shatter_sonic",
  ],
  "class.ranger": [
    "action.ranger.hail_of_arrows",
    "action.ranger.silence_shot",
    "action.ranger.swift_quiver",
    "action.ranger.zephyr_strike",
  ],
};

/**
 * Maps martial classId → ordered list of optional passive feature IDs.  Every ID here must
 * exist in PASSIVE_REGISTRY (validated by DataRepository.validate()).
 */
export const FEATURE_POOL_REGISTRY: Record<string, string[]> = {
  "class.fighter": [
    "passive.fighter.second_wind",
    "passive.fighter.action_surge",
    "passive.fighter.indomitable",
  ],
  "class.paladin": [
    "passive.paladin.aura_of_protection",
    "passive.paladin.divine_health",
    "passive.paladin.loh_pool_extended",
  ],
  "class.barbarian": [
    "passive.barbarian.danger_sense",
    "passive.barbarian.fast_movement",
    "passive.barbarian.brutal_critical",
  ],
  "class.monk": [
    "passive.slow_fall",
    "passive.monk.stillness_of_mind",
    "passive.monk.fast_movement",
  ],
  "class.rogue": [
    "passive.uncanny_dodge",
    "passive.evasion",
    "passive.rogue.improved_sneak",
  ],
};
