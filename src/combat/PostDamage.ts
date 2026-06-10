import type { CombatState, Hex, HeroLifeState, Team } from "../state/types.ts";
import { heroLifeState, markHeroDowned } from "./DeathSaves.ts";
import {
  checkEnemyThresholdTraits,
  checkEncounterDeathTraits,
  getTraitTriggered,
  markTraitTriggered,
} from "./Traits.ts";
export type { ThresholdTraitResult, EncounterDeathTraitResult } from "./Traits.ts";

export type PostDamageCause =
  | "single_target"
  | "aoe"
  | "line"
  | "adjacent"
  | "boss_telegraph"
  | "hazard"
  | "trait"
  | "item"
  | "retaliation"
  | "environment";

export type PostDamageCategory =
  | "weapon"
  | "spell"
  | "hazard"
  | "trait"
  | "item"
  | "environment"
  | "unknown";

export interface PostDamageInput {
  state: CombatState;
  targetUnitId: string;
  sourceUnitId?: string;
  actionId?: string;
  cause: PostDamageCause;
  category?: PostDamageCategory;
  /** HP of the target before damage was applied. Required for idempotency guards. */
  previousHp: number;
  /** If omitted, derived from previousHp - currentHp. */
  damageAmount?: number;
  position?: Hex;
  /** default true */
  allowThresholdTraits?: boolean;
  /** default true */
  allowEncounterDeathTraits?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PostDamageResult {
  state: CombatState;
  targetUnitId: string;
  targetFound: boolean;
  previousHp: number;
  currentHp: number;
  damageApplied: number;
  newlyDroppedToZero: boolean;
  wasAlreadyZero: boolean;
  targetTeam?: Team;
  targetLifeState?: HeroLifeState;
  targetDowned: boolean;
  targetDead: boolean;
  /** Enemy defeated OR hero dead (downed alone is not defeated). */
  targetDefeated: boolean;
  /** Hero standing OR enemy hp > 0. */
  targetStillValid: boolean;
  shouldStopCaller: boolean;
  triggeredBossThreshold: boolean;
  triggeredReinforcements: boolean;
  spawnedReinforcementIds: string[];
  triggeredEncounterDeathTraits: boolean;
  triggeredEliteRally: boolean;
  clearedTelegraph: boolean;
  /** Caller should run checkVictoryDefeat when true. */
  shouldCheckCombatEnd: boolean;
  logEntriesAdded: number;
}

/**
 * Central aftermath helper called after a unit's HP has already been reduced.
 * Resolves threshold traits, death/downed state, enemy defeat, encounter death traits,
 * elite rally, telegraph cleanup, and logs — for every damage source.
 *
 * Does NOT: roll damage, roll death saves, transition UI screens, or call checkVictoryDefeat.
 */
export function resolvePostDamageAftermath(input: PostDamageInput): PostDamageResult {
  const {
    state,
    targetUnitId,
    previousHp,
    allowThresholdTraits = true,
    allowEncounterDeathTraits = true,
  } = input;

  const logsBefore = state.log.length;

  // Step 1: Re-read target unit.
  const target = state.units.find((u) => u.instanceId === targetUnitId);
  if (!target) {
    return {
      state,
      targetUnitId,
      targetFound: false,
      previousHp,
      currentHp: 0,
      damageApplied: 0,
      newlyDroppedToZero: false,
      wasAlreadyZero: false,
      targetDowned: false,
      targetDead: false,
      targetDefeated: false,
      targetStillValid: false,
      shouldStopCaller: true,
      triggeredBossThreshold: false,
      triggeredReinforcements: false,
      spawnedReinforcementIds: [],
      triggeredEncounterDeathTraits: false,
      triggeredEliteRally: false,
      clearedTelegraph: false,
      shouldCheckCombatEnd: false,
      logEntriesAdded: 0,
    };
  }

  // Step 2: Derive computed values.
  const currentHp = target.hp;
  const damageApplied = input.damageAmount ?? Math.max(0, previousHp - currentHp);
  const wasAlreadyZero = previousHp <= 0;
  const newlyDroppedToZero = previousHp > 0 && currentHp <= 0;

  let triggeredBossThreshold = false;
  let triggeredReinforcements = false;
  let spawnedReinforcementIds: string[] = [];
  let triggeredEncounterDeathTraits = false;
  let triggeredEliteRally = false;
  let clearedTelegraph = false;

  // Step 3: Boss threshold traits — evaluated before drop-to-zero (preserves current ordering).
  if (target.team === "enemy" && allowThresholdTraits) {
    const thresholdResult = checkEnemyThresholdTraits(target, state);
    triggeredBossThreshold = thresholdResult.triggeredBossThreshold;
    triggeredReinforcements = thresholdResult.triggeredReinforcements;
    spawnedReinforcementIds = thresholdResult.spawnedReinforcementIds;
  }

  // Step 4: Drop-to-zero resolution.
  if (newlyDroppedToZero) {
    if (target.team === "hero") {
      markHeroDowned(target, state);
    } else {
      // Guard with durable key so a second call never re-logs the defeat.
      const defeatKey = `defeat_logged:${target.instanceId}`;
      if (!getTraitTriggered(state, defeatKey)) {
        markTraitTriggered(state, defeatKey);
        state.log.push({
          kind: "defeat",
          text: `[T${state.round}] ${target.displayName} is defeated.`,
          round: state.round,
        });
      }
    }
  }

  // Step 5: Encounter death traits (after drop-to-zero, enemy only).
  if (newlyDroppedToZero && target.team === "enemy" && allowEncounterDeathTraits) {
    const encounterResult = checkEncounterDeathTraits(target, state);
    triggeredEncounterDeathTraits = encounterResult.triggeredEncounterDeathTraits;
    triggeredEliteRally = encounterResult.triggeredEliteRally;
  }

  // Step 6: Clear telegraph if the defeated/downed unit was the source.
  if (newlyDroppedToZero && state.bossTelegraph?.sourceId === targetUnitId) {
    state.bossTelegraph = null;
    clearedTelegraph = true;
  }

  const lifeState = target.team === "hero" ? heroLifeState(target) : undefined;
  const targetDowned = target.team === "hero" && lifeState === "downed";
  const targetDead = target.team === "hero" && lifeState === "dead";
  const targetDefeated = (target.team === "enemy" && target.hp <= 0) || targetDead;
  const targetStillValid =
    target.team === "hero" ? lifeState === "standing" : target.hp > 0;

  return {
    state,
    targetUnitId,
    targetFound: true,
    previousHp,
    currentHp,
    damageApplied,
    newlyDroppedToZero,
    wasAlreadyZero,
    targetTeam: target.team,
    targetLifeState: lifeState,
    targetDowned,
    targetDead,
    targetDefeated,
    targetStillValid,
    shouldStopCaller: !targetStillValid,
    triggeredBossThreshold,
    triggeredReinforcements,
    spawnedReinforcementIds,
    triggeredEncounterDeathTraits,
    triggeredEliteRally,
    clearedTelegraph,
    shouldCheckCombatEnd: newlyDroppedToZero,
    logEntriesAdded: state.log.length - logsBefore,
  };
}
