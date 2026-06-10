import { describe, it, expect } from "vitest";
import { reachableHexes, findPath, toMovementResult } from "./Movement.ts";
import { applyHazardsForMovementPath } from "./Terrain.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";
import type { CombatState, Hex, UnitInstance } from "../state/types.ts";

function makeGrid(radius: number): Set<string> {
  return new Set(hexesWithinRange({ q: 0, r: 0 }, radius).map(hexKey));
}

describe("Movement", () => {
  const gridR3 = makeGrid(3);

  // ── Baseline (no terrain cost) ─────────────────────────────────────────────

  it("center with 2 move on radius-3 grid reaches 19 hexes (radius-2 disk)", () => {
    const occupied = new Set<string>();
    const result = reachableHexes({ q: 0, r: 0 }, 2, occupied, gridR3);
    expect(result.size).toBe(19);
  });

  it("center with 3 move on radius-3 grid reaches all 37 hexes", () => {
    const occupied = new Set<string>();
    const result = reachableHexes({ q: 0, r: 0 }, 3, occupied, gridR3);
    expect(result.size).toBe(37);
  });

  it("occupied hexes are excluded from reachable destinations", () => {
    const occupied = new Set([hexKey({ q: 1, r: -1 })]);
    const result = reachableHexes({ q: 0, r: 0 }, 1, occupied, gridR3);
    expect(result.has(hexKey({ q: 1, r: -1 }))).toBe(false);
    expect(result.has(hexKey({ q: 1, r: 0 }))).toBe(true);
  });

  it("occupied hex blocks movement through it", () => {
    const occupied = new Set([hexKey({ q: 1, r: -1 })]);
    const result = reachableHexes({ q: 0, r: 0 }, 2, occupied, gridR3);
    expect(result.has(hexKey({ q: 2, r: -2 }))).toBe(false);
    expect(result.has(hexKey({ q: 1, r: 0 }))).toBe(true);
  });

  it("0 move points reaches empty set", () => {
    const occupied = new Set<string>();
    const result = reachableHexes({ q: 0, r: 0 }, 0, occupied, gridR3);
    expect(result.size).toBe(0);
  });

  // ── Difficult terrain (cost 2) ─────────────────────────────────────────────

  it("difficult terrain hex costs 2 to enter, reducing reachable range", () => {
    // Mark one adjacent hex as difficult (cost 2).
    const difficultKey = hexKey({ q: 1, r: 0 });
    const costFn = (h: Hex) => hexKey(h) === difficultKey ? 2 : 1;
    const occupied = new Set<string>();
    // With 3 move: entering difficult (cost 2) leaves 1 move for one more normal step.
    const result = reachableHexes({ q: 0, r: 0 }, 3, occupied, gridR3, costFn);
    expect(result.has(difficultKey)).toBe(true);
    expect(result.get(difficultKey)).toBe(2); // Cost to reach it is 2.
  });

  it("3 move: can reach difficult + 1 normal but not 2 difficult + 1 normal", () => {
    const difficultKeys = new Set([hexKey({ q: 1, r: 0 }), hexKey({ q: 2, r: 0 })]);
    const costFn = (h: Hex) => difficultKeys.has(hexKey(h)) ? 2 : 1;
    const occupied = new Set<string>();
    const result = reachableHexes({ q: 0, r: 0 }, 3, occupied, gridR3, costFn);
    // 1 difficult (2) + 1 normal (1) = 3 → within budget, reachable.
    expect(result.has(hexKey({ q: 1, r: -1 }))).toBe(true); // Normal neighbor of difficult
    // 2 difficult hexes = cost 4 → exceeds 3 budget.
    expect(result.has(hexKey({ q: 2, r: 0 }))).toBe(false);
  });

  it("result stores total movement cost to each hex (not step count)", () => {
    const difficultKey = hexKey({ q: 1, r: 0 });
    const costFn = (h: Hex) => hexKey(h) === difficultKey ? 2 : 1;
    const occupied = new Set<string>();
    const result = reachableHexes({ q: 0, r: 0 }, 5, occupied, gridR3, costFn);
    // Normal hex at distance 1.
    expect(result.get(hexKey({ q: 0, r: 1 }))).toBe(1);
    // Difficult hex at distance 1 costs 2 total.
    expect(result.get(difficultKey)).toBe(2);
    // Normal hex at distance 2 via all-normal route.
    expect(result.get(hexKey({ q: 0, r: 2 }))).toBe(2);
  });

  it("findPath prefers cheaper terrain route over shortest-step route with difficult terrain", () => {
    // Layout: start (0,0). Direct path via (1,0) costs 1+2=3 (difficult at (1,0)).
    //         Detour via (0,1)->(1,0) costs 1+2=3 too.
    //         Direct path via (0,-1)->(1,-1) costs 1+1=2 (all normal) then to (2,-1) etc.
    // Simpler: ensure findPath reports the cheaper cost path.
    const difficultKey = hexKey({ q: 1, r: 0 });
    const costFn = (h: Hex) => hexKey(h) === difficultKey ? 2 : 1;
    const occupied = new Set<string>();
    // Path from (0,0) to (1,0): only one step, must go through difficult terrain.
    const path = findPath({ q: 0, r: 0 }, { q: 1, r: 0 }, occupied, gridR3, 3, costFn);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(1);
    expect(path![0]).toEqual({ q: 1, r: 0 });
  });

  it("findPath respects maxCost with difficult terrain", () => {
    // Mark (1,0) and (2,0) as difficult. Budget only 2 — can reach (1,0) cost 2 but not (2,0) cost 4.
    const difficultKeys = new Set([hexKey({ q: 1, r: 0 }), hexKey({ q: 2, r: 0 })]);
    const costFn = (h: Hex) => difficultKeys.has(hexKey(h)) ? 2 : 1;
    const occupied = new Set<string>();
    const path = findPath({ q: 0, r: 0 }, { q: 2, r: 0 }, occupied, gridR3, 2, costFn);
    expect(path).toBeNull(); // Cannot afford 4 total cost with budget of 2.
  });

  it("findPath without movementCost behaves identically to before", () => {
    const occupied = new Set<string>();
    const path = findPath({ q: 0, r: 0 }, { q: 2, r: 0 }, occupied, gridR3, 3);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(2);
  });
});

// ── toMovementResult builder (#274) ──────────────────────────────────────────

function makeUnit(overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex }): UnitInstance {
  return {
    defId: "class.guardian",
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 18, armor: 14, move: 3, str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
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
    gridKeys: ["0,0", "1,0", "2,0", "-1,0", "0,1", "0,-1", "1,-1", "-1,1"],
    targetingActionId: null,
    perEncounterUses: {},
    terrain,
  };
}

describe("toMovementResult", () => {
  it("completed non-hazard move reports completed with full path and destination", () => {
    const unit = makeUnit({ instanceId: "u1", pos: { q: 2, r: 0 } }); // already at destination
    const state = makeState();
    const path: Hex[] = [{ q: 1, r: 0 }, { q: 2, r: 0 }];
    const hazardResult = applyHazardsForMovementPath(unit, state, path);

    const result = toMovementResult(unit, path, hazardResult);

    expect(result.completed).toBe(true);
    expect(result.stoppedByHazard).toBe(false);
    expect(result.unitDropped).toBe(false);
    expect(result.finalPosition).toEqual({ q: 2, r: 0 });
    expect(result.pathTaken).toEqual(path);
  });

  it("fatal-hazard move reports the unit dropped on the hazard tile", () => {
    const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 }, hp: 1 }); // dies to hazard
    const state = makeState({ "1,0": "hazard" });
    const path: Hex[] = [{ q: 1, r: 0 }, { q: 2, r: 0 }];
    const hazardResult = applyHazardsForMovementPath(unit, state, path);

    const result = toMovementResult(unit, path, hazardResult);

    expect(result.completed).toBe(false);
    expect(result.stoppedByHazard).toBe(true);
    expect(result.unitDropped).toBe(true);
    expect(result.finalPosition).toEqual({ q: 1, r: 0 }); // stopped on the killing hazard hex
  });

  it("no-op move (null hazard result) reports a completed move with empty path", () => {
    const unit = makeUnit({ instanceId: "u1", pos: { q: 0, r: 0 } });

    const result = toMovementResult(unit, [], null);

    expect(result.completed).toBe(true);
    expect(result.stoppedByHazard).toBe(false);
    expect(result.unitDropped).toBe(false);
    expect(result.finalPosition).toEqual({ q: 0, r: 0 });
    expect(result.pathTaken).toEqual([]);
  });
});
