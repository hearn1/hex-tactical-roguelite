import type { MapState } from "../run/MapGraph.ts";
import type { UnitStats, ShopInventory, RunModifier, ActionUpgradeBonus } from "./types.ts";
import type { InventoryState } from "../run/Inventory.ts";
import type { AbilityScores } from "../data/abilities.ts";

export interface PartyMember {
  instanceId: string;
  classId: string;
  displayName: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  /** Class-dependent hit die used for Short Rest healing (Guardian d10, Acolyte d8, Arcanist d6). */
  hitDieSize?: number;
  /** Total hit dice available after a Long Rest; tracks hero level. */
  hitDiceTotal?: number;
  /** Unspent hit dice available for Short Rest healing. */
  hitDiceRemaining?: number;
  bonusStats: Partial<UnitStats>;
  /** Six ability scores chosen during setup. Undefined preserves legacy zero-modifier behavior. */
  abilityScores?: AbilityScores;
  equippedItemIds: {
    weapon: string | null;
    armor: string | null;
    trinket: string | null;
  };
  /** Archetype chosen at level 3 (e.g. "archetype.guardian.shieldbearer"). */
  archetypeId?: string;
  /** Optional background/trait chosen at run setup (one per hero). See `data/backgrounds.ts`. */
  backgroundId?: string;
  /** Per-action bonuses from chosen level-up upgrades (F29 / #60). Persist for the run. */
  actionUpgrades?: Record<string, ActionUpgradeBonus>;
  /** Passive level-up upgrades in effect (F29), e.g. "start_combat_guarded". Persist for the run. */
  passives?: string[];
  /** Ids of level-up options this hero has chosen, in order. Drives the hero-panel display. */
  levelUpChoiceIds?: string[];
  /** Action ids the hero has learned through level-up learnAction choices. */
  spellsKnown?: string[];
  /** Action ids the hero has prepared for the current day (long rest cycle). */
  preparedActionIds?: string[];
  /** Spell slots refreshed each Long Rest (#118). Set from the class; non-casters are 0. */
  spellSlotsMax?: number;
  /** Spell slots remaining; persists across combats in the same run. Restored by Long Rest. */
  spellSlotsRemaining?: number;
  /**
   * Hero is dead/defeated for the rest of this run. Persists in party record for summary/UI
   * continuity but the hero does not enter future combats or receive healing/rest benefits.
   */
  deadForRun?: boolean;
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
export type CampAction = "rest" | "train" | "brew" | "prepare" | "prep";

export interface CampNodeState {
  used: CampAction[];
  outcomes: string[];
}

export interface RunState {
  seed: number;
  gold: number;
  campSupplies?: number;
  shortRestsSinceLongRest?: number;
  party: PartyMember[];
  inventory: InventoryState;
  mapTemplateId?: string;
  mapState: MapState;
  runStatus: "active" | "won" | "lost";
  shopStates: Record<string, ShopInventory>;
  campStates: Record<string, CampNodeState>;
  recruitOffers: Record<string, PartyMember[]>;
  runModifiers: RunModifier[];
  difficulty: Difficulty;
  eventSelections: Record<string, string>;
  summaryApplied?: boolean;
  revealedForecasts?: Record<string, true>;
  adventureModifierId?: string;
}
