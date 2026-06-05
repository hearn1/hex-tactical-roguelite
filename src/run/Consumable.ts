import { roll } from "../core/dice.ts";
import { distance } from "../core/hex.ts";
import { POTION_REGISTRY, type PotionDef } from "../data/potions.ts";
import { applyCondition, removeCondition } from "../combat/Condition.ts";
import type { CombatState, ConditionId, UnitInstance } from "../state/types.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";
import { computePartyMemberStats } from "./Equipment.ts";

export interface ConsumePotionContext {
  run: RunState;
  rng: () => number;
  combat?: CombatState;
  actorId?: string;
}

export interface ConsumePotionResult {
  ok: boolean;
  potionId: string;
  potionName: string;
  effectKind?: PotionDef["effect"]["kind"];
  targetId?: string;
  amount?: number;
  removedConditionIds?: ConditionId[];
  log: string;
  reason?: string;
  remainingPotions: string[];
}

type PotionTarget =
  | { kind: "combat"; unit: UnitInstance }
  | { kind: "map"; member: PartyMember };

export function isPotionUsableOnMap(potion: PotionDef): boolean {
  return potion.effect.kind === "heal" || potion.effect.kind === "cleanse";
}

export function consumePotion(
  potionId: string,
  targetId: string,
  ctx: ConsumePotionContext,
): ConsumePotionResult {
  const potion = POTION_REGISTRY[potionId];
  const fallbackName = potion?.displayName ?? potionId;

  if (!potion) {
    return fail(potionId, fallbackName, `Unknown potion: ${potionId}`, ctx.run.inventory.potions);
  }

  const potionIndex = ctx.run.inventory.potions.indexOf(potionId);
  if (potionIndex < 0) {
    return fail(potionId, potion.displayName, `${potion.displayName} is not in the potion bag.`, ctx.run.inventory.potions);
  }

  const target = resolveTarget(targetId, ctx);
  if (!target) {
    return fail(potionId, potion.displayName, "No valid target for that potion.", ctx.run.inventory.potions);
  }

  const actor = ctx.combat && ctx.actorId ? ctx.combat.units.find((u) => u.instanceId === ctx.actorId) : null;
  const effect = potion.effect;
  let result: Omit<ConsumePotionResult, "remainingPotions">;
  let defeatedTargetName: string | null = null;

  if (effect.kind === "heal") {
    const heal = applyHeal(target, effect.amount);
    result = {
      ok: true,
      potionId,
      potionName: potion.displayName,
      effectKind: effect.kind,
      targetId,
      amount: heal,
      log: `${potion.displayName} restores ${heal} HP to ${targetName(target)}.`,
    };
  } else if (effect.kind === "cleanse") {
    const heal = effect.healAmount ? applyHeal(target, effect.healAmount) : 0;
    const removed: ConditionId[] = [];
    if (target.kind === "combat") {
      for (const id of effect.conditionIds) {
        if (removeCondition(target.unit, id)) removed.push(id);
      }
    }
    const cleanseText = removed.length > 0 ? ` and removes ${removed.join(", ")}` : "";
    result = {
      ok: true,
      potionId,
      potionName: potion.displayName,
      effectKind: effect.kind,
      targetId,
      amount: heal,
      removedConditionIds: removed,
      log: `${potion.displayName} restores ${heal} HP to ${targetName(target)}${cleanseText}.`,
    };
  } else if (effect.kind === "buff") {
    if (target.kind !== "combat") {
      return fail(potionId, potion.displayName, `${potion.displayName} can only be used in combat.`, ctx.run.inventory.potions);
    }
    if (actor && !canTargetAllyOrSelf(actor, target.unit)) {
      return fail(potionId, potion.displayName, `${potion.displayName} must target an ally.`, ctx.run.inventory.potions);
    }
    applyCondition(target.unit, effect.conditionId, effect.duration);
    result = {
      ok: true,
      potionId,
      potionName: potion.displayName,
      effectKind: effect.kind,
      targetId,
      removedConditionIds: [],
      log: `${potion.displayName} grants ${effect.conditionId} to ${target.unit.displayName}.`,
    };
  } else {
    if (!ctx.combat || target.kind !== "combat") {
      return fail(potionId, potion.displayName, `${potion.displayName} can only be used in combat.`, ctx.run.inventory.potions);
    }
    if (actor && !canTargetEnemyInRange(actor, target.unit, effect.range)) {
      return fail(potionId, potion.displayName, `${potion.displayName} target is out of range.`, ctx.run.inventory.potions);
    }
    const rolled = roll(effect.formula, ctx.rng).total;
    const damage = applyPotionDamage(target.unit, rolled, ctx.combat);
    if (target.unit.hp <= 0) defeatedTargetName = target.unit.displayName;
    result = {
      ok: true,
      potionId,
      potionName: potion.displayName,
      effectKind: effect.kind,
      targetId,
      amount: damage,
      log: `${potion.displayName} hits ${target.unit.displayName} for ${damage} damage.`,
    };
  }

  ctx.run.inventory.potions.splice(potionIndex, 1);
  if (ctx.combat) {
    ctx.combat.log.push({ kind: "action", text: `[T${ctx.combat.round}] ${result.log}`, round: ctx.combat.round });
    if (defeatedTargetName) {
      ctx.combat.log.push({
        kind: "defeat",
        text: `[T${ctx.combat.round}] ${defeatedTargetName} is defeated.`,
        round: ctx.combat.round,
      });
    }
  }
  return { ...result, remainingPotions: [...ctx.run.inventory.potions] };
}

export function validPotionTargets(
  potionId: string,
  actor: UnitInstance,
  combat: CombatState,
): UnitInstance[] {
  const potion = POTION_REGISTRY[potionId];
  if (!potion) return [];
  const living = combat.units.filter((u) => u.hp > 0);
  if (potion.effect.kind === "damage") {
    const range = potion.effect.range;
    return living.filter((u) => canTargetEnemyInRange(actor, u, range));
  }
  if (potion.effect.kind === "heal" || potion.effect.kind === "cleanse" || potion.effect.kind === "buff") {
    return living.filter((u) => canTargetAllyOrSelf(actor, u));
  }
  return [];
}

function resolveTarget(targetId: string, ctx: ConsumePotionContext): PotionTarget | null {
  if (ctx.combat) {
    const unit = ctx.combat.units.find((u) => u.instanceId === targetId && u.hp > 0);
    return unit ? { kind: "combat", unit } : null;
  }
  const member = ctx.run.party.find((p) => p.instanceId === targetId && p.hp > 0);
  return member ? { kind: "map", member } : null;
}

function applyHeal(target: PotionTarget, amount: number): number {
  if (target.kind === "combat") {
    const before = target.unit.hp;
    target.unit.hp = Math.min(target.unit.stats.maxHp, target.unit.hp + amount);
    return target.unit.hp - before;
  }

  const before = target.member.hp;
  const maxHp = computePartyMemberStats(target.member).maxHp;
  target.member.hp = Math.min(maxHp, target.member.hp + amount);
  return target.member.hp - before;
}

function applyPotionDamage(target: UnitInstance, rolledDamage: number, combat: CombatState): number {
  let damage = rolledDamage;
  const guardedIdx = target.conditions.findIndex((c) => c.id === "guarded");
  if (guardedIdx >= 0) {
    const before = damage;
    damage = Math.max(1, Math.floor(damage / 2));
    target.conditions.splice(guardedIdx, 1);
    combat.log.push({
      kind: "action",
      text: `[T${combat.round}] Guarded consumed - ${before} damage reduced to ${damage}.`,
      round: combat.round,
    });
  }

  const beforeHp = target.hp;
  target.hp = Math.max(0, target.hp - damage);
  const dealt = beforeHp - target.hp;
  return dealt;
}

function targetName(target: PotionTarget): string {
  return target.kind === "combat" ? target.unit.displayName : target.member.displayName;
}

function canTargetAllyOrSelf(actor: UnitInstance, target: UnitInstance): boolean {
  return target.team === actor.team && target.hp > 0;
}

function canTargetEnemyInRange(actor: UnitInstance, target: UnitInstance, range: number): boolean {
  return target.team !== actor.team && target.hp > 0 && distance(actor.pos, target.pos) <= range;
}

function fail(
  potionId: string,
  potionName: string,
  reason: string,
  remainingPotions: string[],
): ConsumePotionResult {
  return {
    ok: false,
    potionId,
    potionName,
    reason,
    log: reason,
    remainingPotions: [...remainingPotions],
  };
}
