import type { MapState } from "../run/MapGraph.ts";
import type { UnitStats, ShopInventory, RunModifier, ActionUpgradeBonus } from "./types.ts";
import type { InventoryState } from "../run/Inventory.ts";

export interface PartyMember {
  instanceId: string;
  classId: string;
  displayName: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  bonusStats: Partial<UnitStats>;
  equippedItemIds: {
    weapon: string | null;
    armor: string | null;
    trinket: string | null;
  };
  /** Optional background/trait chosen at run setup (one per hero). See `data/backgrounds.ts`. */
  backgroundId?: string;
  /** Per-action bonuses from chosen level-up upgrades (F29 / #60). Persist for the run. */
  actionUpgrades?: Record<string, ActionUpgradeBonus>;
  /** Passive level-up upgrades in effect (F29), e.g. "start_combat_guarded". Persist for the run. */
  passives?: string[];
  /** Ids of level-up options this hero has chosen, in order. Drives the hero-panel display. */
  levelUpChoiceIds?: string[];
}

/**
 * A queued level-up awaiting a player choice (F29 / #60). Run-time XP grants enqueue one of
 * these per level reached within the choice range; the level-up screen resolves them one at a
 * time, then control returns to {@link RunState}'s originating screen.
 */
export interface PendingLevelUp {
  instanceId: string;
  classId: string;
  newLevel: number;
}

export type Difficulty = "normal" | "hard";

export interface RunState {
  seed: number;
  gold: number;
  party: PartyMember[];
  inventory: InventoryState;
  /** Which map template (`MAP_TEMPLATES`) this run is playing. Defaults to the short
   *  prototype graph when absent (legacy fixtures). New runs select "long". */
  mapTemplateId?: string;
  mapState: MapState;
  runStatus: "active" | "won" | "lost";
  shopStates: Record<string, ShopInventory>;
  recruitOffers: Record<string, PartyMember[]>;
  runModifiers: RunModifier[];
  difficulty: Difficulty;
  eventSelections: Record<string, string>;
  summaryApplied?: boolean;
  /** Nodes whose type + title have been revealed by Buy Rumor service. */
  revealedForecasts?: Record<string, true>;
}
