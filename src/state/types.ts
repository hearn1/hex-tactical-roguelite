import type { AbilityScores } from "../data/abilities.ts";
import type { CombatEnvironmentThemeId } from "../data/environmentThemes.ts";
import type { NodeType } from "../data/nodes.ts";

export type ScreenId =
  | "main_menu"
  | "meta_upgrades"
  | "setup"
  | "map"
  | "inventory"
  | "combat"
  | "reward"
  | "shop"
  | "camp"
  | "event"
  | "recruit"
  | "pet"
  | "levelup"
  | "run_summary";

export type Team = "hero" | "enemy";

export type HeroLifeState = "standing" | "downed" | "stable" | "dead";

export interface DeathSaveState {
  successes: number;
  failures: number;
}

export type ConditionId = "guarded" | "weakened" | "blessed" | "slowed" | "rallied" | "warded" | "empowered" | "taunted" | "mesmerized" | "reckless" | "armored" | "sanctuary" | "hasted" | "counterspelled";

/** Element type for VFX tinting (fire, frost, arcane, heal, physical, dark). */
export type ActionElement = "fire" | "frost" | "arcane" | "heal" | "physical" | "dark";

export interface UnitStats {
  maxHp: number;
  armor: number;
  move: number;
  might: number;
  agility: number;
  spirit: number;
}

/**
 * The three stats that drive non-combat skill checks. A shared subset of {@link UnitStats}
 * so a `bonusStats` tweak (backgrounds, meta upgrades, events) is picked up by both combat
 * (`computeStats`) and the F23 check system without forking the stat model.
 */
export type CheckStat = "might" | "agility" | "spirit";

export interface Condition {
  id: ConditionId;
  remainingTurns: number;
}

export interface Hex {
  q: number;
  r: number;
}

export type TerrainType = "normal" | "difficult" | "cover" | "hazard";

export interface TerrainHex {
  q: number;
  r: number;
  type: TerrainType;
}

/**
 * Per-action numeric bonuses granted by level-up choices (F29 / #60). Keyed by action id on
 * a unit's {@link UnitInstance.actionUpgrades}. Read by the combat resolver so an upgrade is
 * picked up with no new action defs — extensible toward deeper class-build options later.
 */
/**
 * Structured result returned by resolveAction so callers can read the real
 * values instead of parsing the combat log. Shared seam used by VFX (#92)
 * and consumable potions (#103).
 */
export interface ActionResult {
  amount: number;
  isCrit: boolean;
  kind: "damage" | "heal" | "miss";
  actionElement?: ActionElement;
}

export interface ActionUpgradeBonus {
  /** Flat bonus added to the action's rolled damage. */
  damageBonus?: number;
  /** Flat bonus added to the action's rolled heal. */
  healBonus?: number;
  /** Bonus added to the action's effective range (targeting + validation). */
  rangeBonus?: number;
  /** Extra turns added to a condition the action applies (e.g. Slowed/Blessed). */
  conditionDurationBonus?: number;
}

export interface UnitInstance {
  instanceId: string;
  defId: string;
  displayName: string;
  team: Team;
  level: number;
  xp: number;
  stats: UnitStats;
  hp: number;
  pos: Hex;
  conditions: Condition[];
  movePointsRemaining: number;
  hasActed: boolean;
  equippedItemIds: { weapon: string | null; armor: string | null; trinket: string | null };
  bonusStats: Partial<UnitStats>;
  /** Hero ability scores from run setup. Enemies omit this and keep definition stats. */
  abilityScores?: AbilityScores;
  /** Hero's chosen background (heroes only). Display-only here; the effect was applied at run start. */
  backgroundId?: string;
  /** Per-action level-up bonuses (F29). Copied from the party member at combat start. */
  actionUpgrades?: Record<string, ActionUpgradeBonus>;
  /** Level-up passive ids in effect (F29), e.g. "start_combat_guarded", "first_heal_bonus". */
  passives?: string[];
  /** Archetype chosen at level 3 (e.g. "archetype.guardian.shieldbearer"). */
  archetypeId?: string;
  /** Forced target override: this unit must target this instanceId with its next attack. */
  forcedTargetId?: string;
  /** Whether this unit has already fired its reaction this combat turn (prevents infinite loops). */
  reactionUsedThisTurn?: boolean;
  /** Transient combat flag: the `first_heal_bonus` passive has already fired this combat. */
  firstHealDone?: boolean;
  /** Item hook IDs that have already triggered this combat, e.g. "item.runemark_blade". */
  usedItemHooks?: string[];
  /** Action ids the hero has learned (from level-up learnAction choices). Copied from party member. */
  spellsKnown?: string[];
  /** Action ids the hero has prepared for this day. Copied from party member. */
  preparedActionIds?: string[];
  /** Spell slots remaining for spell-slot actions (#118). Copied from the party member; synced back. */
  spellSlotsRemaining?: number;
  /** Spell slots refreshed each Long Rest (#118), for display. Copied from the party member. */
  spellSlotsMax?: number;
  /**
   * Hero-only combat life state. Undefined normalises to "standing" for save compatibility.
   * Enemies use hp <= 0 as ordinary defeat and never set this field.
   */
  heroLifeState?: HeroLifeState;
  /** Hero-only death-save counters. Meaningful when heroLifeState === "downed". */
  deathSaves?: DeathSaveState;
}

export interface CombatLogEntry {
  kind: "initiative" | "turn_start" | "move" | "action" | "defeat" | "victory" | "defeat_squad";
  text: string;
  round: number;
}

export interface ShopInventory {
  items: { itemId: string; sold: boolean }[];
  potions: { potionId: string; sold: boolean }[];
  servicesUsed: Record<string, boolean>;
}

export type RunModifier =
  | { kind: "gold_multiplier"; value: number }
  | { kind: "shop_discount"; value: number }
  | { kind: "global_stat"; stat: keyof UnitStats; value: number }
  | { kind: "first_hit_bonus_damage"; amount: number }
  | { kind: "next_combat_blessing" }
  | { kind: "reward_xp_multiplier"; value: number }
  | { kind: "enemy_hp_multiplier"; value: number }
  | { kind: "enemy_damage_bonus"; value: number }
  | { kind: "event_dc_bonus"; value: number }
  | { kind: "event_reward_multiplier"; value: number }
  | { kind: "elite_reward_multiplier"; value: number };

/**
 * A telegraphed boss heavy attack that was "wound up" on a previous boss turn and resolves
 * on the boss's next turn (F28 / #59). The target hexes are fixed when the telegraph is set
 * so the player has a full round to read the threat and reposition. Schedule is RNG-free —
 * only the resolution damage rolls draw from the shared seeded stream.
 */
export interface BossTelegraph {
  /** Unit instance that wound up the telegraph. */
  sourceId: string;
  /** The action whose effect lands on resolution (e.g. `action.ground_slam`). */
  actionId: string;
  /** Axial hex keys (`q,r`) that will be struck when the telegraph resolves. */
  targetHexes: string[];
  /** Round on which the telegraph was set, for logging/inspection. */
  setOnRound: number;
}

/**
 * Generic per-combat state for data-driven enemy and encounter traits.
 */
export interface CombatTraitState {
  /**
   * Per-unit action rotation index, keyed as `${unitInstanceId}:${traitId}`.
   */
  actionRotationIndex?: Record<string, number>;
  /**
   * Once-only trigger registry, keyed as `${unitInstanceId}:${traitId}` for unit
   * traits or `encounter:${traitId}` for encounter traits.
   */
  triggered?: Record<string, true>;
}

export interface CombatState {
  round: number;
  activeIndex: number;
  turnQueue: string[];
  units: UnitInstance[];
  log: CombatLogEntry[];
  status: "active" | "victory" | "defeat";
  gridKeys: string[];
  targetingActionId: string | null;
  perEncounterUses: Record<string, number>;
  /** Generic per-combat trait state for data-driven boss and encounter mechanics. */
  traitState?: CombatTraitState;
  /** Pending telegraphed boss attack, or null/undefined when none is wound up (boss only). */
  bossTelegraph?: BossTelegraph | null;
  encounterId?: string;
  /** Map node type that launched this combat, used by renderers to pick themed environments. */
  sourceNodeType?: NodeType;
  /** Resolved visual environment theme for the combat arena. */
  theme?: CombatEnvironmentThemeId;
  difficulty?: "normal" | "hard";
  /** Cumulative enemy damage bonus from adventure modifiers, stacks with difficulty. */
  modifierDamageBonus?: number;
  /** Per-hex terrain overlay keyed by hexKey (e.g. "0,0"). Normal tiles are omitted; missing key = "normal". */
  terrain?: Record<string, TerrainType>;
}
