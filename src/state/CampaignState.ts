import type { MapState } from "../run/MapGraph.ts";
import type { PartyMember } from "./RunState.ts";
import type { InventoryState } from "../run/Inventory.ts";
import type { RunModifier } from "./types.ts";
import type { AdventureLogEntry } from "../run/AdventureLog.ts";

/**
 * In-flight metrics for the current act. Accumulated as the run progresses and
 * archived into a {@link CompletedActSummary} when the act ends.
 */
export interface ActProgress {
  /** Stable act id ("act_1" … "act_4"). */
  actId: string;
  /** 1-indexed act position within the campaign. */
  actNumber: number;
  nodesCleared: number;
  elitesDefeated: number;
  bossDefeated: boolean;
  /** Gold accumulated during this act (for summary display). */
  goldEarned: number;
  /** Number of hero-down events that occurred during this act. */
  heroDownCount: number;
  /** Number of loot/item rewards gained during this act. */
  itemsGained: number;
}

/**
 * Archived record of an act that has ended (victory or loss).
 * Stored in {@link CampaignState.completedActs} for end-of-campaign summaries
 * and cross-act event reactions.
 */
export interface CompletedActSummary extends ActProgress {
  runStatus: "won" | "lost";
  /** Snapshot of the map state at the moment the act ended. */
  mapSnapshot: MapState;
}

/**
 * Campaign-level persistent state. Wraps the active run and carries the party,
 * shared inventory, and history across act boundaries.
 *
 * Design note: shape is intentionally serializable — do not add non-serializable
 * fields (functions, class instances, RNG state). Save/load is out of scope for
 * this milestone but the shape must not preclude it.
 */
export interface CampaignState {
  campaignId: string;
  seed: number;
  difficulty: "normal" | "hard";
  /** 1-indexed act number the party is currently attempting. */
  currentActNumber: number;
  campaignStatus: "active" | "won" | "lost";
  /** Single source of truth for the party across acts. Updated after each act. */
  party: PartyMember[];
  /** Shared inventory (items, relics). Gold handling at act boundaries is a design decision. */
  inventory: InventoryState;
  /** Campaign-level boons. Per-act boons are filtered out at act boundaries. */
  runModifiers: RunModifier[];
  /** Accumulates across acts so events can react to prior choices. */
  eventSelections: Record<string, string>;
  /** Accumulates across acts for end-of-campaign summary display. */
  adventureLog: AdventureLogEntry[];
  /** One entry per completed act, in chronological order. */
  completedActs: CompletedActSummary[];
  /** Act number where the campaign was lost (set by recordCampaignLoss). */
  lossActNumber?: number;
  /** Node id where the campaign was lost (set by recordCampaignLoss). */
  lossNodeId?: string;
}

/** Factory: builds a fresh campaign state for a new run attempt. */
export function createCampaignState(
  campaignId: string,
  seed: number,
  difficulty: "normal" | "hard",
  party: PartyMember[],
  inventory: InventoryState,
): CampaignState {
  return {
    campaignId,
    seed,
    difficulty,
    currentActNumber: 1,
    campaignStatus: "active",
    party,
    inventory,
    runModifiers: [],
    eventSelections: {},
    adventureLog: [],
    completedActs: [],
  };
}
