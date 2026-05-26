import type { ActionDef } from "../data/actions.ts";
import type { UnitInstance, CombatState, CombatLogEntry } from "../state/types.ts";
import { distance } from "../core/hex.ts";
import { roll } from "../core/dice.ts";

export function validTargets(
  action: ActionDef,
  attacker: UnitInstance,
  state: CombatState,
): UnitInstance[] {
  const living = state.units.filter((u) => u.hp > 0);
  switch (action.targetType) {
    case "self":
      return living.filter((u) => u.instanceId === attacker.instanceId);
    case "ally":
      return living.filter(
        (u) => u.team === attacker.team && u.instanceId !== attacker.instanceId && distance(attacker.pos, u.pos) <= action.range,
      );
    case "enemy":
      return living.filter(
        (u) => u.team !== attacker.team && distance(attacker.pos, u.pos) <= action.range,
      );
  }
}

function rewriteFormula(formula: string, attacker: UnitInstance): string {
  return formula
    .replace("+ might", `+ ${attacker.stats.might}`)
    .replace("+ agility", `+ ${attacker.stats.agility}`)
    .replace("+ spirit", `+ ${attacker.stats.spirit}`);
}

export function resolveAction(
  action: ActionDef,
  attacker: UnitInstance,
  target: UnitInstance,
  state: CombatState,
  rng: () => number,
): void {
  const round = state.round;

  if (action.effect.type === "heal") {
    const formula = rewriteFormula(action.effect.formula, attacker);
    const result = roll(formula, rng);
    const healed = result.total;
    const before = target.hp;
    target.hp = Math.min(target.hp + healed, target.stats.maxHp);
    const actual = target.hp - before;
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — heal ${actual}. ${target.displayName}: ${target.hp}/${target.stats.maxHp} HP.`,
      round,
    });
    attacker.hasActed = true;
    return;
  }

  const attackStat = action.accuracyStat ?? "might";
  const stat = attacker.stats[attackStat];
  const proficiency = 2 + Math.floor((attacker.level - 1) / 3);
  const d20 = Math.floor(rng() * 20) + 1;
  const attackTotal = d20 + stat + proficiency;
  const isCrit = d20 === 20;
  const isAutoMiss = d20 === 1;
  const hit = !isAutoMiss && (isCrit || attackTotal >= target.stats.armor);

  if (!hit) {
    if (isAutoMiss) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=1 → auto-miss.`,
        round,
      });
    } else {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} +${stat}+${proficiency}=${attackTotal} vs ${target.stats.armor} → miss.`,
        round,
      });
    }
    attacker.hasActed = true;
    return;
  }

  const formula = rewriteFormula(action.effect.formula, attacker);
  const result = roll(formula, rng);
  let damage = result.total;
  if (isCrit) damage *= 2;

  const beforeHp = target.hp;
  target.hp = Math.max(0, target.hp - damage);
  const dealt = beforeHp - target.hp;

  if (isCrit) {
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=20 crit! ${dealt} dmg (${damage} before reduction). ${target.displayName}: ${target.hp}/${target.stats.maxHp} HP.`,
      round,
    });
  } else {
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} +${stat}+${proficiency}=${attackTotal} vs ${target.stats.armor} → hit, ${dealt} dmg. ${target.displayName}: ${target.hp}/${target.stats.maxHp} HP.`,
      round,
    });
  }

  if (target.hp <= 0) {
    state.log.push({
      kind: "defeat",
      text: `[T${round}] ${target.displayName} is defeated.`,
      round,
    });
  }

  attacker.hasActed = true;
}

export function checkVictoryDefeat(state: CombatState): void {
  const heroesAlive = state.units.filter((u) => u.team === "hero" && u.hp > 0);
  const enemiesAlive = state.units.filter((u) => u.team === "enemy" && u.hp > 0);

  if (enemiesAlive.length === 0) {
    state.status = "victory";
    state.log.push({ kind: "victory", text: `[T${state.round}] Victory.`, round: state.round });
  } else if (heroesAlive.length === 0) {
    state.status = "defeat";
    state.log.push({ kind: "defeat_squad", text: `[T${state.round}] Defeat.`, round: state.round });
  }
}

export function removeDefeatedFromQueue(state: CombatState): void {
  const deadIds = new Set(
    state.units.filter((u) => u.hp <= 0).map((u) => u.instanceId),
  );
  if (deadIds.size === 0) return;
  const before = state.activeIndex;
  const activeId = state.turnQueue[state.activeIndex];
  const activeDead = deadIds.has(activeId);
  state.turnQueue = state.turnQueue.filter((id) => !deadIds.has(id));
  if (activeDead) {
    state.activeIndex = Math.min(before, state.turnQueue.length - 1);
  } else {
    state.activeIndex = state.turnQueue.indexOf(activeId);
  }
}
