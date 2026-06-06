import type { UnitInstance, CombatState } from "../state/types.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { distance, hexKey, neighbors } from "../core/hex.ts";
import { reachableHexes } from "./Movement.ts";
import { resolveAction, validTargets, resolveBossTelegraph } from "./Action.ts";

const BOSS_ROTATION = ["action.roar", "action.massive_swing", "action.ground_slam"] as const;

/** The heavy attack the boss telegraphs when enraged (F28 / #59). */
const BOSS_TELEGRAPH_ACTION = "action.ground_slam";

/** Flat bonus damage the ambusher adds when it strikes an exposed or wounded hero. */
const AMBUSH_BURST_BONUS = 3;
/** Distance the ambusher edges toward the party while waiting for an opening. */
const AMBUSH_HOLD_RANGE = 2;

function pickTarget(unit: UnitInstance, state: CombatState): UnitInstance | null {
  // Honor forced target (taunt) - must target the unit that taunted this enemy.
  if (unit.forcedTargetId) {
    const forced = state.units.find((u) => u.instanceId === unit.forcedTargetId && u.hp > 0);
    if (forced) return forced;
  }
  const heroes = state.units.filter((u) => u.team === "hero" && u.hp > 0);
  if (heroes.length === 0) return null;
  heroes.sort((a, b) => {
    if (a.hp !== b.hp) return a.hp - b.hp;
    const da = distance(unit.pos, a.pos);
    const db = distance(unit.pos, b.pos);
    if (da !== db) return da - db;
    return a.instanceId.localeCompare(b.instanceId);
  });
  return heroes[0];
}

function pickAdjacentTarget(unit: UnitInstance, state: CombatState): UnitInstance | null {
  const heroes = state.units.filter((u) => u.team === "hero" && u.hp > 0 && distance(unit.pos, u.pos) <= 1);
  if (heroes.length === 0) return null;
  heroes.sort((a, b) => a.hp - b.hp);
  return heroes[0];
}

function buildOccupied(unit: UnitInstance, state: CombatState): Set<string> {
  return new Set(
    state.units.filter((u) => u.hp > 0 && u.instanceId !== unit.instanceId).map((u) => hexKey(u.pos)),
  );
}

function moveToward(
  unit: UnitInstance,
  target: { q: number; r: number },
  state: CombatState,
): void {
  const reachable = reachableHexes(unit.pos, unit.movePointsRemaining, buildOccupied(unit, state), new Set(state.gridKeys));

  let bestKey: string | null = null;
  let bestDist = distance(unit.pos, target);

  for (const [key] of reachable) {
    const parts = key.split(",").map(Number);
    const hex = { q: parts[0], r: parts[1] };
    const dist = distance(hex, target);
    if (dist < bestDist) {
      bestKey = key;
      bestDist = dist;
    }
  }

  if (bestKey !== null) {
    const cost = reachable.get(bestKey) ?? 0;
    const parts = bestKey.split(",").map(Number);
    unit.pos = { q: parts[0], r: parts[1] };
    unit.movePointsRemaining -= cost;
    state.log.push({
      kind: "move",
      text: `[T${state.round}] ${unit.displayName} moves to (${unit.pos.q}, ${unit.pos.r}). ${unit.movePointsRemaining} move remaining.`,
      round: state.round,
    });
  }
}

function moveToPreferredRange(
  unit: UnitInstance,
  target: { q: number; r: number },
  preferredRange: number,
  state: CombatState,
): void {
  const curDist = distance(unit.pos, target);
  if (curDist === preferredRange) return;

  const reachable = reachableHexes(unit.pos, unit.movePointsRemaining, buildOccupied(unit, state), new Set(state.gridKeys));

  let bestKey: string | null = null;
  let bestDiff = Math.abs(curDist - preferredRange);

  for (const [key] of reachable) {
    const parts = key.split(",").map(Number);
    const hex = { q: parts[0], r: parts[1] };
    const diff = Math.abs(distance(hex, target) - preferredRange);
    if (diff < bestDiff) {
      bestKey = key;
      bestDiff = diff;
    }
  }

  if (bestKey !== null) {
    const cost = reachable.get(bestKey) ?? 0;
    const parts = bestKey.split(",").map(Number);
    unit.pos = { q: parts[0], r: parts[1] };
    unit.movePointsRemaining -= cost;
    state.log.push({
      kind: "move",
      text: `[T${state.round}] ${unit.displayName} moves to (${unit.pos.q}, ${unit.pos.r}). ${unit.movePointsRemaining} move remaining.`,
      round: state.round,
    });
  }
}

/** The boss is enraged (and starts telegraphing heavy attacks) at or below half HP. */
function isBossEnraged(boss: UnitInstance): boolean {
  return boss.hp <= Math.floor(boss.stats.maxHp / 2);
}

/**
 * Telegraphed heavy attack (F28 / #59). Once enraged (≤50% HP) the boss alternates between
 * "winding up" — marking every adjacent hex as a threat for a full round — and unleashing
 * Ground Slam on those hexes its next turn. Heroes get a turn to reposition out of the area.
 * The schedule is deterministic: the only RNG is the resolution damage roll.
 *
 * @returns true if the telegraph system handled this turn (boss should not also act).
 */
function handleBossTelegraph(unit: UnitInstance, state: CombatState, rng: () => number): boolean {
  // A wound-up telegraph always resolves on the next boss turn.
  if (state.bossTelegraph) {
    resolveBossTelegraph(unit, state, rng);
    return true;
  }
  // Enraged with no pending telegraph: wind one up this turn instead of a normal action.
  if (isBossEnraged(unit)) {
    const targetHexes = neighbors(unit.pos)
      .map(hexKey)
      .filter((key) => state.gridKeys.includes(key));
    state.bossTelegraph = {
      sourceId: unit.instanceId,
      actionId: BOSS_TELEGRAPH_ACTION,
      targetHexes,
      setOnRound: state.round,
    };
    state.log.push({
      kind: "action",
      text: `[T${state.round}] ${unit.displayName} winds up Ground Slam — every adjacent hex will be struck next turn! Move clear!`,
      round: state.round,
    });
    return true;
  }
  return false;
}

function executeBossTurn(unit: UnitInstance, state: CombatState, rng: () => number): void {
  if (handleBossTelegraph(unit, state, rng)) return;

  const idx = state.bossActionIndex ?? 0;
  const actionId = BOSS_ROTATION[idx % 3];
  state.bossActionIndex = idx + 1;

  const action = ACTION_REGISTRY[actionId];
  if (!action) return;

  if (actionId === "action.roar") {
    const anyInRange = state.units.some(
      (u) => u.team === "hero" && u.hp > 0 && distance(unit.pos, u.pos) <= action.range,
    );
    if (anyInRange) {
      resolveAction(action, unit, unit, state, rng);
      return;
    }
  }

  if (actionId === "action.ground_slam") {
    const adjTarget = pickAdjacentTarget(unit, state);
    if (adjTarget) {
      resolveAction(action, unit, adjTarget, state, rng);
      return;
    }
    moveToward(unit, pickTarget(unit, state)?.pos ?? { q: 0, r: 0 }, state);
    const newAdj = pickAdjacentTarget(unit, state);
    if (newAdj) {
      resolveAction(action, unit, newAdj, state, rng);
      return;
    }
    const fallbackAction = ACTION_REGISTRY["action.massive_swing"];
    if (fallbackAction) {
      const target = pickTarget(unit, state);
      if (!target) return;
      if (distance(unit.pos, target.pos) <= fallbackAction.range) {
        const targets = validTargets(fallbackAction, unit, state);
        if (targets.length > 0) {
          resolveAction(fallbackAction, unit, targets[0], state, rng);
          return;
        }
      }
      moveToward(unit, target.pos, state);
      if (distance(unit.pos, target.pos) <= fallbackAction.range) {
        const targets = validTargets(fallbackAction, unit, state);
        if (targets.length > 0) {
          resolveAction(fallbackAction, unit, targets[0], state, rng);
        }
      }
    }
    return;
  }

  const target = pickTarget(unit, state);
  if (!target) return;

  const inRange = distance(unit.pos, target.pos) <= action.range;
  if (inRange) {
    const targets = validTargets(action, unit, state);
    if (targets.length > 0) {
      resolveAction(action, unit, targets[0], state, rng);
      return;
    }
  }
  moveToward(unit, target.pos, state);
  if (distance(unit.pos, target.pos) <= action.range) {
    const targets = validTargets(action, unit, state);
    if (targets.length > 0) {
      resolveAction(action, unit, targets[0], state, rng);
    }
  }
}

/** A hero is "exposed" when no living ally stands adjacent to shield them. */
function isExposed(hero: UnitInstance, state: CombatState): boolean {
  return !state.units.some(
    (u) =>
      u.team === "hero" &&
      u.hp > 0 &&
      u.instanceId !== hero.instanceId &&
      distance(hero.pos, u.pos) <= 1,
  );
}

/** A hero is "wounded" once at or below half their max HP. */
function isWounded(hero: UnitInstance): boolean {
  return hero.hp <= Math.floor(hero.stats.maxHp / 2);
}

function ambushTargetOrder(unit: UnitInstance) {
  return (a: UnitInstance, b: UnitInstance): number => {
    if (a.hp !== b.hp) return a.hp - b.hp;
    const da = distance(unit.pos, a.pos);
    const db = distance(unit.pos, b.pos);
    if (da !== db) return da - db;
    return a.instanceId.localeCompare(b.instanceId);
  };
}

/**
 * Ambusher: a high-burst opportunist. It holds back until a hero is wounded or caught
 * exposed, then rushes that target and strikes with a first-strike burst bonus. With no
 * opening it still strikes anything already in melee reach (no bonus) so it never stalls,
 * and otherwise edges toward the party at a cautious range, biding for an opening.
 */
function executeAmbusherTurn(unit: UnitInstance, state: CombatState, rng: () => number): void {
  const enemyDef = ENEMY_REGISTRY[unit.defId];
  const action = ACTION_REGISTRY[enemyDef.actionIds[0]];
  if (!action) return;

  const heroes = state.units.filter((u) => u.team === "hero" && u.hp > 0);
  if (heroes.length === 0) return;

  const order = ambushTargetOrder(unit);
  const prime = heroes.filter((h) => isWounded(h) || isExposed(h, state)).sort(order);

  if (prime.length > 0) {
    const target = prime[0];
    if (distance(unit.pos, target.pos) > action.range) {
      moveToward(unit, target.pos, state);
    }
    if (distance(unit.pos, target.pos) <= action.range) {
      const targets = validTargets(action, unit, state);
      const finalTarget = targets.find((t) => t.instanceId === target.instanceId);
      if (finalTarget) {
        state.log.push({
          kind: "action",
          text: `[T${state.round}] ${unit.displayName} catches ${finalTarget.displayName} exposed — Ambush! (+${AMBUSH_BURST_BONUS} burst)`,
          round: state.round,
        });
        resolveAction(action, unit, finalTarget, state, rng, false, AMBUSH_BURST_BONUS);
      }
    }
    return;
  }

  // No opening: strike a foe already in reach (no burst) rather than stand idle.
  const inReach = heroes.filter((h) => distance(unit.pos, h.pos) <= action.range).sort(order);
  if (inReach.length > 0) {
    const targets = validTargets(action, unit, state);
    const finalTarget = targets.find((t) => t.instanceId === inReach[0].instanceId);
    if (finalTarget) {
      resolveAction(action, unit, finalTarget, state, rng);
      return;
    }
  }

  // Otherwise hold back near the party, waiting for a target to become vulnerable.
  const nearest = [...heroes].sort((a, b) => distance(unit.pos, a.pos) - distance(unit.pos, b.pos))[0];
  moveToPreferredRange(unit, nearest.pos, AMBUSH_HOLD_RANGE, state);
}

export function takeEnemyTurn(
  unit: UnitInstance,
  state: CombatState,
  rng: () => number,
): void {
  const enemyDef = ENEMY_REGISTRY[unit.defId];
  if (!enemyDef) return;
  const aiTag = enemyDef.aiTag;
  const actionIds = enemyDef.actionIds;
  if (actionIds.length === 0) return;

  if (aiTag === "boss") {
    executeBossTurn(unit, state, rng);
    return;
  }

  if (aiTag === "ambusher") {
    executeAmbusherTurn(unit, state, rng);
    return;
  }

  const primaryActionId = actionIds[0];
  const action = ACTION_REGISTRY[primaryActionId];
  if (!action) return;

  const target = pickTarget(unit, state);
  if (!target) return;

  if (aiTag === "brute") {
    const inRange = distance(unit.pos, target.pos) <= action.range;
    if (inRange) {
      const targets = validTargets(action, unit, state);
      if (targets.length > 0) {
        resolveAction(action, unit, targets[0], state, rng);
        return;
      }
    }
    moveToward(unit, target.pos, state);
    if (distance(unit.pos, target.pos) <= action.range) {
      const targets = validTargets(action, unit, state);
      if (targets.length > 0) {
        resolveAction(action, unit, targets[0], state, rng);
      }
    }
  } else {
    const curDist = distance(unit.pos, target.pos);
    if (curDist !== action.range) {
      moveToPreferredRange(unit, target.pos, action.range, state);
    }
    if (distance(unit.pos, target.pos) <= action.range) {
      const targets = validTargets(action, unit, state);
      if (targets.length > 0) {
        resolveAction(action, unit, targets[0], state, rng);
      }
    }
  }
}
