import type { CombatState, UnitInstance, Hex, TerrainType } from "../state/types.ts";
import type { ActionDef } from "../data/actions.ts";
import { hexKey, distance } from "../core/hex.ts";
import { handleUnitDroppedToZero } from "./DeathSaves.ts";

export const DIFFICULT_TERRAIN_COST = 2;
export const NORMAL_TERRAIN_COST = 1;
export const COVER_ARMOR_BONUS = 2;
export const HAZARD_DAMAGE = 2;

function toKey(hexOrKey: Hex | string): string {
  return typeof hexOrKey === "string" ? hexOrKey : hexKey(hexOrKey);
}

export function getTerrainType(
  state: Pick<CombatState, "terrain">,
  hexOrKey: Hex | string,
): TerrainType {
  if (!state.terrain) return "normal";
  return state.terrain[toKey(hexOrKey)] ?? "normal";
}

export function movementCostForHex(
  state: Pick<CombatState, "terrain">,
  hexOrKey: Hex | string,
): number {
  return getTerrainType(state, hexOrKey) === "difficult" ? DIFFICULT_TERRAIN_COST : NORMAL_TERRAIN_COST;
}

/**
 * Returns the cover armor bonus for a ranged attack against a target on a cover hex.
 * Returns 0 when cover does not apply (melee attacks, heals, AoE, non-hostile actions).
 */
export function coverArmorBonusForTarget(
  state: Pick<CombatState, "terrain">,
  action: ActionDef,
  attacker: UnitInstance,
  target: UnitInstance,
): number {
  if (getTerrainType(state, target.pos) !== "cover") return 0;
  if (action.targetType !== "enemy") return 0;
  if (action.effect.type !== "damage") return 0;
  // AoE and multi-target modes do not get the single-target cover benefit.
  if (action.effect.targetMode !== undefined && action.effect.targetMode !== "single") return 0;
  // Melee attacks (range 1, attacker adjacent) do not benefit from cover.
  if (action.range <= 1 && distance(attacker.pos, target.pos) <= 1) return 0;
  return COVER_ARMOR_BONUS;
}

export function isHazardHex(
  state: Pick<CombatState, "terrain">,
  hexOrKey: Hex | string,
): boolean {
  return getTerrainType(state, hexOrKey) === "hazard";
}

/**
 * Applies hazard damage when a unit enters a hazard hex.
 * Logs the damage and defeat (if fatal). Does NOT call checkVictoryDefeat — the caller must.
 * Returns true if damage was applied.
 */
export function applyHazardOnEntry(
  unit: UnitInstance,
  state: CombatState,
  hex: Hex,
): boolean {
  if (!isHazardHex(state, hex)) return false;
  unit.hp = Math.max(0, unit.hp - HAZARD_DAMAGE);
  state.log.push({
    kind: "action",
    text: `[T${state.round}] ${unit.displayName} enters hazard at (${hex.q}, ${hex.r}) — ${HAZARD_DAMAGE} damage! ${unit.displayName}: ${unit.hp}/${unit.stats.maxHp} HP.`,
    round: state.round,
  });
  if (unit.hp <= 0) {
    handleUnitDroppedToZero(unit, state);
  }
  return true;
}

/**
 * Applies hazard damage for each new hazard hex the unit enters along a movement path.
 * The path should not include the starting hex. Each unique hazard hex triggers at most once.
 * Stops early if the unit is defeated (hp <= 0).
 */
export function applyHazardsForMovementPath(
  unit: UnitInstance,
  state: CombatState,
  path: Hex[],
): void {
  const entered = new Set<string>();
  for (const hex of path) {
    const key = hexKey(hex);
    if (isHazardHex(state, hex) && !entered.has(key)) {
      entered.add(key);
      applyHazardOnEntry(unit, state, hex);
      if (unit.hp <= 0) break;
    }
  }
}
