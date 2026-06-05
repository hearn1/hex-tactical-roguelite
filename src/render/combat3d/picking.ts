import { parseHexKey } from "../../core/hex.ts";
import type { Hex, UnitInstance } from "../../state/types.ts";

export type PickableKind = "hex" | "unit";

export interface PickableUserData {
  kind?: PickableKind;
  hexKey?: string;
  unitId?: string;
}

export function hexFromPickData(
  userData: PickableUserData,
  units: readonly UnitInstance[],
): Hex | null {
  if (userData.kind === "hex" && userData.hexKey) {
    return parseHexKey(userData.hexKey);
  }

  if (userData.kind === "unit" && userData.unitId) {
    const unit = units.find((u) => u.instanceId === userData.unitId && u.hp > 0);
    return unit ? { q: unit.pos.q, r: unit.pos.r } : null;
  }

  return null;
}
