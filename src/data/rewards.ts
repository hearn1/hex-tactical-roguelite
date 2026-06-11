// ---------------------------------------------------------------------------
// Typed reward pool contracts (#348)
// ---------------------------------------------------------------------------

export interface RewardPoolEntry {
  rewardId: string;
  /** Relative draw weight; higher values are more likely. */
  weight: number;
  minPartyLevel?: number;
  maxPartyLevel?: number;
}

export interface ActRewardPoolDef {
  id: string;
  actId: string;
  entries: RewardPoolEntry[];
}

/**
 * Context used to derive a per-node stable seed for reward selection.
 * Same seed + same context always produces the same reward tier.
 */
export interface RewardSelectionInput {
  poolId: string;
  /** Run seed as a string (combined with act/node context for stable derivation). */
  seed: string;
  actId: string;
  nodeId: string;
}

export interface RewardPoolDef {
  id: string;
  itemIds: string[];
  goldFormula: string;
  extraItemChance?: number;
}

/**
 * Act-level reward pool registry. Maps act pool IDs (used by CampaignDefinition) to the
 * ordered list of RewardPoolDef IDs to draw from. The first entry is used as the default;
 * future reward selection logic will use RNG to pick a tier from this list.
 * All referenced pool IDs must exist in REWARD_REGISTRY.
 */
export const ACT_REWARD_POOLS: Record<string, string[]> = {
  "pool.act_1_rewards": ["reward.basic", "reward.uncommon"],
  "pool.act_2_rewards": ["reward.basic", "reward.uncommon"],
  "pool.act_3_rewards": ["reward.uncommon"],
  "pool.act_4_rewards": ["reward.uncommon"],
  "pool.basic_rewards": ["reward.basic"],
};

/**
 * Typed reward pool definitions with weights per tier (#348). Mirrors ACT_REWARD_POOLS
 * but enables weighted selection and per-node context-stable derivation.
 */
export const ACT_REWARD_POOL_DEFS: Record<string, ActRewardPoolDef> = {
  "pool.act_1_rewards": {
    id: "pool.act_1_rewards",
    actId: "act_1",
    entries: [
      { rewardId: "reward.basic", weight: 2 },
      { rewardId: "reward.uncommon", weight: 1 },
    ],
  },
  "pool.act_2_rewards": {
    id: "pool.act_2_rewards",
    actId: "act_2",
    entries: [
      { rewardId: "reward.basic", weight: 1 },
      { rewardId: "reward.uncommon", weight: 2 },
    ],
  },
  "pool.act_3_rewards": {
    id: "pool.act_3_rewards",
    actId: "act_3",
    entries: [
      { rewardId: "reward.uncommon", weight: 1 },
    ],
  },
  "pool.act_4_rewards": {
    id: "pool.act_4_rewards",
    actId: "act_4",
    entries: [
      { rewardId: "reward.uncommon", weight: 1 },
    ],
  },
  "pool.basic_rewards": {
    id: "pool.basic_rewards",
    actId: "",
    entries: [
      { rewardId: "reward.basic", weight: 1 },
    ],
  },
};

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
