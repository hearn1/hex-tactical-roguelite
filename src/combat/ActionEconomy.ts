import type { ActionDef } from "../data/actions.ts";
import type { UnitInstance, CombatState, TurnEconomyState } from "../state/types.ts";
import { heroLifeState } from "./DeathSaves.ts";

export interface ActionUseCheck {
  canUse: boolean;
  reason: string | null;
}

/** Returns the current turn economy for a unit, creating it if absent (save compat). */
export function getTurnEconomy(unit: UnitInstance): TurnEconomyState {
  if (!unit.turnEconomy) {
    unit.turnEconomy = {
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      extraActionsRemaining: 0,
    };
  }
  return unit.turnEconomy;
}

/** Returns true when the unit has an extra action available (via Action Surge etc.). */
function hasExtraAction(unit: UnitInstance): boolean {
  return (getTurnEconomy(unit).extraActionsRemaining ?? 0) > 0;
}

/**
 * Checks whether a unit can currently use the given action.
 * Pure read — no state mutations.
 */
export function canUseAction(unit: UnitInstance, action: ActionDef, cs: CombatState): ActionUseCheck {
  if (unit.team === "hero") {
    const ls = heroLifeState(unit);
    if (ls === "downed" || ls === "stable" || ls === "dead") {
      return { canUse: false, reason: `${unit.displayName} cannot act while ${ls}` };
    }
  }

  const eco = getTurnEconomy(unit);
  const timing = action.timing ?? "action";

  if (timing === "action") {
    if (eco.actionUsed && !hasExtraAction(unit)) {
      return { canUse: false, reason: "No action remaining this turn" };
    }
  } else if (timing === "bonus_action") {
    if (eco.bonusActionUsed) {
      return { canUse: false, reason: "No bonus action remaining this turn" };
    }
  } else if (timing === "reaction") {
    if (eco.reactionUsed) {
      return { canUse: false, reason: "No reaction remaining this turn" };
    }
  }

  if (action.charges !== undefined) {
    const used = (cs.perEncounterUses as Record<string, number>)[action.id] ?? 0;
    if (used >= action.charges) {
      return { canUse: false, reason: "No charges remaining this encounter" };
    }
  }

  if (action.resourceType === "spell_slot") {
    const cost = action.slotCost ?? 1;
    const remaining = unit.spellSlotsRemaining ?? 0;
    if (remaining < cost) {
      return { canUse: false, reason: "No spell slots remaining — Long Rest to recover" };
    }
  }

  if (action.kiPointCost !== undefined && action.kiPointCost > 0) {
    const remaining = unit.kiPointsRemaining ?? 0;
    if (remaining < action.kiPointCost) {
      return { canUse: false, reason: `Not enough ki points (need ${action.kiPointCost})` };
    }
  }

  if (action.sorceryPointCost !== undefined && action.sorceryPointCost > 0) {
    const remaining = unit.sorceryPointsRemaining ?? 0;
    if (remaining < action.sorceryPointCost) {
      return { canUse: false, reason: `Not enough sorcery points (need ${action.sorceryPointCost})` };
    }
  }

  return { canUse: true, reason: null };
}

/**
 * Pays the timing and resource costs for an action. Call only after canUseAction confirms
 * the action is usable. Also keeps hasActed in sync with actionUsed for backward compat.
 */
export function payActionCosts(unit: UnitInstance, action: ActionDef, cs: CombatState): void {
  const eco = getTurnEconomy(unit);
  const timing = action.timing ?? "action";

  if (timing === "action") {
    if (eco.extraActionsRemaining > 0) {
      eco.extraActionsRemaining--;
    } else {
      eco.actionUsed = true;
      unit.hasActed = true;
    }
  } else if (timing === "bonus_action") {
    eco.bonusActionUsed = true;
  } else if (timing === "reaction") {
    eco.reactionUsed = true;
    unit.reactionUsedThisTurn = true;
  } else if (timing === "free") {
    // free actions consume no economy slot
  }

  if (action.charges !== undefined) {
    const uses = cs.perEncounterUses as Record<string, number>;
    uses[action.id] = (uses[action.id] ?? 0) + 1;
  }

  if (action.resourceType === "spell_slot") {
    const cost = action.slotCost ?? 1;
    unit.spellSlotsRemaining = (unit.spellSlotsRemaining ?? 0) - cost;
  }

  if (action.kiPointCost !== undefined && action.kiPointCost > 0) {
    unit.kiPointsRemaining = (unit.kiPointsRemaining ?? 0) - action.kiPointCost;
  }

  if (action.sorceryPointCost !== undefined && action.sorceryPointCost > 0) {
    unit.sorceryPointsRemaining = (unit.sorceryPointsRemaining ?? 0) - action.sorceryPointCost;
  }
}
