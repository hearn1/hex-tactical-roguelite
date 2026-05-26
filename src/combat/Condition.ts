import type { ConditionId, UnitInstance } from "../state/types.ts";

export function applyCondition(unit: UnitInstance, conditionId: ConditionId, duration: number): void {
  const existing = unit.conditions.findIndex((c) => c.id === conditionId);
  if (existing >= 0) {
    unit.conditions.splice(existing, 1);
  }
  unit.conditions.push({ id: conditionId, remainingTurns: duration });
}

export function processTurnStart(unit: UnitInstance): ConditionId[] {
  const expired: ConditionId[] = [];

  const slowed = unit.conditions.find((c) => c.id === "slowed");
  if (slowed) {
    unit.movePointsRemaining = Math.max(0, unit.movePointsRemaining - 1);
  }

  for (let i = unit.conditions.length - 1; i >= 0; i--) {
    const cond = unit.conditions[i];
    const condId = cond.id;
    cond.remainingTurns--;
    if (cond.remainingTurns <= 0) {
      unit.conditions.splice(i, 1);
      expired.push(condId);
    }
  }

  return expired;
}

export function hasCondition(unit: UnitInstance, id: ConditionId): boolean {
  return unit.conditions.some((c) => c.id === id);
}
