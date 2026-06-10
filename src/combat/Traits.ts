import type { CombatState, UnitInstance } from "../state/types.ts";
import type { EnemyTraitDef, EncounterTraitDef } from "../data/traits.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { ENCOUNTER_REGISTRY } from "../data/encounters.ts";
import { neighbors, hexKey } from "../core/hex.ts";
import { applyCondition } from "./Condition.ts";

/** Fallback rally bonus used for logging when trait data has no attackBonus. */
const DEFAULT_RALLY_ATTACK_BONUS = 2;

export function getEnemyTraits(unit: UnitInstance): EnemyTraitDef[] {
  return ENEMY_REGISTRY[unit.defId]?.traits ?? [];
}

export function getEncounterTraits(state: CombatState): EncounterTraitDef[] {
  if (!state.encounterId) return [];
  return ENCOUNTER_REGISTRY[state.encounterId]?.traits ?? [];
}

function ensureTraitState(state: CombatState): NonNullable<CombatState["traitState"]> {
  if (!state.traitState) {
    state.traitState = { actionRotationIndex: {}, triggered: {} };
  }
  return state.traitState;
}

export function getTraitTriggered(state: CombatState, key: string): boolean {
  return state.traitState?.triggered?.[key] === true;
}

export function markTraitTriggered(state: CombatState, key: string): void {
  const ts = ensureTraitState(state);
  if (!ts.triggered) ts.triggered = {};
  ts.triggered[key] = true;
}

export function getRotationIndex(state: CombatState, unit: UnitInstance, traitId: string): number {
  const key = `${unit.instanceId}:${traitId}`;
  return state.traitState?.actionRotationIndex?.[key] ?? 0;
}

export function advanceRotationIndex(
  state: CombatState,
  unit: UnitInstance,
  traitId: string,
): void {
  const ts = ensureTraitState(state);
  if (!ts.actionRotationIndex) ts.actionRotationIndex = {};
  const key = `${unit.instanceId}:${traitId}`;
  ts.actionRotationIndex[key] = (ts.actionRotationIndex[key] ?? 0) + 1;
}

/**
 * Returns the next action ID from the boss_action_rotation trait and advances the index.
 * Returns null if the unit has no rotation trait (fall back to actionIds[0]).
 */
export function getBossRotationActionId(
  unit: UnitInstance,
  state: CombatState,
): string | null {
  const rotTrait = getEnemyTraits(unit).find(
    (t): t is Extract<EnemyTraitDef, { id: "boss_action_rotation" }> =>
      t.id === "boss_action_rotation",
  );
  if (!rotTrait) return null;
  const idx = getRotationIndex(state, unit, "boss_action_rotation");
  const actionId = rotTrait.actionIds[idx % rotTrait.actionIds.length];
  advanceRotationIndex(state, unit, "boss_action_rotation");
  return actionId;
}

/**
 * Checks whether trait data should wind up a boss telegraph this turn.
 * Only handles the wind-up phase; telegraph resolution is done by the caller (EnemyAI).
 *
 * @returns true if a telegraph was wound up (boss should not take a normal action).
 */
export function handleEnemyStartTurnTraits(
  unit: UnitInstance,
  state: CombatState,
): boolean {
  const telegraphTrait = getEnemyTraits(unit).find(
    (t): t is Extract<EnemyTraitDef, { id: "boss_ground_slam_telegraph" }> =>
      t.id === "boss_ground_slam_telegraph",
  );
  if (!telegraphTrait) return false;

  const threshold = Math.floor(unit.stats.maxHp * telegraphTrait.thresholdHpPct);
  if (unit.hp > threshold) return false;

  const targetHexes = neighbors(unit.pos)
    .map(hexKey)
    .filter((key) => state.gridKeys.includes(key));
  state.bossTelegraph = {
    sourceId: unit.instanceId,
    actionId: telegraphTrait.actionId,
    targetHexes,
    setOnRound: state.round,
  };
  const warning =
    telegraphTrait.warningText ??
    `winds up ${telegraphTrait.actionId} — every adjacent hex will be struck next turn! Move clear!`;
  state.log.push({
    kind: "action",
    text: `[T${state.round}] ${unit.displayName} ${warning}`,
    round: state.round,
  });
  return true;
}

export interface ThresholdTraitResult {
  triggeredBossThreshold: boolean;
  triggeredReinforcements: boolean;
  spawnedReinforcementIds: string[];
}

/**
 * Checks boss_reinforcement_at_hp_threshold traits after a unit takes damage.
 * Spawns reinforcements using ENEMY_REGISTRY stats (not hardcoded values).
 */
export function checkEnemyThresholdTraits(
  damagedUnit: UnitInstance,
  state: CombatState,
): ThresholdTraitResult {
  const result: ThresholdTraitResult = {
    triggeredBossThreshold: false,
    triggeredReinforcements: false,
    spawnedReinforcementIds: [],
  };

  for (const trait of getEnemyTraits(damagedUnit)) {
    if (trait.id !== "boss_reinforcement_at_hp_threshold") continue;

    const triggeredKey = `${damagedUnit.instanceId}:boss_reinforcement_at_hp_threshold`;
    if (getTraitTriggered(state, triggeredKey)) continue;

    const threshold = Math.floor(damagedUnit.stats.maxHp * trait.thresholdHpPct);
    if (damagedUnit.hp > threshold) continue;

    result.triggeredBossThreshold = true;
    markTraitTriggered(state, triggeredKey);

    const def = ENEMY_REGISTRY[trait.enemyId];
    if (!def) continue;

    const spawnCount = trait.count ?? 1;
    const activeId = state.turnQueue[state.activeIndex];
    const bossIdx = state.turnQueue.indexOf(damagedUnit.instanceId);

    for (let i = 0; i < spawnCount; i++) {
      const occupied = new Set(state.units.filter((u) => u.hp > 0).map((u) => hexKey(u.pos)));
      let spawnPos: { q: number; r: number } | null = null;
      for (const pos of trait.spawnCandidates) {
        const key = hexKey(pos);
        if (!occupied.has(key) && state.gridKeys.includes(key)) {
          spawnPos = pos;
          break;
        }
      }
      if (!spawnPos) break;

      const n = (state.reinforcementCounter ?? 0) + 1;
      state.reinforcementCounter = n;

      const reinforcement: UnitInstance = {
        instanceId: `${damagedUnit.instanceId}_reinforcement_${n}`,
        defId: def.id,
        displayName: def.displayName,
        team: "enemy",
        level: 1,
        xp: 0,
        stats: { ...def.baseStats },
        hp: def.baseStats.maxHp,
        pos: spawnPos,
        conditions: [],
        movePointsRemaining: 0,
        hasActed: false,
        equippedItemIds: { weapon: null, armor: null, trinket: null },
        bonusStats: {},
      };
      state.units.push(reinforcement);

      const insertAt = bossIdx >= 0 ? bossIdx + 1 + i : state.turnQueue.length;
      state.turnQueue.splice(insertAt, 0, reinforcement.instanceId);

      result.triggeredReinforcements = true;
      result.spawnedReinforcementIds.push(reinforcement.instanceId);
    }

    const newActiveIndex = state.turnQueue.indexOf(activeId);
    if (newActiveIndex >= 0) {
      state.activeIndex = newActiveIndex;
    }

    state.log.push({
      kind: "action",
      text: `[T${state.round}] ${trait.logText ?? `${damagedUnit.displayName} calls reinforcement — a ${def.displayName} joins!`}`,
      round: state.round,
    });
  }

  return result;
}

export interface EncounterDeathTraitResult {
  triggeredEncounterDeathTraits: boolean;
  triggeredEliteRally: boolean;
}

/**
 * Checks elite_rally_on_first_death traits when an enemy falls.
 * Applies the rallied condition to all survivors on first trigger only.
 */
export function checkEncounterDeathTraits(
  fallenUnit: UnitInstance,
  state: CombatState,
): EncounterDeathTraitResult {
  const result: EncounterDeathTraitResult = {
    triggeredEncounterDeathTraits: false,
    triggeredEliteRally: false,
  };

  if (fallenUnit.team !== "enemy") return result;

  for (const trait of getEncounterTraits(state)) {
    if (trait.id !== "elite_rally_on_first_death") continue;

    const triggeredKey = "encounter:elite_rally_on_first_death";
    if (getTraitTriggered(state, triggeredKey)) continue;

    const survivors = state.units.filter((u) => u.team === "enemy" && u.hp > 0);
    if (survivors.length === 0) continue;

    markTraitTriggered(state, triggeredKey);
    for (const enemy of survivors) {
      applyCondition(enemy, "rallied", trait.duration);
    }
    const bonus = trait.attackBonus ?? DEFAULT_RALLY_ATTACK_BONUS;
    const logText = trait.logText ?? "the survivors Rally!";
    state.log.push({
      kind: "action",
      text: `[T${state.round}] ${fallenUnit.displayName} falls — ${logText} (+${bonus} to hit for ${trait.duration} turns)`,
      round: state.round,
    });

    result.triggeredEncounterDeathTraits = true;
    result.triggeredEliteRally = true;
  }

  return result;
}
