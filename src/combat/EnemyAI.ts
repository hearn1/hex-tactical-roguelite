import type { UnitInstance, CombatState, Hex } from "../state/types.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { distance, hexKey, parseHexKey } from "../core/hex.ts";
import { reachableHexes, findPath } from "./Movement.ts";
import { resolveAction, validTargets, resolveBossTelegraph } from "./Action.ts";
import { isTargetableByEnemies, isStandingHero } from "./DeathSaves.ts";
import { getBossRotationActionId, handleEnemyStartTurnTraits } from "./Traits.ts";
import { movementCostForHex, applyHazardsForMovementPath } from "./Terrain.ts";

interface MovementResolutionResult {
  moved: boolean;
  from: import("../state/types.ts").Hex;
  to: import("../state/types.ts").Hex;
  stoppedAtHex?: import("../state/types.ts").Hex;
  unitStillActive: boolean;
  shouldStopCaller: boolean;
}

/** Flat bonus damage the ambusher adds when it strikes an exposed or wounded hero. */
const AMBUSH_BURST_BONUS = 3;
/** Distance the ambusher edges toward the party while waiting for an opening. */
const AMBUSH_HOLD_RANGE = 2;

function pickTarget(unit: UnitInstance, state: CombatState): UnitInstance | null {
  // Honor forced target (taunt) — only if that hero is still a valid standing target.
  if (unit.forcedTargetId) {
    const forced = state.units.find((u) => u.instanceId === unit.forcedTargetId && isTargetableByEnemies(u));
    if (forced) return forced;
  }
  const heroes = state.units.filter((u) => u.team === "hero" && isTargetableByEnemies(u));
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
  const heroes = state.units.filter((u) => u.team === "hero" && isTargetableByEnemies(u) && distance(unit.pos, u.pos) <= 1);
  if (heroes.length === 0) return null;
  heroes.sort((a, b) => a.hp - b.hp);
  return heroes[0];
}

function buildOccupied(unit: UnitInstance, state: CombatState): Set<string> {
  return new Set(
    state.units
      .filter((u) => {
        if (u.instanceId === unit.instanceId) return false;
        if (u.hp > 0) return true;
        // Downed/stable heroes still physically occupy their hex.
        return u.team === "hero" && (u.heroLifeState === "downed" || u.heroLifeState === "stable");
      })
      .map((u) => hexKey(u.pos)),
  );
}

function moveToward(
  unit: UnitInstance,
  target: Hex,
  state: CombatState,
): MovementResolutionResult {
  const from = { ...unit.pos };
  const occ = buildOccupied(unit, state);
  const gridKeys = new Set(state.gridKeys);
  const costFn = (h: Hex) => movementCostForHex(state, h);
  const reachable = reachableHexes(unit.pos, unit.movePointsRemaining, occ, gridKeys, costFn);

  let bestKey: string | null = null;
  let bestDist = distance(unit.pos, target);

  for (const [key] of reachable) {
    const hex = parseHexKey(key);
    const dist = distance(hex, target);
    if (dist < bestDist) {
      bestKey = key;
      bestDist = dist;
    }
  }

  if (bestKey === null) {
    return { moved: false, from, to: from, unitStillActive: unit.hp > 0, shouldStopCaller: false };
  }

  const cost = reachable.get(bestKey) ?? 0;
  const dest = parseHexKey(bestKey);
  unit.pos = dest;
  unit.movePointsRemaining -= cost;
  state.log.push({
    kind: "move",
    text: `[T${state.round}] ${unit.displayName} moves to (${unit.pos.q}, ${unit.pos.r}). ${unit.movePointsRemaining} move remaining.`,
    round: state.round,
  });
  const path = findPath(from, dest, occ, gridKeys, cost + 1, costFn);
  let stoppedAtHex: Hex | undefined;
  let shouldStopCaller = false;
  if (path && path.length > 0) {
    const hazardResult = applyHazardsForMovementPath(unit, state, path);
    if (hazardResult.shouldStopCaller) {
      stoppedAtHex = hazardResult.stoppedAtHex;
      shouldStopCaller = true;
    }
  }
  return { moved: true, from, to: { ...unit.pos }, stoppedAtHex, unitStillActive: !shouldStopCaller, shouldStopCaller };
}

function moveToPreferredRange(
  unit: UnitInstance,
  target: Hex,
  preferredRange: number,
  state: CombatState,
): MovementResolutionResult {
  const from = { ...unit.pos };
  const curDist = distance(unit.pos, target);
  if (curDist === preferredRange) {
    return { moved: false, from, to: from, unitStillActive: unit.hp > 0, shouldStopCaller: false };
  }

  const occ = buildOccupied(unit, state);
  const gridKeys = new Set(state.gridKeys);
  const costFn = (h: Hex) => movementCostForHex(state, h);
  const reachable = reachableHexes(unit.pos, unit.movePointsRemaining, occ, gridKeys, costFn);

  let bestKey: string | null = null;
  let bestDiff = Math.abs(curDist - preferredRange);

  for (const [key] of reachable) {
    const hex = parseHexKey(key);
    const diff = Math.abs(distance(hex, target) - preferredRange);
    if (diff < bestDiff) {
      bestKey = key;
      bestDiff = diff;
    }
  }

  if (bestKey === null) {
    return { moved: false, from, to: from, unitStillActive: unit.hp > 0, shouldStopCaller: false };
  }

  const cost = reachable.get(bestKey) ?? 0;
  const dest = parseHexKey(bestKey);
  unit.pos = dest;
  unit.movePointsRemaining -= cost;
  state.log.push({
    kind: "move",
    text: `[T${state.round}] ${unit.displayName} moves to (${unit.pos.q}, ${unit.pos.r}). ${unit.movePointsRemaining} move remaining.`,
    round: state.round,
  });
  const path = findPath(from, dest, occ, gridKeys, cost + 1, costFn);
  let stoppedAtHex: Hex | undefined;
  let shouldStopCaller = false;
  if (path && path.length > 0) {
    const hazardResult = applyHazardsForMovementPath(unit, state, path);
    if (hazardResult.shouldStopCaller) {
      stoppedAtHex = hazardResult.stoppedAtHex;
      shouldStopCaller = true;
    }
  }
  return { moved: true, from, to: { ...unit.pos }, stoppedAtHex, unitStillActive: !shouldStopCaller, shouldStopCaller };
}

function executeBossTurn(unit: UnitInstance, state: CombatState, rng: () => number): void {
  // Resolve a wound-up telegraph before any other action.
  if (state.bossTelegraph && state.bossTelegraph.sourceId === unit.instanceId) {
    resolveBossTelegraph(unit, state, rng);
    return;
  }
  // Wind up a new telegraph if traits trigger it.
  if (handleEnemyStartTurnTraits(unit, state)) return;

  const actionId = getBossRotationActionId(unit, state) ?? ENEMY_REGISTRY[unit.defId]?.actionIds[0];

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
    const mr1 = moveToward(unit, pickTarget(unit, state)?.pos ?? { q: 0, r: 0 }, state);
    if (!mr1.unitStillActive) return;
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
      const mr2 = moveToward(unit, target.pos, state);
      if (!mr2.unitStillActive) return;
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
  const mr3 = moveToward(unit, target.pos, state);
  if (!mr3.unitStillActive) return;
  if (distance(unit.pos, target.pos) <= action.range) {
    const targets = validTargets(action, unit, state);
    if (targets.length > 0) {
      resolveAction(action, unit, targets[0], state, rng);
    }
  }
}

/** A hero is "exposed" when no standing ally stands adjacent to shield them. */
function isExposed(hero: UnitInstance, state: CombatState): boolean {
  return !state.units.some(
    (u) =>
      u.team === "hero" &&
      isStandingHero(u) &&
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

  const heroes = state.units.filter((u) => u.team === "hero" && isTargetableByEnemies(u));
  if (heroes.length === 0) return;

  const order = ambushTargetOrder(unit);
  const prime = heroes.filter((h) => isWounded(h) || isExposed(h, state)).sort(order);

  if (prime.length > 0) {
    const target = prime[0];
    if (distance(unit.pos, target.pos) > action.range) {
      const mr = moveToward(unit, target.pos, state);
      if (!mr.unitStillActive) return;
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
  moveToPreferredRange(unit, nearest.pos, AMBUSH_HOLD_RANGE, state); // no post-move attack; unit still active check not needed
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
    const bruteMove = moveToward(unit, target.pos, state);
    if (!bruteMove.unitStillActive) return;
    if (distance(unit.pos, target.pos) <= action.range) {
      const targets = validTargets(action, unit, state);
      if (targets.length > 0) {
        resolveAction(action, unit, targets[0], state, rng);
      }
    }
  } else {
    const curDist = distance(unit.pos, target.pos);
    if (curDist !== action.range) {
      const rangeMove = moveToPreferredRange(unit, target.pos, action.range, state);
      if (!rangeMove.unitStillActive) return;
    }
    if (distance(unit.pos, target.pos) <= action.range) {
      const targets = validTargets(action, unit, state);
      if (targets.length > 0) {
        resolveAction(action, unit, targets[0], state, rng);
      }
    }
  }
}
