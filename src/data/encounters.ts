import type { Hex, TerrainHex } from "../state/types.ts";
import type { EncounterTraitDef } from "./traits.ts";

export interface EncounterDef {
  id: string;
  displayName: string;
  enemyGroups: { enemyId: string; count: number }[];
  rewardPoolId?: string;
  /**
   * Optional per-enemy starting positions (axial), one entry per enemy slot in the same
   * order `enemyGroups` expands (group 0 first, each group flattened by `count`). When
   * present, `createCombatFromRun` places enemies here instead of the shared scatter,
   * letting fights vary tactically (back-line casters, flankers, brute walls). All
   * positions must sit within the combat grid (radius 3) and not overlap — enforced by
   * `DataRepository.validate`.
   */
  positions?: Hex[];
  /**
   * Inert curation metadata (ambush/ruins/road/camp/ritual/swarm...). Lets future map
   * placement (F26/F35) pick thematically-appropriate fights. No behavior this slice.
   */
  tags?: string[];
  /**
   * Data-driven encounter traits (boss/elite special mechanics). Replaces the deprecated
   * `eliteTrait` field.
   */
  traits?: EncounterTraitDef[];
  /**
   * @deprecated Use `traits` instead. Kept as a transitional type only.
   * Built-in data has been migrated off this field.
   */
  eliteTrait?: "rally";
  /**
   * Optional terrain overlay for this encounter. Entries are converted to a
   * `Record<hexKey, TerrainType>` on `CombatState` at combat creation. Normal tiles
   * may be omitted — a missing key defaults to "normal" at runtime.
   */
  terrain?: TerrainHex[];
}

export const ENCOUNTER_REGISTRY: Record<string, EncounterDef> = {
  "encounter.road_ambush": {
    id: "encounter.road_ambush",
    displayName: "Road Ambush",
    enemyGroups: [
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
      { enemyId: "enemy.wolf", count: 1 },
    ],
  },
  "encounter.old_graveyard": {
    id: "encounter.old_graveyard",
    displayName: "Old Graveyard",
    enemyGroups: [
      { enemyId: "enemy.skeleton_archer", count: 2 },
      { enemyId: "enemy.wolf", count: 1 },
    ],
  },
  "encounter.bandit_toll": {
    id: "encounter.bandit_toll",
    displayName: "Bandit Toll",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 1 },
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
    ],
  },
  "encounter.cult_ritual": {
    id: "encounter.cult_ritual",
    displayName: "Cult Ritual",
    enemyGroups: [
      { enemyId: "enemy.cult_acolyte", count: 1 },
      { enemyId: "enemy.skeleton_archer", count: 2 },
    ],
    rewardPoolId: "reward.uncommon",
  },
  "encounter.wolf_pack": {
    id: "encounter.wolf_pack",
    displayName: "Ravenous Swarm",
    enemyGroups: [
      { enemyId: "enemy.wolf", count: 3 },
      { enemyId: "enemy.bandit_brute", count: 1 },
    ],
  },
  "encounter.broken_banner_elite": {
    id: "encounter.broken_banner_elite",
    displayName: "Broken Banner Company",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 1 },
      { enemyId: "enemy.cult_acolyte", count: 1 },
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
    ],
    rewardPoolId: "reward.uncommon",
    traits: [
      {
        id: "elite_rally_on_first_death",
        conditionId: "rallied",
        duration: 2,
        attackBonus: 2,
        logText: "the survivors Rally!",
      },
    ],
  },
  "encounter.boss_ogre_hexbreaker": {
    id: "encounter.boss_ogre_hexbreaker",
    displayName: "Ogre Hexbreaker",
    enemyGroups: [
      { enemyId: "enemy.ogre_hexbreaker", count: 1 },
    ],
  },

  // --- Long-template encounters (F26 / #57). Fresh placements composed from the existing
  // enemy roster; coordinate enemy variety with F27 (#58). ---
  "encounter.long_gatehouse": {
    id: "encounter.long_gatehouse",
    displayName: "Ruined Gatehouse",
    enemyGroups: [
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
      { enemyId: "enemy.wolf", count: 1 },
    ],
  },
  "encounter.long_mire_crossing": {
    id: "encounter.long_mire_crossing",
    displayName: "Mire Crossing",
    enemyGroups: [
      { enemyId: "enemy.wolf", count: 2 },
      { enemyId: "enemy.skeleton_archer", count: 1 },
    ],
    terrain: [
      { q: -1, r: 0, type: "difficult" },
      { q: 0, r: 0, type: "difficult" },
      { q: 1, r: -1, type: "hazard" },
      { q: 1, r: 0, type: "hazard" },
      { q: 2, r: -1, type: "cover" },
    ],
  },
  "encounter.long_iron_sergeant_elite": {
    id: "encounter.long_iron_sergeant_elite",
    displayName: "The Iron Sergeant",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 1 },
      { enemyId: "enemy.cult_acolyte", count: 1 },
      { enemyId: "enemy.goblin_skirmisher", count: 1 },
    ],
    rewardPoolId: "reward.uncommon",
    traits: [
      {
        id: "elite_rally_on_first_death",
        conditionId: "rallied",
        duration: 2,
        attackBonus: 2,
        logText: "the survivors Rally!",
      },
    ],
  },
  "encounter.long_toll_of_bones": {
    id: "encounter.long_toll_of_bones",
    displayName: "Toll of Bones",
    enemyGroups: [
      { enemyId: "enemy.skeleton_archer", count: 3 },
      { enemyId: "enemy.bandit_brute", count: 1 },
    ],
  },
  "encounter.long_thornwood_pursuit": {
    id: "encounter.long_thornwood_pursuit",
    displayName: "Thornwood Pursuit",
    enemyGroups: [
      { enemyId: "enemy.wolf", count: 2 },
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
    ],
  },
  "encounter.long_cult_vanguard": {
    id: "encounter.long_cult_vanguard",
    displayName: "Cult Vanguard",
    enemyGroups: [
      { enemyId: "enemy.cult_acolyte", count: 1 },
      { enemyId: "enemy.skeleton_archer", count: 2 },
      { enemyId: "enemy.goblin_skirmisher", count: 1 },
    ],
    rewardPoolId: "reward.uncommon",
  },
  "encounter.long_blackwater_ford": {
    id: "encounter.long_blackwater_ford",
    displayName: "Blackwater Ford",
    enemyGroups: [
      { enemyId: "enemy.skeleton_archer", count: 2 },
      { enemyId: "enemy.wolf", count: 2 },
    ],
  },
  "encounter.long_ashen_lookout": {
    id: "encounter.long_ashen_lookout",
    displayName: "Ashen Lookout",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 1 },
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
      { enemyId: "enemy.skeleton_archer", count: 1 },
    ],
  },
  "encounter.long_hexscar_patrol": {
    id: "encounter.long_hexscar_patrol",
    displayName: "Hexscar Patrol",
    enemyGroups: [
      { enemyId: "enemy.cult_acolyte", count: 1 },
      { enemyId: "enemy.bandit_brute", count: 1 },
      { enemyId: "enemy.wolf", count: 2 },
    ],
    rewardPoolId: "reward.uncommon",
  },

  // --- Variety pack (F27 / #58). Distinct tactical shapes built from the existing roster
  // plus the new `ambusher` (Shadow Stalker). Each declares per-enemy `positions` so the
  // fight reads differently on the grid. ---

  // Small melee rush — brutes crash straight in; nothing to kite, all pressure up front.
  "encounter.savage_charge": {
    id: "encounter.savage_charge",
    displayName: "Savage Charge",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 1 },
      { enemyId: "enemy.wolf", count: 2 },
    ],
    positions: [
      { q: 2, r: 0 },
      { q: 2, r: -1 },
      { q: 2, r: 1 },
    ],
    tags: ["road", "rush"],
  },

  // Ranged pressure — a back line of archers forces the party to close under fire.
  "encounter.arrow_storm": {
    id: "encounter.arrow_storm",
    displayName: "Arrow Storm",
    enemyGroups: [
      { enemyId: "enemy.skeleton_archer", count: 3 },
      { enemyId: "enemy.goblin_skirmisher", count: 1 },
    ],
    positions: [
      { q: 3, r: -1 },
      { q: 3, r: 0 },
      { q: 2, r: 1 },
      { q: 1, r: 1 },
    ],
    tags: ["ruins", "ranged"],
    terrain: [
      { q: -2, r: 0, type: "cover" },
      { q: -1, r: 1, type: "cover" },
      { q: 0, r: 0, type: "difficult" },
      { q: 1, r: 0, type: "difficult" },
    ],
  },

  // Support-protected group — an acolyte hangs back behind a brute wall, healing the line.
  "encounter.warded_circle": {
    id: "encounter.warded_circle",
    displayName: "Warded Circle",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 2 },
      { enemyId: "enemy.cult_acolyte", count: 1 },
    ],
    positions: [
      { q: 1, r: 0 },
      { q: 1, r: 1 },
      { q: 3, r: -1 },
    ],
    rewardPoolId: "reward.uncommon",
    tags: ["ritual", "support"],
  },

  // Mixed low-health swarm — many fragile bodies; AoE and target priority matter.
  "encounter.scuttling_horde": {
    id: "encounter.scuttling_horde",
    displayName: "Scuttling Horde",
    enemyGroups: [
      { enemyId: "enemy.goblin_skirmisher", count: 3 },
      { enemyId: "enemy.wolf", count: 2 },
    ],
    positions: [
      { q: 2, r: -1 },
      { q: 2, r: 0 },
      { q: 2, r: 1 },
      { q: 3, r: -1 },
      { q: 1, r: 1 },
    ],
    tags: ["swarm"],
  },

  // Ambush — stalkers flank from the party's edges, waiting for an isolated or hurt hero.
  "encounter.shadowed_defile": {
    id: "encounter.shadowed_defile",
    displayName: "Shadowed Defile",
    enemyGroups: [
      { enemyId: "enemy.shadow_stalker", count: 2 },
      { enemyId: "enemy.goblin_skirmisher", count: 1 },
    ],
    positions: [
      { q: 0, r: 2 },
      { q: 0, r: -2 },
      { q: 3, r: -1 },
    ],
    tags: ["ambush"],
  },
};

/**
 * Curated pools of *standard* (non-elite, non-boss) combat encounters. Combat nodes draw
 * from a pool via {@link selectEncounterFromPool} so fights vary per run (F27 / #58
 * "seeded combat-node pool"). Selection draws from the single shared seeded RNG stream
 * (L1) — no per-system sub-stream — keeping runs reproducible (consistent with #66/F35).
 */
export const ENCOUNTER_POOLS: Record<string, string[]> = {
  "pool.long_combat": [
    "encounter.long_thornwood_pursuit",
    "encounter.long_cult_vanguard",
    "encounter.long_blackwater_ford",
    "encounter.long_ashen_lookout",
    "encounter.long_hexscar_patrol",
  ],
  "pool.standard_combat": [
    "encounter.road_ambush",
    "encounter.old_graveyard",
    "encounter.bandit_toll",
    "encounter.wolf_pack",
    "encounter.long_gatehouse",
    "encounter.long_mire_crossing",
    "encounter.long_toll_of_bones",
    "encounter.savage_charge",
    "encounter.arrow_storm",
    "encounter.warded_circle",
    "encounter.scuttling_horde",
    "encounter.shadowed_defile",
  ],
  // Placeholder act pools. Reuse existing encounters until act-specific content lands.
  "pool.act_2_combat": [
    "encounter.bandit_toll",
    "encounter.old_graveyard",
    "encounter.wolf_pack",
    "encounter.long_toll_of_bones",
    "encounter.long_gatehouse",
  ],
  "pool.act_3_combat": [
    "encounter.cult_ritual",
    "encounter.long_cult_vanguard",
    "encounter.warded_circle",
    "encounter.long_ashen_lookout",
    "encounter.shadowed_defile",
  ],
  "pool.act_4_combat": [
    "encounter.road_ambush",
    "encounter.bandit_toll",
    "encounter.cult_ritual",
    "encounter.long_hexscar_patrol",
    "encounter.shadowed_defile",
  ],
};

/**
 * Picks one encounter id from a pool using the supplied (shared, seeded) RNG. Deterministic
 * for a given RNG state, so a run replays identically from its seed.
 */
export function selectEncounterFromPool(poolId: string, rng: () => number): string {
  const pool = ENCOUNTER_POOLS[poolId];
  if (!pool || pool.length === 0) {
    throw new Error(`Unknown or empty encounter pool: ${poolId}`);
  }
  const idx = Math.floor(rng() * pool.length);
  return pool[idx];
}
