import type { UnitStats } from "../state/types.ts";

export interface ItemDef {
  id: string;
  displayName: string;
  slot: "weapon" | "armor" | "trinket";
  rarity: "common" | "uncommon" | "rare";
  statBonuses?: Partial<UnitStats>;
  grantedActionIds?: string[];
}

export const ITEM_REGISTRY: Record<string, ItemDef> = {
  "item.iron_sword": {
    id: "item.iron_sword",
    displayName: "Iron Sword",
    slot: "weapon",
    rarity: "common",
    statBonuses: { might: 1 },
  },
  "item.wooden_shield": {
    id: "item.wooden_shield",
    displayName: "Wooden Shield",
    slot: "trinket",
    rarity: "common",
    statBonuses: { armor: 1 },
  },
  "item.apprentice_wand": {
    id: "item.apprentice_wand",
    displayName: "Apprentice Wand",
    slot: "weapon",
    rarity: "common",
    statBonuses: { spirit: 1 },
  },
  "item.hunter_bow": {
    id: "item.hunter_bow",
    displayName: "Hunter Bow",
    slot: "weapon",
    rarity: "common",
    grantedActionIds: ["action.arrow_shot"],
  },
  "item.padded_armor": {
    id: "item.padded_armor",
    displayName: "Padded Armor",
    slot: "armor",
    rarity: "common",
    statBonuses: { maxHp: 1 },
  },
  "item.soldier_badge": {
    id: "item.soldier_badge",
    displayName: "Soldier Badge",
    slot: "trinket",
    rarity: "common",
    statBonuses: { might: 1 },
  },
  "item.chain_vest": {
    id: "item.chain_vest",
    displayName: "Chain Vest",
    slot: "armor",
    rarity: "common",
    statBonuses: { armor: 1 },
  },
  "item.lucky_charm": {
    id: "item.lucky_charm",
    displayName: "Lucky Charm",
    slot: "trinket",
    rarity: "common",
  },
  "item.bloodstone": {
    id: "item.bloodstone",
    displayName: "Bloodstone",
    slot: "trinket",
    rarity: "uncommon",
    statBonuses: { maxHp: 2 },
  },
  "item.ember_staff": {
    id: "item.ember_staff",
    displayName: "Ember Staff",
    slot: "weapon",
    rarity: "uncommon",
    statBonuses: { spirit: 1 },
  },
  "item.owl_feather": {
    id: "item.owl_feather",
    displayName: "Owl Feather",
    slot: "trinket",
    rarity: "uncommon",
  },
  "item.runed_robe": {
    id: "item.runed_robe",
    displayName: "Runed Robe",
    slot: "armor",
    rarity: "uncommon",
    statBonuses: { spirit: 1, maxHp: 1 },
  },
};
