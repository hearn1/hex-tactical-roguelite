export interface ClassLootEntry {
  itemId: string;
  weight: number;
  reason?: string;
}

export const CLASS_LOOT_HOOK_REGISTRY: Record<string, ClassLootEntry[]> = {
  // ── Prototype classes ──────────────────────────────────────────────────────
  "class.guardian": [
    { itemId: "item.iron_sword",     weight: 4, reason: "STR melee weapon" },
    { itemId: "item.wooden_shield",  weight: 3, reason: "defensive trinket" },
    { itemId: "item.chain_vest",     weight: 3, reason: "heavy armor" },
    { itemId: "item.soldier_badge",  weight: 2, reason: "STR trinket" },
    { itemId: "item.runemark_blade", weight: 2, reason: "STR attunement melee" },
  ],
  "class.acolyte": [
    { itemId: "item.moonwell_robe",    weight: 4, reason: "WIS healer armor" },
    { itemId: "item.lantern_moth_pin", weight: 3, reason: "heal trigger trinket" },
    { itemId: "item.hearthstone_charm", weight: 3, reason: "WIS protective trinket" },
    { itemId: "item.bloodstone",       weight: 2, reason: "HP sustain" },
  ],
  "class.arcanist": [
    { itemId: "item.apprentice_wand", weight: 4, reason: "INT caster weapon" },
    { itemId: "item.ember_staff",     weight: 3, reason: "INT uncommon weapon" },
    { itemId: "item.emberglass_wand", weight: 3, reason: "spell attack bonus weapon" },
    { itemId: "item.runed_robe",      weight: 3, reason: "INT caster armor" },
  ],
  "class.scout": [
    { itemId: "item.fine_dagger",       weight: 4, reason: "DEX finesse weapon" },
    { itemId: "item.hunter_bow",        weight: 3, reason: "ranged weapon" },
    { itemId: "item.quickstep_buckle",  weight: 3, reason: "mobility trinket" },
    { itemId: "item.owl_feather",       weight: 2, reason: "scout utility trinket" },
  ],

  // ── 5e-inspired classes ────────────────────────────────────────────────────
  "class.fighter": [
    { itemId: "item.iron_sword",        weight: 4, reason: "STR melee weapon" },
    { itemId: "item.runemark_blade",    weight: 3, reason: "STR attunement melee" },
    { itemId: "item.chain_vest",        weight: 3, reason: "heavy armor" },
    { itemId: "item.wooden_shield",     weight: 3, reason: "defensive shield" },
    { itemId: "item.soldier_badge",     weight: 2, reason: "STR trinket" },
    { itemId: "item.ward_stitched_vest", weight: 2, reason: "damage reduction armor" },
  ],
  "class.rogue": [
    { itemId: "item.fine_dagger",      weight: 4, reason: "DEX finesse weapon" },
    { itemId: "item.quickstep_buckle", weight: 4, reason: "mobility finesse trinket" },
    { itemId: "item.hunter_bow",       weight: 3, reason: "ranged fallback weapon" },
    { itemId: "item.owl_feather",      weight: 2, reason: "rogue utility trinket" },
  ],
  "class.cleric": [
    { itemId: "item.moonwell_robe",     weight: 4, reason: "WIS healer armor" },
    { itemId: "item.lantern_moth_pin",  weight: 4, reason: "heal trigger trinket" },
    { itemId: "item.hearthstone_charm", weight: 3, reason: "protective ward trinket" },
    { itemId: "item.bloodstone",        weight: 2, reason: "HP sustain trinket" },
    { itemId: "item.wooden_shield",     weight: 2, reason: "martial cleric shield" },
  ],
  "class.wizard": [
    { itemId: "item.ember_staff",     weight: 4, reason: "INT uncommon weapon" },
    { itemId: "item.emberglass_wand", weight: 4, reason: "spell attack bonus weapon" },
    { itemId: "item.runed_robe",      weight: 4, reason: "INT caster armor" },
    { itemId: "item.apprentice_wand", weight: 2, reason: "INT entry-level weapon" },
  ],
  "class.ranger": [
    { itemId: "item.hunter_bow",       weight: 4, reason: "primary ranged weapon" },
    { itemId: "item.fine_dagger",      weight: 3, reason: "DEX melee sidearm" },
    { itemId: "item.quickstep_buckle", weight: 3, reason: "mobility trinket" },
    { itemId: "item.padded_armor",     weight: 2, reason: "light mobile armor" },
  ],
  "class.druid": [
    { itemId: "item.moonwell_robe",    weight: 4, reason: "WIS nature armor" },
    { itemId: "item.goblin_relic_shard", weight: 3, reason: "WIS/CON primal trinket" },
    { itemId: "item.owl_feather",      weight: 3, reason: "nature familiar trinket" },
    { itemId: "item.lantern_moth_pin", weight: 2, reason: "heal trigger matches nature theme" },
  ],
  "class.bard": [
    { itemId: "item.owl_feather",      weight: 4, reason: "CHA performer's trinket" },
    { itemId: "item.lucky_charm",      weight: 3, reason: "CHA luck trinket" },
    { itemId: "item.emberglass_wand",  weight: 3, reason: "spell casting weapon" },
    { itemId: "item.quickstep_buckle", weight: 2, reason: "mobile performer trinket" },
  ],
  "class.warlock": [
    { itemId: "item.emberglass_wand",  weight: 4, reason: "pact weapon with spell bonus" },
    { itemId: "item.ember_staff",      weight: 3, reason: "dark caster weapon" },
    { itemId: "item.bloodstone",       weight: 3, reason: "patron bond HP trinket" },
    { itemId: "item.owl_feather",      weight: 2, reason: "familiar trinket" },
  ],
  "class.sorcerer": [
    { itemId: "item.ember_staff",      weight: 4, reason: "innate magic weapon" },
    { itemId: "item.emberglass_wand",  weight: 4, reason: "focused spell weapon" },
    { itemId: "item.runed_robe",       weight: 3, reason: "INT/CHA caster armor" },
    { itemId: "item.apprentice_wand",  weight: 2, reason: "fallback caster weapon" },
  ],
  "class.paladin": [
    { itemId: "item.iron_sword",        weight: 4, reason: "STR divine melee weapon" },
    { itemId: "item.wooden_shield",     weight: 3, reason: "paladin shield" },
    { itemId: "item.hearthstone_charm", weight: 3, reason: "divine protective trinket" },
    { itemId: "item.ward_stitched_vest", weight: 3, reason: "warded heavy armor" },
    { itemId: "item.runemark_blade",    weight: 2, reason: "STR attunement divine sword" },
  ],
  "class.barbarian": [
    { itemId: "item.iron_sword",     weight: 4, reason: "STR heavy melee weapon" },
    { itemId: "item.chain_vest",     weight: 3, reason: "barbarian medium armor" },
    { itemId: "item.bloodstone",     weight: 3, reason: "CON/HP trinket" },
    { itemId: "item.soldier_badge",  weight: 3, reason: "STR warrior trinket" },
    { itemId: "item.runemark_blade", weight: 2, reason: "STR rune melee weapon" },
  ],
  "class.monk": [
    { itemId: "item.fine_dagger",       weight: 4, reason: "DEX finesse monk weapon" },
    { itemId: "item.quickstep_buckle",  weight: 4, reason: "WIS/DEX mobility trinket" },
    { itemId: "item.padded_armor",      weight: 3, reason: "unarmored/light monk armor" },
    { itemId: "item.moonwell_robe",     weight: 2, reason: "WIS monk robe" },
  ],
};
