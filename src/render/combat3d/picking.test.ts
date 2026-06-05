import { describe, expect, it } from "vitest";
import { hexFromPickData } from "./picking.ts";
import type { UnitInstance } from "../../state/types.ts";

function unit(instanceId: string, q: number, r: number, hp: number = 5): UnitInstance {
  return {
    instanceId,
    defId: "class.guardian",
    displayName: instanceId,
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 5, armor: 10, move: 3, might: 1, agility: 1, spirit: 1 },
    hp,
    pos: { q, r },
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
  };
}

describe("combat3d picking helpers", () => {
  it("resolves a picked hex mesh to axial coordinates", () => {
    expect(hexFromPickData({ kind: "hex", hexKey: "-2,1" }, [])).toEqual({ q: -2, r: 1 });
  });

  it("resolves a picked unit mesh to the unit's current hex", () => {
    expect(hexFromPickData({ kind: "unit", unitId: "hero_001" }, [unit("hero_001", -3, 0)])).toEqual({
      q: -3,
      r: 0,
    });
  });

  it("ignores defeated or missing unit picks", () => {
    expect(hexFromPickData({ kind: "unit", unitId: "hero_001" }, [unit("hero_001", -3, 0, 0)])).toBeNull();
    expect(hexFromPickData({ kind: "unit", unitId: "missing" }, [unit("hero_001", -3, 0)])).toBeNull();
  });
});
