import type { UnitInstance, CombatState, HeroLifeState } from "../state/types.ts";

export const DEATH_SAVE_TARGET = 10;
export const DEATH_SAVE_SUCCESSES_TO_STABILIZE = 3;
export const DEATH_SAVE_FAILURES_TO_DIE = 3;

/** Canonical life state for any unit. Enemies always return "standing". */
export function heroLifeState(unit: UnitInstance): HeroLifeState {
  if (unit.team !== "hero") return "standing";
  return unit.heroLifeState ?? "standing";
}

export function isStandingHero(unit: UnitInstance): boolean {
  return heroLifeState(unit) === "standing";
}

export function isDownedHero(unit: UnitInstance): boolean {
  return heroLifeState(unit) === "downed";
}

export function isStableHero(unit: UnitInstance): boolean {
  return heroLifeState(unit) === "stable";
}

export function isDeadForCombat(unit: UnitInstance): boolean {
  return heroLifeState(unit) === "dead";
}

/** Whether the unit can choose an action on its turn. */
export function canAct(unit: UnitInstance): boolean {
  if (unit.team !== "hero") return unit.hp > 0;
  return heroLifeState(unit) === "standing";
}

/** Whether the unit can receive healing (hero-aware). */
export function canBeHealed(unit: UnitInstance): boolean {
  if (unit.team !== "hero") return unit.hp < unit.stats.maxHp;
  const ls = heroLifeState(unit);
  return ls === "standing" || ls === "downed" || ls === "stable";
}

/** Whether an enemy AI can select this unit as an attack target. */
export function isTargetableByEnemies(unit: UnitInstance): boolean {
  if (unit.team !== "hero") return false;
  return heroLifeState(unit) === "standing";
}

/**
 * Transition a hero to Downed. No-ops if already downed/stable/dead.
 * Does NOT call handleUnitDroppedToZero — callers use this for the hero branch.
 */
export function markHeroDowned(unit: UnitInstance, state: CombatState): void {
  if (unit.team !== "hero") return;
  const existing = heroLifeState(unit);
  if (existing === "downed" || existing === "stable" || existing === "dead") return;

  unit.hp = 0;
  unit.heroLifeState = "downed";
  unit.deathSaves = { successes: 0, failures: 0 };
  unit.hasActed = true;
  unit.movePointsRemaining = 0;
  // Clear targeting if this hero was mid-targeting when downed.
  const activeId = state.turnQueue[state.activeIndex];
  if (activeId === unit.instanceId) {
    state.targetingActionId = null;
  }
  state.log.push({
    kind: "defeat",
    text: `[T${state.round}] ${unit.displayName} is Downed.`,
    round: state.round,
  });
}

/** Transition a hero to Dead (failed death saves). Sets deadForRun state. */
export function markHeroDead(unit: UnitInstance, state: CombatState): void {
  if (unit.team !== "hero") return;
  unit.hp = 0;
  unit.heroLifeState = "dead";
  unit.deathSaves = undefined;
  state.log.push({
    kind: "defeat",
    text: `[T${state.round}] ${unit.displayName} dies and is defeated for the rest of the run.`,
    round: state.round,
  });
}

/**
 * If the target is downed or stable and healing raised their HP above 0, transition them
 * back to standing and clear death saves. Safe to call for standing or enemy units.
 */
export function clearDeathSavesOnHealing(unit: UnitInstance, state: CombatState): void {
  if (unit.team !== "hero") return;
  const ls = heroLifeState(unit);
  if ((ls === "downed" || ls === "stable") && unit.hp > 0) {
    const fromLabel = ls === "downed" ? "Downed" : "Stable";
    unit.heroLifeState = "standing";
    unit.deathSaves = undefined;
    state.log.push({
      kind: "action",
      text: `[T${state.round}] ${unit.displayName} is restored from ${fromLabel} and can act again.`,
      round: state.round,
    });
  }
}

/**
 * Central drop-to-zero handler. Heroes become Downed; enemies are defeated.
 * Must be called after setting unit.hp = 0.
 */
export function handleUnitDroppedToZero(unit: UnitInstance, state: CombatState): void {
  if (unit.hp > 0) return;

  if (unit.team === "hero") {
    markHeroDowned(unit, state);
    return;
  }

  state.log.push({
    kind: "defeat",
    text: `[T${state.round}] ${unit.displayName} is defeated.`,
    round: state.round,
  });
}

/**
 * Roll a death save for a Downed hero at the start of their turn.
 * Returns the outcome so the caller can decide turn-flow behavior.
 */
export function resolveDeathSaveTurn(
  unit: UnitInstance,
  state: CombatState,
  rng: () => number,
): "still_downed" | "revived" | "stable" | "dead" {
  if (unit.team !== "hero" || heroLifeState(unit) !== "downed") return "still_downed";

  const d20 = Math.floor(rng() * 20) + 1;

  if (d20 === 20) {
    unit.hp = 1;
    unit.heroLifeState = "standing";
    unit.deathSaves = undefined;
    state.log.push({
      kind: "action",
      text: `[T${state.round}] ${unit.displayName} rolls a natural 20 death save and surges back to 1 HP!`,
      round: state.round,
    });
    return "revived";
  }

  if (!unit.deathSaves) unit.deathSaves = { successes: 0, failures: 0 };

  if (d20 === 1) {
    unit.deathSaves.failures += 2;
    state.log.push({
      kind: "action",
      text: `[T${state.round}] ${unit.displayName} rolls a natural 1 death save — 2 failures! (${unit.deathSaves.successes}S/${unit.deathSaves.failures}F)`,
      round: state.round,
    });
  } else if (d20 >= DEATH_SAVE_TARGET) {
    unit.deathSaves.successes += 1;
    state.log.push({
      kind: "action",
      text: `[T${state.round}] ${unit.displayName} rolls a death save: d20=${d20} → success (${unit.deathSaves.successes}S/${unit.deathSaves.failures}F).`,
      round: state.round,
    });
  } else {
    unit.deathSaves.failures += 1;
    state.log.push({
      kind: "action",
      text: `[T${state.round}] ${unit.displayName} rolls a death save: d20=${d20} → failure (${unit.deathSaves.successes}S/${unit.deathSaves.failures}F).`,
      round: state.round,
    });
  }

  if (unit.deathSaves.failures >= DEATH_SAVE_FAILURES_TO_DIE) {
    markHeroDead(unit, state);
    return "dead";
  }

  if (unit.deathSaves.successes >= DEATH_SAVE_SUCCESSES_TO_STABILIZE) {
    unit.hp = 1;
    unit.heroLifeState = "stable";
    unit.deathSaves = undefined;
    unit.hasActed = true;
    unit.movePointsRemaining = 0;
    state.log.push({
      kind: "action",
      text: `[T${state.round}] ${unit.displayName} stabilizes at 1 HP but cannot act until next combat or rest.`,
      round: state.round,
    });
    return "stable";
  }

  return "still_downed";
}
