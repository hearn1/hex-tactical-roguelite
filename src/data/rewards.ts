export interface RewardPoolDef {
  id: string;
  itemIds: string[];
  goldFormula: string;
  extraItemChance?: number;
}

export const REWARD_REGISTRY: Record<string, RewardPoolDef> = {
  "reward.basic": {
    id: "reward.basic",
    itemIds: [
      "item.iron_sword",
      "item.wooden_shield",
      "item.padded_armor",
      "item.apprentice_wand",
      "item.soldier_badge",
      "item.hearthstone_charm",
    ],
    goldFormula: "2d6",
  },
  "reward.uncommon": {
    id: "reward.uncommon",
    itemIds: [
      "item.ember_staff",
      "item.bloodstone",
      "item.owl_feather",
      "item.runed_robe",
      "item.runemark_blade",
      "item.emberglass_wand",
      "item.ward_stitched_vest",
      "item.moonwell_robe",
      "item.quickstep_buckle",
      "item.lantern_moth_pin",
    ],
    goldFormula: "3d6+10",
    extraItemChance: 0.25,
  },
};
