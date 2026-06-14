import { ACTION_REGISTRY } from "../data/actions.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import { ARCHETYPE_REGISTRY } from "../data/archetypes.ts";
import type { UnitInstance, CombatState } from "../state/types.ts";

/**
 * Returns the ordered, deduplicated list of action IDs available to a unit in combat.
 *
 * For heroes, the order is: starter class actions → prepared actions → archetype-granted →
 * item-granted. All starter class actions are included regardless of resource type (cantrip,
 * spell-slot, martial, or charged).
 */
export function getHeroActionIds(unit: UnitInstance): string[] {
  if (unit.team !== "hero") {
    const enemyDef = ENEMY_REGISTRY[unit.defId];
    return enemyDef ? [...enemyDef.actionIds] : [];
  }

  const classDef = CLASS_REGISTRY[unit.defId];
  const starterActions = classDef ? [...classDef.actionIds] : [];
  const prepared = unit.preparedActionIds ?? [];

  const grantedActions: string[] = [];
  if (unit.archetypeId) {
    const archDef = ARCHETYPE_REGISTRY[unit.archetypeId];
    if (archDef?.grantedActionId && !grantedActions.includes(archDef.grantedActionId)) {
      grantedActions.push(archDef.grantedActionId);
    }
  }
  for (const slot of ["weapon", "armor", "trinket"] as const) {
    const itemId = unit.equippedItemIds[slot];
    if (!itemId) continue;
    const itemDef = ITEM_REGISTRY[itemId];
    if (itemDef?.grantedActionIds) {
      for (const aid of itemDef.grantedActionIds) {
        if (!grantedActions.includes(aid)) {
          grantedActions.push(aid);
        }
      }
    }
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const aid of [...starterActions, ...prepared, ...grantedActions]) {
    if (!seen.has(aid)) {
      seen.add(aid);
      result.push(aid);
    }
  }
  return result;
}

/**
 * Returns remaining charges for a charged action this encounter, including any
 * bonus charges from actionChargeBonus passives.
 * `perEncounterUses` stores the number of times an action has been used (not remaining).
 */
export function chargesRemaining(
  actionId: string,
  perEncounterUses: Record<string, number>,
  perEncounterChargeBonus?: Record<string, number>,
): number | null {
  const actionDef = ACTION_REGISTRY[actionId];
  if (!actionDef || actionDef.charges === undefined) return null;
  const used = perEncounterUses[actionId] ?? 0;
  const bonus = (perEncounterChargeBonus ?? {})[actionId] ?? 0;
  return actionDef.charges + bonus - used;
}

/**
 * Returns true when a charged action has no uses left this encounter.
 * Returns false for non-charged actions.
 */
export function isChargeExhausted(actionId: string, cs: CombatState): boolean {
  const remaining = chargesRemaining(
    actionId,
    cs.perEncounterUses as Record<string, number>,
    cs.perEncounterChargeBonus,
  );
  return remaining !== null && remaining <= 0;
}
