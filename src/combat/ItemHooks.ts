import type { UnitInstance, CombatState } from "../state/types.ts";
import type { ItemDef, ItemHook } from "../data/items.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import { applyCondition } from "./Condition.ts";

const SLOTS = ["weapon", "armor", "trinket"] as const;

export function getItemHooksForUnit(unit: UnitInstance): { itemDef: ItemDef; hook: ItemHook }[] {
  const result: { itemDef: ItemDef; hook: ItemHook }[] = [];
  for (const slot of SLOTS) {
    const itemId = unit.equippedItemIds[slot];
    if (!itemId) continue;
    const itemDef = ITEM_REGISTRY[itemId];
    if (!itemDef?.hook) continue;
    result.push({ itemDef, hook: itemDef.hook });
  }
  return result;
}

function hasItemHookFired(unit: UnitInstance, itemId: string): boolean {
  return unit.usedItemHooks?.includes(itemId) ?? false;
}

function markItemHookFired(unit: UnitInstance, itemId: string): void {
  if (!unit.usedItemHooks) unit.usedItemHooks = [];
  if (!unit.usedItemHooks.includes(itemId)) {
    unit.usedItemHooks.push(itemId);
  }
}

export function resolveOncePerCombatBonus(
  unit: UnitInstance,
  trigger: "firstMeleeAttack" | "firstSpellAttack" | "firstHitTaken" | "combatStart" | "firstTurn" | "firstHealDone",
  state: CombatState,
  context?: { damage?: number; healAmount?: number },
): { damageBonus?: number; damageReduction?: number; healBonus?: number; moveBonus?: number } {
  const result: { damageBonus?: number; damageReduction?: number; healBonus?: number; moveBonus?: number } = {};
  const hooks = getItemHooksForUnit(unit);
  for (const { itemDef, hook } of hooks) {
    if (hook.type !== "oncePerCombatBonus") continue;
    if (hook.trigger !== trigger) continue;
    if (hasItemHookFired(unit, itemDef.id)) continue;

    markItemHookFired(unit, itemDef.id);
    const eff = hook.effect;

    switch (eff.kind) {
      case "bonusDamage":
        result.damageBonus = (result.damageBonus ?? 0) + eff.value;
        state.log.push({
          kind: "action",
          text: `[T${state.round}] ${itemDef.displayName} flares — +${eff.value} damage.`,
          round: state.round,
        });
        break;
      case "damageReduction":
        result.damageReduction = (result.damageReduction ?? 0) + eff.value;
        state.log.push({
          kind: "action",
          text: `[T${state.round}] ${itemDef.displayName} absorbs — reduces damage by ${eff.value}.`,
          round: state.round,
        });
        break;
      case "bonusHealing":
        result.healBonus = (result.healBonus ?? 0) + eff.value;
        state.log.push({
          kind: "action",
          text: `[T${state.round}] ${itemDef.displayName} glows — +${eff.value} healing.`,
          round: state.round,
        });
        break;
      case "bonusMove":
        result.moveBonus = (result.moveBonus ?? 0) + eff.value;
        state.log.push({
          kind: "action",
          text: `[T${state.round}] ${itemDef.displayName} springs — +${eff.value} Move this turn.`,
          round: state.round,
        });
        break;
      case "applyCondition":
        applyCondition(unit, eff.conditionId as import("../state/types.ts").ConditionId, 1);
        state.log.push({
          kind: "action",
          text: `[T${state.round}] ${itemDef.displayName} activates — ${unit.displayName} is ${eff.conditionId}.`,
          round: state.round,
        });
        break;
    }
  }
  return result;
}

export function resolveAttackBonus(
  unit: UnitInstance,
  attackType: "melee" | "spell",
  state: CombatState,
): number {
  let bonus = 0;
  const hooks = getItemHooksForUnit(unit);
  for (const { itemDef, hook } of hooks) {
    if (hook.type !== "attackBonus") continue;
    if (hook.attackType !== attackType) continue;
    bonus += hook.value;
    state.log.push({
      kind: "action",
      text: `[T${state.round}] ${itemDef.displayName} empowers the attack — +${hook.value} damage.`,
      round: state.round,
    });
  }
  return bonus;
}
