import type { UnitInstance, CombatState } from "../state/types.ts";

/**
 * Central validation and payment helper for reactions.
 *
 * A unit may fire at most one reaction per reaction-reset window.
 * The window resets at the start of each unit's turn (handled by CombatScreen).
 *
 * MVP policy: deterministic auto-use — reactions fire automatically when
 * beneficial.  The reaction firing is clearly logged so the player can see it.
 * Triggered passives use the same dispatch path but bypass the availability
 * check (they never consume the reaction slot).
 */

export function isReactionAvailable(unit: UnitInstance): boolean {
  return !unit.reactionUsedThisTurn;
}

export function markReactionUsed(unit: UnitInstance): void {
  unit.reactionUsedThisTurn = true;
  if (unit.turnEconomy) {
    unit.turnEconomy.reactionUsed = true;
  }
}

/**
 * Attempt to spend a resource for a reaction.
 * Returns false if the resource is insufficient (preventing the reaction).
 */
export function trySpendReactionResource(
  unit: UnitInstance,
  state: CombatState,
  resource: "spell_slot" | "ki_point" | "none",
  cost: number = 1,
): boolean {
  if (resource === "spell_slot") {
    if ((unit.spellSlotsRemaining ?? 0) < cost) {
      state.log.push({
        kind: "action",
        text: `[T${state.round}] ${unit.displayName} has no spell slots for the reaction.`,
        round: state.round,
      });
      return false;
    }
    unit.spellSlotsRemaining = (unit.spellSlotsRemaining ?? 0) - cost;
    return true;
  }
  if (resource === "ki_point") {
    if ((unit.kiPointsRemaining ?? 0) < cost) {
      state.log.push({
        kind: "action",
        text: `[T${state.round}] ${unit.displayName} has no ki points for the reaction.`,
        round: state.round,
      });
      return false;
    }
    unit.kiPointsRemaining = (unit.kiPointsRemaining ?? 0) - cost;
    return true;
  }
  return true;
}
