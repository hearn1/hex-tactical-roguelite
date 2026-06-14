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
 * Save bonus from beacon-style auras (saveAura) and Aura of Protection (auraOfProtection).
 * Returns total bonus for the target from all living hero passive sources within range.
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
      if (def.effect.type === "auraOfProtection" && distance(hero.pos, target.pos) <= def.effect.radius) {
        bonus += hero.stats[def.effect.stat];
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

/**
 * Sum actionChargeBonus amounts across all hero passives.
 * Returns a map of actionId → total bonus charges to add this encounter.
 */
export function computeActionChargeBonuses(heroes: UnitInstance[]): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const unit of heroes) {
    if (unit.team !== "hero") continue;
    for (const pid of unit.passives ?? []) {
      const def = PASSIVE_REGISTRY[pid];
      if (!def || def.effect.type !== "actionChargeBonus") continue;
      bonuses[def.effect.actionId] = (bonuses[def.effect.actionId] ?? 0) + def.effect.amount;
    }
  }
  return bonuses;
}

/**
 * Extend the beacon save aura check to include auraOfProtection passives.
 * auraOfProtection adds the bearer's stat modifier to ally saves within radius.
 */
export function getPassiveSaveBonus(target: UnitInstance, state: CombatState): number {
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
      if (def.effect.type === "auraOfProtection" && distance(hero.pos, target.pos) <= def.effect.radius) {
        bonus += hero.stats[def.effect.stat];
      }
    }
  }
  return bonus;
}

/**
 * Bonus movement hexes from fastMovement passives.
 */
export function getFastMovementBonus(unit: UnitInstance): number {
  let bonus = 0;
  for (const pid of unit.passives ?? []) {
    const def = PASSIVE_REGISTRY[pid];
    if (def?.effect.type === "fastMovement") bonus += def.effect.bonus;
  }
  return bonus;
}

/**
 * Armor bonus from draconicResilience passive (+1 AC).
 */
export function getDraconicResilienceBonus(unit: UnitInstance): number {
  for (const pid of unit.passives ?? []) {
    const def = PASSIVE_REGISTRY[pid];
    if (def?.effect.type === "draconicResilience") return 1;
  }
  return 0;
}

/**
 * Spell damage stat modifier bonus from empoweredEvocation or elementalAffinity passives.
 */
export function getSpellDamageStatBonus(attacker: UnitInstance): number {
  let bonus = 0;
  for (const pid of attacker.passives ?? []) {
    const def = PASSIVE_REGISTRY[pid];
    if (!def) continue;
    if (def.effect.type === "empoweredEvocation") bonus += attacker.stats[def.effect.stat];
    if (def.effect.type === "elementalAffinity") bonus += attacker.stats[def.effect.stat];
  }
  return bonus;
}

/**
 * Extra damage die roll when a brutal critical occurs (Barbarian Brutal Critical).
 * Returns the extra damage amount (0 if not applicable).
 */
export function getBrutalCriticalExtraDamage(attacker: UnitInstance, rng: () => number): number {
  const hasBrutalCrit = (attacker.passives ?? []).some((pid) => {
    const def = PASSIVE_REGISTRY[pid];
    return def?.effect.type === "brutalCritical";
  });
  if (!hasBrutalCrit) return 0;
  return Math.floor(rng() * 6) + 1;
}

/**
 * Once-per-turn Colossus Slayer bonus: +1d8 when target is below max HP.
 * Uses traitState to enforce once-per-turn.
 */
export function getColossusSlayerBonus(
  attacker: UnitInstance,
  target: UnitInstance,
  state: CombatState,
  rng: () => number,
): number {
  const hasColossus = (attacker.passives ?? []).some((pid) => {
    const def = PASSIVE_REGISTRY[pid];
    return def?.effect.type === "colossusSlayer";
  });
  if (!hasColossus) return 0;
  if (target.hp >= target.stats.maxHp) return 0;
  const key = `${attacker.instanceId}:colossusSlayer:${state.round}`;
  const triggered = (state.traitState?.triggered ?? {});
  if (triggered[key]) return 0;
  if (!state.traitState) state.traitState = {};
  if (!state.traitState.triggered) state.traitState.triggered = {};
  state.traitState.triggered[key] = true;
  return Math.floor(rng() * 8) + 1;
}

/**
 * First-attack bonus dice (Assassinate): bonus damage on first attack against a full-HP target.
 * Tracks via perEncounterUses with a unit-keyed marker.
 */
export function getFirstAttackBonusDice(
  attacker: UnitInstance,
  target: UnitInstance,
  state: CombatState,
  rng: () => number,
): number {
  let diceFormula: string | null = null;
  for (const pid of attacker.passives ?? []) {
    const def = PASSIVE_REGISTRY[pid];
    if (def?.effect.type === "firstAttackBonusDice" && def.effect.condition === "targetAtFullHp") {
      diceFormula = def.effect.dice;
      break;
    }
  }
  if (!diceFormula) return 0;
  if (target.hp < target.stats.maxHp) return 0;
  const fireKey = `${attacker.instanceId}:firstAttack`;
  const uses = state.perEncounterUses as Record<string, number>;
  if (uses[fireKey]) return 0;
  uses[fireKey] = 1;
  const parts = diceFormula.match(/^(\d+)d(\d+)$/);
  if (!parts) return 0;
  const count = parseInt(parts[1], 10);
  const sides = parseInt(parts[2], 10);
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.floor(rng() * sides) + 1;
  return total;
}

/**
 * Returns true if the target has all-damage resistance (Bear Totem) while raging.
 */
export function hasAllResistanceWhileRaged(unit: UnitInstance): boolean {
  const isRaged = unit.conditions.some((c) => c.id === "raged");
  if (!isRaged) return false;
  return (unit.passives ?? []).some((pid) => {
    const def = PASSIVE_REGISTRY[pid];
    return def?.effect.type === "resistance" && def.effect.damageTypes.includes("all");
  });
}

/**
 * HP gain on kill from onKillTempHp passive (Dark One's Blessing).
 */
export function getOnKillHpGain(attacker: UnitInstance): number {
  for (const pid of attacker.passives ?? []) {
    const def = PASSIVE_REGISTRY[pid];
    if (def?.effect.type === "onKillTempHp") {
      return Math.max(1, attacker.stats[def.effect.stat]);
    }
  }
  return 0;
}

/**
 * Initiative bonus from dreadAmbusher passive.
 */
export function getDreadAmbusherInitiativeBonus(unit: UnitInstance): number {
  let bonus = 0;
  for (const pid of unit.passives ?? []) {
    const def = PASSIVE_REGISTRY[pid];
    if (def?.effect.type === "dreadAmbusher") bonus += def.effect.initiativeBonus;
  }
  return bonus;
}
