import type { Hex, TerrainHex } from "../state/types.ts";
import type { EncounterTraitDef } from "./traits.ts";
import { createRng } from "../core/rng.ts";

// ---------------------------------------------------------------------------
// Typed pool contracts (#348)
// ---------------------------------------------------------------------------

export interface EncounterPoolEntry {
  encounterId: string;
  /** Relative draw weight; higher values are more likely. */
  weight: number;
  tags?: string[];
  minPartyLevel?: number;
  maxPartyLevel?: number;
}

export interface EncounterPoolDef {
  id: string;
  actId: string;
  entries: EncounterPoolEntry[];
}

/**
 * Context used to derive a per-node stable seed for encounter selection.
 * Same seed + same context always produces the same result regardless of visit order.
 */
export interface EncounterSelectionInput {
  poolId: string;
  /** Run seed as a string (combined with act/node context for stable derivation). */
  seed: string;
  actId: string;
  nodeId: string;
  /** Already-seen encounter IDs for this node context — excluded from the draw when possible. */
  completedEncounterIds?: string[];
}

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
   * True for the Act 4 final boss encounter — the encounter whose defeat routes to
   * campaign completion. Only one encounter should carry this flag.
   */
  isFinalBoss?: boolean;
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

  // --- Act 1 encounters (#349). Goblin-and-nature themed. ---

  "encounter.act1_goblin_skirmish": {
    id: "encounter.act1_goblin_skirmish",
    displayName: "Goblin Skirmish",
    enemyGroups: [
      { enemyId: "enemy.goblin_skirmisher", count: 3 },
      { enemyId: "enemy.wolf", count: 1 },
    ],
    tags: ["road", "swarm"],
  },
  "encounter.act1_goblin_ranged_mix": {
    id: "encounter.act1_goblin_ranged_mix",
    displayName: "Goblin Raider Column",
    enemyGroups: [
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
      { enemyId: "enemy.skeleton_archer", count: 1 },
      { enemyId: "enemy.wolf", count: 1 },
    ],
    tags: ["road", "ranged"],
  },
  "encounter.act1_nature_ambush": {
    id: "encounter.act1_nature_ambush",
    displayName: "Nature's Ambush",
    enemyGroups: [
      { enemyId: "enemy.wolf", count: 2 },
      { enemyId: "enemy.shadow_stalker", count: 1 },
    ],
    tags: ["ambush"],
  },
  "encounter.act1_goblin_rush": {
    id: "encounter.act1_goblin_rush",
    displayName: "Goblin Rush",
    enemyGroups: [
      { enemyId: "enemy.goblin_skirmisher", count: 3 },
      { enemyId: "enemy.wolf", count: 2 },
    ],
    tags: ["swarm", "rush"],
  },
  "encounter.boss_goblin_warchief": {
    id: "encounter.boss_goblin_warchief",
    displayName: "Goblin Warchief",
    enemyGroups: [
      { enemyId: "enemy.goblin_warchief", count: 1 },
    ],
    rewardPoolId: "reward.uncommon",
  },

  // --- Act 2 encounters (#349). Ogre alliance and undead themed. ---

  "encounter.act2_veteran_squad": {
    id: "encounter.act2_veteran_squad",
    displayName: "Veteran Squad",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 2 },
      { enemyId: "enemy.skeleton_archer", count: 1 },
    ],
    tags: ["road"],
  },
  "encounter.act2_undead_forward": {
    id: "encounter.act2_undead_forward",
    displayName: "Undead Forward Line",
    enemyGroups: [
      { enemyId: "enemy.skeleton_archer", count: 3 },
      { enemyId: "enemy.bandit_brute", count: 1 },
    ],
    tags: ["ruins", "ranged"],
  },
  "encounter.act2_mixed_pressure": {
    id: "encounter.act2_mixed_pressure",
    displayName: "Mixed Pressure",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 2 },
      { enemyId: "enemy.cult_acolyte", count: 1 },
      { enemyId: "enemy.skeleton_archer", count: 1 },
    ],
    rewardPoolId: "reward.uncommon",
    tags: ["support"],
  },
  "encounter.act2_ogre_brute_squad": {
    id: "encounter.act2_ogre_brute_squad",
    displayName: "Brute Vanguard",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 2 },
      { enemyId: "enemy.skeleton_archer", count: 2 },
    ],
    tags: ["road", "rush"],
  },
  "encounter.boss_ogre_warlord": {
    id: "encounter.boss_ogre_warlord",
    displayName: "Ogre Warlord",
    enemyGroups: [
      { enemyId: "enemy.ogre_warlord", count: 1 },
      { enemyId: "enemy.cult_acolyte", count: 1 },
    ],
    rewardPoolId: "reward.uncommon",
  },

  // --- Act 3 encounters (#350). Cult and shadow themed. ---

  "encounter.act3_cult_circle": {
    id: "encounter.act3_cult_circle",
    displayName: "Cult Ritual Circle",
    enemyGroups: [
      { enemyId: "enemy.cult_acolyte", count: 2 },
      { enemyId: "enemy.skeleton_archer", count: 1 },
    ],
    rewardPoolId: "reward.uncommon",
    tags: ["ritual", "support"],
  },
  "encounter.act3_undead_phalanx": {
    id: "encounter.act3_undead_phalanx",
    displayName: "Undead Phalanx",
    enemyGroups: [
      { enemyId: "enemy.skeleton_archer", count: 3 },
      { enemyId: "enemy.bandit_brute", count: 1 },
    ],
    tags: ["ruins"],
  },
  "encounter.act3_shadow_ritual": {
    id: "encounter.act3_shadow_ritual",
    displayName: "Shadow Ritual Guard",
    enemyGroups: [
      { enemyId: "enemy.shadow_stalker", count: 2 },
      { enemyId: "enemy.cult_acolyte", count: 1 },
    ],
    tags: ["ambush", "ritual"],
  },
  "encounter.act3_cult_mob": {
    id: "encounter.act3_cult_mob",
    displayName: "Cult Surge",
    enemyGroups: [
      { enemyId: "enemy.cult_acolyte", count: 2 },
      { enemyId: "enemy.skeleton_archer", count: 2 },
      { enemyId: "enemy.shadow_stalker", count: 1 },
    ],
    rewardPoolId: "reward.uncommon",
    tags: ["swarm", "ritual"],
  },
  "encounter.boss_high_priest": {
    id: "encounter.boss_high_priest",
    displayName: "Cult High Priest",
    enemyGroups: [
      { enemyId: "enemy.cult_high_priest", count: 1 },
      { enemyId: "enemy.cult_acolyte", count: 2 },
    ],
    rewardPoolId: "reward.uncommon",
  },

  // --- Act 4 encounters (#350). Draconid spire and arcane themed. ---

  "encounter.act4_arcane_guard": {
    id: "encounter.act4_arcane_guard",
    displayName: "Arcane Guard",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 2 },
      { enemyId: "enemy.cult_acolyte", count: 1 },
    ],
    tags: ["road"],
  },
  "encounter.act4_cult_casters": {
    id: "encounter.act4_cult_casters",
    displayName: "Arcane Caster Cell",
    enemyGroups: [
      { enemyId: "enemy.cult_acolyte", count: 2 },
      { enemyId: "enemy.shadow_stalker", count: 1 },
      { enemyId: "enemy.skeleton_archer", count: 1 },
    ],
    rewardPoolId: "reward.uncommon",
    tags: ["ritual", "ranged"],
  },
  "encounter.act4_arcane_mob": {
    id: "encounter.act4_arcane_mob",
    displayName: "Arcane Surge",
    enemyGroups: [
      { enemyId: "enemy.cult_acolyte", count: 3 },
      { enemyId: "enemy.shadow_stalker", count: 2 },
    ],
    rewardPoolId: "reward.uncommon",
    tags: ["swarm", "ritual"],
  },
  "encounter.act4_brute_vanguard": {
    id: "encounter.act4_brute_vanguard",
    displayName: "Spire Vanguard",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 3 },
      { enemyId: "enemy.skeleton_archer", count: 1 },
    ],
    tags: ["road", "rush"],
  },
  "encounter.boss_arcane_lord": {
    id: "encounter.boss_arcane_lord",
    displayName: "Arcane Lord",
    enemyGroups: [
      { enemyId: "enemy.arcane_lord", count: 1 },
      { enemyId: "enemy.arcane_bodyguard", count: 2 },
    ],
    rewardPoolId: "reward.uncommon",
    isFinalBoss: true,
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
  "pool.act_1_combat": [
    "encounter.act1_goblin_skirmish",
    "encounter.act1_goblin_ranged_mix",
    "encounter.act1_nature_ambush",
    "encounter.act1_goblin_rush",
    "encounter.road_ambush",
    "encounter.long_mire_crossing",
  ],
  "pool.act_2_combat": [
    "encounter.act2_veteran_squad",
    "encounter.act2_undead_forward",
    "encounter.act2_mixed_pressure",
    "encounter.act2_ogre_brute_squad",
    "encounter.long_gatehouse",
    "encounter.old_graveyard",
  ],
  "pool.act_3_combat": [
    "encounter.act3_cult_circle",
    "encounter.act3_undead_phalanx",
    "encounter.act3_shadow_ritual",
    "encounter.act3_cult_mob",
    "encounter.cult_ritual",
    "encounter.long_cult_vanguard",
    "encounter.warded_circle",
  ],
  "pool.act_4_combat": [
    "encounter.act4_arcane_guard",
    "encounter.act4_cult_casters",
    "encounter.act4_arcane_mob",
    "encounter.act4_brute_vanguard",
    "encounter.long_hexscar_patrol",
    "encounter.shadowed_defile",
  ],
};

// ---------------------------------------------------------------------------
// Typed pool definitions (#348) — weighted, act-context-aware.
// The flat ENCOUNTER_POOLS above remains for backward-compatible resolution via
// resolveNodeEncounterId / selectEncounterFromPool.
// ---------------------------------------------------------------------------

export const ENCOUNTER_POOL_DEFS: Record<string, EncounterPoolDef> = {
  "pool.act_1_combat": {
    id: "pool.act_1_combat",
    actId: "act_1",
    entries: [
      { encounterId: "encounter.act1_goblin_skirmish", weight: 3 },
      { encounterId: "encounter.act1_goblin_ranged_mix", weight: 2 },
      { encounterId: "encounter.act1_nature_ambush", weight: 2 },
      { encounterId: "encounter.act1_goblin_rush", weight: 2 },
      { encounterId: "encounter.road_ambush", weight: 1 },
      { encounterId: "encounter.long_mire_crossing", weight: 1 },
    ],
  },
  "pool.act_2_combat": {
    id: "pool.act_2_combat",
    actId: "act_2",
    entries: [
      { encounterId: "encounter.act2_veteran_squad", weight: 3 },
      { encounterId: "encounter.act2_undead_forward", weight: 2 },
      { encounterId: "encounter.act2_mixed_pressure", weight: 2 },
      { encounterId: "encounter.act2_ogre_brute_squad", weight: 2 },
      { encounterId: "encounter.long_gatehouse", weight: 1 },
      { encounterId: "encounter.old_graveyard", weight: 1 },
    ],
  },
  "pool.act_3_combat": {
    id: "pool.act_3_combat",
    actId: "act_3",
    entries: [
      { encounterId: "encounter.act3_cult_circle", weight: 3 },
      { encounterId: "encounter.act3_undead_phalanx", weight: 2 },
      { encounterId: "encounter.act3_shadow_ritual", weight: 2 },
      { encounterId: "encounter.act3_cult_mob", weight: 2 },
      { encounterId: "encounter.cult_ritual", weight: 1 },
      { encounterId: "encounter.long_cult_vanguard", weight: 1 },
      { encounterId: "encounter.warded_circle", weight: 1 },
    ],
  },
  "pool.act_4_combat": {
    id: "pool.act_4_combat",
    actId: "act_4",
    entries: [
      { encounterId: "encounter.act4_arcane_guard", weight: 3 },
      { encounterId: "encounter.act4_cult_casters", weight: 2 },
      { encounterId: "encounter.act4_arcane_mob", weight: 2 },
      { encounterId: "encounter.act4_brute_vanguard", weight: 2 },
      { encounterId: "encounter.long_hexscar_patrol", weight: 1 },
      { encounterId: "encounter.shadowed_defile", weight: 1 },
    ],
  },
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

/**
 * Derives a stable numeric seed from an EncounterSelectionInput so the same
 * act/node/pool context always produces the same encounter regardless of run visit order.
 */
function deriveContextSeed(input: EncounterSelectionInput): number {
  const str = `${input.seed}|${input.actId}|${input.nodeId}|${input.poolId}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((Math.imul(h, 33)) ^ str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Weighted encounter selection from a typed EncounterPoolDef using a per-context derived
 * seed. Same input always returns the same encounter. Already-completed encounters are
 * down-weighted (excluded if possible) to encourage variety on repeat visits.
 */
export function selectEncounterByContext(input: EncounterSelectionInput): string {
  const poolDef = ENCOUNTER_POOL_DEFS[input.poolId];
  if (!poolDef) throw new Error(`Unknown typed encounter pool: ${input.poolId}`);

  const eligible = poolDef.entries.filter(
    (e) => !(input.completedEncounterIds?.includes(e.encounterId)),
  );
  const entries = eligible.length > 0 ? eligible : poolDef.entries;

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  const rng = createRng(deriveContextSeed(input));
  let roll = rng() * totalWeight;

  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry.encounterId;
  }
  return entries[entries.length - 1].encounterId;
}
