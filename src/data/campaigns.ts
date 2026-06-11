/** Seeded pool of map templates available for an act. One is drawn at run-start via RNG seam. */
export interface ActMapPool {
  /** Ids from MAP_TEMPLATES eligible for this act. */
  templateIds: string[];
}

/** Reference to an encounter pool for standard combat nodes in this act. */
export interface ActEncounterPool {
  /** Pool id from ENCOUNTER_POOLS. */
  poolId: string;
}

/** Reference to a reward pool for post-encounter rewards in this act. */
export interface ActRewardPool {
  /** Pool id from REWARD_POOLS (placeholder; system not yet implemented). */
  poolId: string;
}

/**
 * A narrative trigger key for this act. Resolved by the future event/cutscene system.
 * Stored here as a stable seam for upcoming story-beat tasks.
 */
export interface ActStoryBeat {
  /** Stable id, e.g. "act_1.intro" or "act_1.boss_defeated". */
  id: string;
  /** Design notes — not surfaced in-game. */
  description: string;
}

export interface ActDefinition {
  /** Stable act id — always "act_1" … "act_4". */
  id: string;
  displayName: string;
  /** 0-based position within the campaign; acts are traversed in ascending order. */
  order: number;
  /** Pool of map templates to draw from at run-start. */
  mapPool: ActMapPool;
  /** Primary encounter pool for standard combat nodes. */
  encounterPool: ActEncounterPool;
  /** Post-encounter reward pool. */
  rewardPool: ActRewardPool;
  /** Narrative story beats (intro, boss intro, conclusion). */
  storyBeats: ActStoryBeat[];
  /**
   * Optional alternate layout variant ids for this act. Keeps the model flexible for
   * route variants (see CAMPAIGN_ARC.md side-quest hooks) while order stays fixed.
   */
  alternateLayoutIds?: string[];
}

export interface CampaignDefinition {
  id: string;
  displayName: string;
  /** Ordered acts; always traversed from index 0 (act_1) to the final act. */
  acts: ActDefinition[];
}

const ACT_1: ActDefinition = {
  id: "act_1",
  displayName: "The Verdant Threat",
  order: 0,
  mapPool: { templateIds: ["act_1_map", "long"] },
  encounterPool: { poolId: "pool.long_combat" },
  rewardPool: { poolId: "pool.act_1_rewards" },
  storyBeats: [
    { id: "act_1.intro", description: "Party departs into the frontier threatened by goblin warbands." },
    { id: "act_1.boss_intro", description: "Primal force revealed as the true source of the goblin surge." },
    { id: "act_1.boss_defeated", description: "Primal heart broken; the road ahead opens." },
  ],
};

const ACT_2: ActDefinition = {
  id: "act_2",
  displayName: "The Iron Wall",
  order: 1,
  mapPool: { templateIds: ["act_2_map"] },
  encounterPool: { poolId: "pool.act_2_combat" },
  rewardPool: { poolId: "pool.act_2_rewards" },
  storyBeats: [
    { id: "act_2.intro", description: "The party reaches the fortified pass held by the warlord's alliance." },
    { id: "act_2.boss_intro", description: "The ogre warlord and necromancer lieutenant take the field." },
    { id: "act_2.boss_defeated", description: "Warlord slain; the undead tide halted." },
  ],
  alternateLayoutIds: ["act_2_map_deserter_route"],
};

const ACT_3: ActDefinition = {
  id: "act_3",
  displayName: "The Ashen Choir",
  order: 2,
  mapPool: { templateIds: ["act_3_map"] },
  encounterPool: { poolId: "pool.act_3_combat" },
  rewardPool: { poolId: "pool.act_3_rewards" },
  storyBeats: [
    { id: "act_3.intro", description: "The cult's cells spread across a scarred landscape." },
    { id: "act_3.commanders_cleared", description: "The three cult commanders are neutralized." },
    { id: "act_3.boss_intro", description: "The high priest activates as the sanctum is breached." },
    { id: "act_3.boss_defeated", description: "Ritual broken; the cult's arcane patron is glimpsed beyond." },
  ],
  alternateLayoutIds: ["act_3_map_prisoner_rescue"],
};

const ACT_4: ActDefinition = {
  id: "act_4",
  displayName: "The Ascending Dark",
  order: 3,
  mapPool: { templateIds: ["act_4_map"] },
  encounterPool: { poolId: "pool.act_4_combat" },
  rewardPool: { poolId: "pool.act_4_rewards" },
  storyBeats: [
    { id: "act_4.intro", description: "The party storms the draconid arcane lord's sanctum." },
    { id: "act_4.phase_transition", description: "Lord dismisses bodyguards at 50% HP and enters enraged phase." },
    { id: "act_4.boss_defeated", description: "Arcane lord defeated; campaign complete." },
  ],
  alternateLayoutIds: ["act_4_map_planar_anchor"],
};

/** The first and only campaign. Default entry point for all runs. */
export const DEFAULT_CAMPAIGN: CampaignDefinition = {
  id: "campaign.verdant_dark",
  displayName: "From Verdant Threat to Ascending Dark",
  acts: [ACT_1, ACT_2, ACT_3, ACT_4],
};

/** Lookup by campaign id for future multi-campaign support. */
export const CAMPAIGN_REGISTRY: Record<string, CampaignDefinition> = {
  [DEFAULT_CAMPAIGN.id]: DEFAULT_CAMPAIGN,
};

/**
 * Flat registry of all story beats across all campaigns, keyed by beat id.
 * Derived from CAMPAIGN_REGISTRY so it stays in sync automatically as campaigns
 * and acts are edited. Consumed by the future event/cutscene system.
 */
export const STORY_BEAT_REGISTRY: Record<string, ActStoryBeat> = Object.fromEntries(
  Object.values(CAMPAIGN_REGISTRY).flatMap((c) =>
    c.acts.flatMap((a) => a.storyBeats.map((b) => [b.id, b])),
  ),
);

/**
 * Returns the act definition for the given 1-indexed act number, or `undefined` if the
 * campaign has no such act (e.g. missing data). Callers must handle `undefined` gracefully.
 */
export function getActDefinition(
  campaign: CampaignDefinition,
  actNumber: number,
): ActDefinition | undefined {
  return campaign.acts.find((a) => a.order === actNumber - 1);
}

/**
 * RNG seam: selects a map template id for the given act.
 * Falls back to "long" (the established default) if the act is absent or its pool is empty.
 */
export function selectActMapTemplate(act: ActDefinition | undefined, rng: () => number): string {
  if (!act || act.mapPool.templateIds.length === 0) return "long";
  const idx = Math.floor(rng() * act.mapPool.templateIds.length);
  return act.mapPool.templateIds[idx];
}

/**
 * RNG seam: returns the encounter pool id for the given act.
 * Falls back to the shared standard combat pool if the act is absent.
 */
export function selectActEncounterPool(act: ActDefinition | undefined): string {
  if (!act) return "pool.standard_combat";
  return act.encounterPool.poolId;
}

/**
 * RNG seam: returns the reward pool id for the given act.
 * Falls back to a basic reward pool if the act is absent.
 */
export function selectActRewardPool(act: ActDefinition | undefined): string {
  if (!act) return "pool.basic_rewards";
  return act.rewardPool.poolId;
}
