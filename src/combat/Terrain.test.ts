import { describe, it, expect } from "vitest";
import type { CombatState, UnitInstance, Hex } from "../state/types.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import {
  getTerrainType,
  movementCostForHex,
  coverArmorBonusForTarget,
  isHazardHex,
  applyHazardOnEntry,
  applyHazardsForMovementPath,
  DIFFICULT_TERRAIN_COST,
  NORMAL_TERRAIN_COST,
  COVER_ARMOR_BONUS,
  HAZARD_DAMAGE,
} from "./Terrain.ts";

function makeUnit(overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex }): UnitInstance {
  return {
    defId: "class.guardian",
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 18, armor: 14, move: 3, might: 2, agility: 1, spirit: 0 },
    hp: 18,
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeState(terrain?: Record<string, "normal" | "difficult" | "cover" | "hazard">): CombatState {
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: [],
    units: [],
    log: [],
    status: "active",
    gridKeys: ["0,0", "1,0", "-1,0", "0,1", "0,-1", "1,-1", "-1,1"],
    targetingActionId: null,
    perEncounterUses: {},
    terrain,
  };
}

// ── getTerrainType ────────────────────────────────────────────────────────────

describe("getTerrainType", () => {
  it("returns 'normal' when state has no terrain map", () => {
    const state = makeState(undefined);
    expect(getTerrainType(state, { q: 0, r: 0 })).toBe("normal");
  });

  it("returns 'normal' for a key not present in terrain map", () => {
    const state = makeState({ "1,0": "difficult" });
    expect(getTerrainType(state, { q: 0, r: 0 })).toBe("normal");
  });

  it("returns the correct type for a present key", () => {
    const state = makeState({ "1,0": "hazard", "0,1": "cover", "-1,0": "difficult" });
    expect(getTerrainType(state, { q: 1, r: 0 })).toBe("hazard");
    expect(getTerrainType(state, { q: 0, r: 1 })).toBe("cover");
    expect(getTerrainType(state, { q: -1, r: 0 })).toBe("difficult");
  });

  it("accepts a string key as well as a Hex object", () => {
    const state = makeState({ "2,0": "cover" });
    expect(getTerrainType(state, "2,0")).toBe("cover");
  });
});

// ── movementCostForHex ────────────────────────────────────────────────────────

describe("movementCostForHex", () => {
  it("returns NORMAL_TERRAIN_COST for normal terrain", () => {
    expect(movementCostForHex(makeState(), { q: 0, r: 0 })).toBe(NORMAL_TERRAIN_COST);
  });

  it("returns DIFFICULT_TERRAIN_COST for difficult terrain", () => {
    const state = makeState({ "0,0": "difficult" });
    expect(movementCostForHex(state, { q: 0, r: 0 })).toBe(DIFFICULT_TERRAIN_COST);
  });

  it("returns NORMAL_TERRAIN_COST for cover terrain (only armor effect, not move)", () => {
    const state = makeState({ "0,0": "cover" });
    expect(movementCostForHex(state, { q: 0, r: 0 })).toBe(NORMAL_TERRAIN_COST);
  });

  it("returns NORMAL_TERRAIN_COST for hazard terrain (damage on entry, not move cost)", () => {
    const state = makeState({ "0,0": "hazard" });
    expect(movementCostForHex(state, { q: 0, r: 0 })).toBe(NORMAL_TERRAIN_COST);
  });
});

// ── coverArmorBonusForTarget ──────────────────────────────────────────────────

describe("coverArmorBonusForTarget", () => {
  const rangedAction = ACTION_REGISTRY["action.fire_bolt"]; // range 4
  const meleeAction = ACTION_REGISTRY["action.slash"];      // range 1

  it("returns COVER_ARMOR_BONUS for a ranged attack on a target in cover", () => {
    const state = makeState({ "3,0": "cover" });
    const attacker = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 } });
    const target = makeUnit({ instanceId: "t1", pos: { q: 3, r: 0 }, team: "enemy" });
    expect(coverArmorBonusForTarget(state, rangedAction, attacker, target)).toBe(COVER_ARMOR_BONUS);
  });

  it("returns 0 for a melee attack on a target in cover (attacker adjacent)", () => {
    const state = makeState({ "1,0": "cover" });
    const attacker = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 } });
    const target = makeUnit({ instanceId: "t1", pos: { q: 1, r: 0 }, team: "enemy" });
    expect(coverArmorBonusForTarget(state, meleeAction, attacker, target)).toBe(0);
  });

  it("returns 0 when target is not on a cover hex", () => {
    const state = makeState({ "2,0": "cover" });
    const attacker = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 } });
    const target = makeUnit({ instanceId: "t1", pos: { q: 3, r: 0 }, team: "enemy" });
    expect(coverArmorBonusForTarget(state, rangedAction, attacker, target)).toBe(0);
  });

  it("returns 0 for a heal action even if target is on cover", () => {
    const state = makeState({ "1,0": "cover" });
    const healer = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 } });
    const ally = makeUnit({ instanceId: "h2", pos: { q: 1, r: 0 } });
    const healAction = ACTION_REGISTRY["action.mend_wounds"];
    expect(coverArmorBonusForTarget(state, healAction, healer, ally)).toBe(0);
  });

  it("returns 0 when state has no terrain", () => {
    const state = makeState(undefined);
    const attacker = makeUnit({ instanceId: "a1", pos: { q: 0, r: 0 } });
    const target = makeUnit({ instanceId: "t1", pos: { q: 3, r: 0 }, team: "enemy" });
    expect(coverArmorBonusForTarget(state, rangedAction, attacker, target)).toBe(0);
  });
});

// ── isHazardHex ───────────────────────────────────────────────────────────────

describe("isHazardHex", () => {
  it("returns true for hazard hex", () => {
    const state = makeState({ "1,0": "hazard" });
    expect(isHazardHex(state, { q: 1, r: 0 })).toBe(true);
  });

  it("returns false for non-hazard terrain", () => {
    const state = makeState({ "1,0": "difficult" });
    expect(isHazardHex(state, { q: 1, r: 0 })).toBe(false);
  });

  it("returns false when no terrain map present", () => {
    expect(isHazardHex(makeState(undefined), { q: 1, r: 0 })).toBe(false);
  });
});

// ── applyHazardOnEntry ────────────────────────────────────────────────────────

describe("applyHazardOnEntry", () => {
  it("deals HAZARD_DAMAGE when unit enters a hazard hex", () => {
    const state = makeState({ "1,0": "hazard" });
    const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 }, hp: 10 });
    state.units.push(unit);
    const applied = applyHazardOnEntry(unit, state, { q: 1, r: 0 });
    expect(applied).toBe(true);
    expect(unit.hp).toBe(10 - HAZARD_DAMAGE);
    expect(state.log.some((e) => e.kind === "action")).toBe(true);
  });

  it("returns false and does not damage when hex is not hazard", () => {
    const state = makeState({ "1,0": "cover" });
    const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 }, hp: 10 });
    state.units.push(unit);
    const applied = applyHazardOnEntry(unit, state, { q: 1, r: 0 });
    expect(applied).toBe(false);
    expect(unit.hp).toBe(10);
  });

  it("floors hp at 0 and logs defeat when fatal", () => {
    const state = makeState({ "1,0": "hazard" });
    const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 }, hp: 1, team: "enemy" });
    state.units.push(unit);
    applyHazardOnEntry(unit, state, { q: 1, r: 0 });
    expect(unit.hp).toBe(0);
    expect(state.log.some((e) => e.kind === "defeat")).toBe(true);
  });
});

// ── applyHazardsForMovementPath ───────────────────────────────────────────────

describe("applyHazardsForMovementPath", () => {
  it("does nothing for a path with no hazard hexes", () => {
    const state = makeState({ "3,0": "hazard" });
    const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 }, hp: 10 });
    state.units.push(unit);
    applyHazardsForMovementPath(unit, state, [{ q: 1, r: 0 }, { q: 2, r: 0 }]);
    expect(unit.hp).toBe(10);
  });

  it("deals damage once per unique hazard hex entered", () => {
    const state = makeState({ "1,0": "hazard", "2,0": "hazard" });
    const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 }, hp: 18 });
    state.units.push(unit);
    // Path enters two different hazard hexes.
    applyHazardsForMovementPath(unit, state, [{ q: 1, r: 0 }, { q: 2, r: 0 }]);
    expect(unit.hp).toBe(18 - HAZARD_DAMAGE * 2);
  });

  it("does not deal damage twice for the same hazard hex in one move", () => {
    const state = makeState({ "1,0": "hazard" });
    const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 }, hp: 18 });
    state.units.push(unit);
    // Artificial path that passes through the same hazard hex twice.
    applyHazardsForMovementPath(unit, state, [{ q: 1, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 0 }]);
    expect(unit.hp).toBe(18 - HAZARD_DAMAGE);
  });

  it("stops applying hazards after the unit is defeated", () => {
    const state = makeState({ "1,0": "hazard", "2,0": "hazard" });
    const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 }, hp: HAZARD_DAMAGE, team: "enemy" });
    state.units.push(unit);
    applyHazardsForMovementPath(unit, state, [{ q: 1, r: 0 }, { q: 2, r: 0 }]);
    // Should stop after first hazard kills the unit — only HAZARD_DAMAGE damage total.
    expect(unit.hp).toBe(0);
    const hazardLogs = state.log.filter((e) => e.kind === "action");
    expect(hazardLogs.length).toBe(1);
  });

  it("does not trigger for the starting hex (path excludes it)", () => {
    // The starting position is a hazard but not in the path array.
    const state = makeState({ "0,0": "hazard" });
    const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 }, hp: 10 });
    state.units.push(unit);
    applyHazardsForMovementPath(unit, state, [{ q: 1, r: 0 }]);
    expect(unit.hp).toBe(10); // No damage because the path only contains the destination.
  });
});
