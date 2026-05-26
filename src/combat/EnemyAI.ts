import type { UnitInstance, CombatState } from "../state/types.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { distance, hexKey } from "../core/hex.ts";
import { reachableHexes } from "./Movement.ts";
import { resolveAction, validTargets } from "./Action.ts";

const BOSS_ROTATION = ["action.roar", "action.massive_swing", "action.ground_slam"] as const;

function pickTarget(unit: UnitInstance, state: CombatState): UnitInstance | null {
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

function executeBossTurn(unit: UnitInstance, state: CombatState, rng: () => number): void {
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
