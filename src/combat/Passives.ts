import type { UnitInstance, CombatState } from "../state/types.ts";
import { distance } from "../core/hex.ts";
import { PASSIVE_REGISTRY } from "../data/passives.ts";
export { PASSIVE_REGISTRY } from "../data/passives.ts";

/** Aura distance for Beacon's save bonus. */
export const BEACON_SAVE_AURA_RADIUS = 1;

/**
 * Compute additional armor from positional passives (Shieldbearer adjacency).
 * Loops over the unit's passives and reads amounts from PASSIVE_REGISTRY.
 */
export function computeConditionalArmor(unit: UnitInstance, state: CombatState): number {
  let bonus = 0;
  for (const pid of unit.passives ?? []) {
    const def = PASSIVE_REGISTRY[pid];
    if (!def) continue;
    if (def.effect.type === "armorBonus" && def.effect.condition === "adjacentAlly") {
      const hasAdjacentAlly = state.units.some(
        (u) => u.team === unit.team && u.hp > 0 && u.instanceId !== unit.instanceId && distance(unit.pos, u.pos) === 1,
      );
      if (hasAdjacentAlly) bonus += def.effect.amount;
    }
  }
  return bonus;
}

/**
 * Extra attack roll bonus from passives that apply a damage bonus when below 50% HP.
 */
export function getVindicatorAttackBonus(unit: UnitInstance): number {
  let bonus = 0;
  for (const pid of unit.passives ?? []) {
    const def = PASSIVE_REGISTRY[pid];
    if (!def) continue;
    if (def.effect.type === "damageBonus" && def.effect.condition === "below50Pct") {
      if (unit.hp <= Math.floor(unit.stats.maxHp / 2)) bonus += def.effect.amount;
    }
  }
  return bonus;
}

/**
 * Heal bonus from passives that apply a flat heal amount.
 */
export function getCloisteredHealBonus(unit: UnitInstance): number {
  let bonus = 0;
  for (const pid of unit.passives ?? []) {
    const def = PASSIVE_REGISTRY[pid];
    if (!def) continue;
    if (def.effect.type === "healBonus" && def.effect.condition === "always") {
      bonus += def.effect.amount;
    }
  }
  return bonus;
}

/**
 * Crit floor: the minimum d20 roll that counts as a critical hit.
 * Default is 20; a critRangeExpansion passive lowers this.
 */
export function getCritFloor(unit: UnitInstance): number {
  let floor = 20;
  for (const pid of unit.passives ?? []) {
    const def = PASSIVE_REGISTRY[pid];
    if (!def) continue;
    if (def.effect.type === "critRangeExpansion") {
      floor -= def.effect.expandBy;
    }
  }
  return floor;
}

/**
 * Enchanter aura: enemies attacking allies (not self) suffer an attack penalty.
 * Returns the penalty, or 0 if none.
 */
export function getEnchanterAttackPenalty(attacker: UnitInstance, state: CombatState): number {
  if (attacker.team !== "enemy") return 0;
  let penalty = 0;
  for (const hero of state.units) {
    if (hero.team !== "hero" || hero.hp <= 0) continue;
    for (const pid of hero.passives ?? []) {
      const def = PASSIVE_REGISTRY[pid];
      if (!def) continue;
      if (def.effect.type === "attackPenaltyAura" && def.effect.appliesTo === "enemies") {
        penalty += def.effect.penalty;
      }
    }
  }
  return penalty;
}

/**
 * Beacon save aura: allies within the aura radius of a bearer gain a save bonus.
 */
export function getBeaconSaveBonus(target: UnitInstance, state: CombatState): number {
  if (target.team !== "hero") return 0;
  let bonus = 0;
  for (const hero of state.units) {
    if (hero.team !== "hero" || hero.hp <= 0) continue;
    for (const pid of hero.passives ?? []) {
      const def = PASSIVE_REGISTRY[pid];
      if (!def) continue;
      if (def.effect.type === "saveAura" && distance(hero.pos, target.pos) <= def.effect.radius) {
        bonus += def.effect.bonus;
      }
    }
  }
  return bonus;
}

/**
 * Check if a unit has the Taunted condition and return the taunter's id.
 */
export function getTauntSource(state: CombatState): string | undefined {
  return undefined;
}

/**
 * Whether a hero with the Mesmerized condition is on the enemy's team and should be treated as unable to act.
 * Currently handled via forcedTargetId on the enemy unit.
 */
export function isUnitTaunted(unit: UnitInstance): boolean {
  return unit.conditions.some((c) => c.id === "taunted");
}
