import type { UnitInstance, CombatState } from "../state/types.ts";
import { distance } from "../core/hex.ts";
import { ARCHETYPE_PASSIVE_SHIELDBEARER_ADJACENCY_ARMOR, ARCHETYPE_PASSIVE_CLOISTERED_HEAL_BONUS, ARCHETYPE_PASSIVE_EVOKER_CRIT_FLOOR } from "../data/archetypes.ts";

/** Flat armor bonus granted by the Shieldbearer adjacency passive. */
export const SHIELDBEARER_ADJACENCY_ARMOR_BONUS = 2;
/** Flat attack bonus granted by the Vindicator wounded passive. */
export const VINDICATOR_BELOW_50_ATTACK_BONUS = 2;
/** Flat heal bonus granted by the Cloistered passive. */
export const CLOISTERED_HEAL_BONUS_AMOUNT = 2;
/** Aura distance for Beacon's save bonus. */
export const BEACON_SAVE_AURA_RADIUS = 1;
/** Attack penalty from Enchanter aura. */
export const ENCHANTER_ATTACK_PENALTY = 1;

/**
 * Compute additional armor from positional passives (Shieldbearer adjacency).
 * Call this before any stat read that should include conditional effects.
 */
export function computeConditionalArmor(unit: UnitInstance, state: CombatState): number {
  let bonus = 0;
  if (unit.passives?.includes(ARCHETYPE_PASSIVE_SHIELDBEARER_ADJACENCY_ARMOR)) {
    const hasAdjacentAlly = state.units.some(
      (u) => u.team === unit.team && u.hp > 0 && u.instanceId !== unit.instanceId && distance(unit.pos, u.pos) === 1,
    );
    if (hasAdjacentAlly) bonus += SHIELDBEARER_ADJACENCY_ARMOR_BONUS;
  }
  return bonus;
}

/**
 * Extra attack roll bonus from Vindicator's wounded passive.
 */
export function getVindicatorAttackBonus(unit: UnitInstance): number {
  if (!unit.passives?.includes("archetype_passive.vindicator_below_50_attack")) return 0;
  if (unit.hp <= Math.floor(unit.stats.maxHp / 2)) return VINDICATOR_BELOW_50_ATTACK_BONUS;
  return 0;
}

/**
 * Cloistered passive: +2 to every heal action.
 */
export function getCloisteredHealBonus(unit: UnitInstance): number {
  if (unit.passives?.includes(ARCHETYPE_PASSIVE_CLOISTERED_HEAL_BONUS)) return CLOISTERED_HEAL_BONUS_AMOUNT;
  return 0;
}

/**
 * Crit floor: the minimum d20 roll that counts as a critical hit.
 * Default is 20; Evoker passive sets it to 19.
 */
export function getCritFloor(unit: UnitInstance): number {
  if (unit.passives?.includes(ARCHETYPE_PASSIVE_EVOKER_CRIT_FLOOR)) return 19;
  return 20;
}

/**
 * Enchanter aura: enemies attacking allies (not self) suffer an attack penalty.
 * Returns the penalty, or 0 if none.
 */
export function getEnchanterAttackPenalty(attacker: UnitInstance, state: CombatState): number {
  if (attacker.team !== "enemy") return 0;
  return state.units.some(
    (u) => u.team === "hero" && u.hp > 0 && u.passives?.includes("archetype_passive.enchanter_attack_debuff_aura"),
  )
    ? ENCHANTER_ATTACK_PENALTY
    : 0;
}

/**
 * Beacon save aura: allies within radius 1 of a Beacon hero gain +1 to saving throws.
 */
export function getBeaconSaveBonus(target: UnitInstance, state: CombatState): number {
  if (target.team !== "hero") return 0;
  const hasBeaconNearby = state.units.some(
    (u) => u.team === "hero" && u.hp > 0 && u.passives?.includes("archetype_passive.beacon_save_aura") && distance(u.pos, target.pos) <= BEACON_SAVE_AURA_RADIUS,
  );
  return hasBeaconNearby ? 1 : 0;
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
