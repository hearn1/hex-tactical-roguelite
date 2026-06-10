import { describe, it, expect } from "vitest";
import { resolvePostDamageAftermath } from "./PostDamage.ts";
import { getTraitTriggered } from "./Traits.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";

function makeHero(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "hero_0",
    displayName: "Hero",
    team: "hero",
    defId: "class.guardian",
    level: 1,
    xp: 0,
    stats: { maxHp: 20, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
    hp: 20,
    pos: { q: 0, r: 0 },
    heroLifeState: "standing",
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<UnitInstance> & { instanceId?: string; pos?: Hex } = {}): UnitInstance {
  return {
    instanceId: "enemy_0",
    displayName: "Goblin",
    team: "enemy",
    defId: "enemy.goblin_skirmisher",
    level: 1,
    xp: 0,
    stats: { maxHp: 8, armor: 12, move: 4, str: 1, dex: 3, con: 0, int: 0, wis: 0, cha: 0 },
    hp: 8,
    pos: { q: 1, r: 0 },
    conditions: [],
    movePointsRemaining: 4,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeBoss(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "boss_0",
    displayName: "Ogre Hexbreaker",
    team: "enemy",
    defId: "enemy.ogre_hexbreaker",
    level: 1,
    xp: 0,
    // maxHp 42, threshold at 50% = 21
    stats: { maxHp: 42, armor: 13, move: 3, str: 4, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
    hp: 42,
    pos: { q: 0, r: 0 },
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeState(
  units: UnitInstance[],
  overrides: Partial<CombatState> = {},
): CombatState {
  const grid = hexesWithinRange({ q: 0, r: 0 }, 5);
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: units.map((u) => u.instanceId),
    units,
    log: [],
    status: "active",
    gridKeys: grid.map(hexKey),
    targetingActionId: null,
    perEncounterUses: {},
    bossTelegraph: null,
    traitState: { actionRotationIndex: {}, triggered: {} },
    ...overrides,
  };
}

describe("resolvePostDamageAftermath — enemy defeat", () => {
  it("newly dropped enemy → one defeat log, targetDefeated, shouldCheckCombatEnd", () => {
    const enemy = makeEnemy({ hp: 0 });
    const state = makeState([enemy]);

    const result = resolvePostDamageAftermath({
      state,
      targetUnitId: "enemy_0",
      previousHp: 8,
      cause: "single_target",
    });

    expect(result.targetFound).toBe(true);
    expect(result.newlyDroppedToZero).toBe(true);
    expect(result.targetDefeated).toBe(true);
    expect(result.shouldCheckCombatEnd).toBe(true);
    expect(result.shouldStopCaller).toBe(true);
    expect(state.log.filter((e) => e.kind === "defeat").length).toBe(1);
  });

  it("second call on same zero-HP enemy → no additional defeat log (idempotency)", () => {
    const enemy = makeEnemy({ hp: 0 });
    const state = makeState([enemy]);

    // First call
    resolvePostDamageAftermath({ state, targetUnitId: "enemy_0", previousHp: 8, cause: "single_target" });
    const logsAfterFirst = state.log.length;

    // Second call — previousHp already 0 so wasAlreadyZero = true
    const result = resolvePostDamageAftermath({
      state,
      targetUnitId: "enemy_0",
      previousHp: 0,
      cause: "single_target",
    });

    expect(result.wasAlreadyZero).toBe(true);
    expect(result.newlyDroppedToZero).toBe(false);
    expect(state.log.length).toBe(logsAfterFirst);
  });
});

describe("resolvePostDamageAftermath — hero downed", () => {
  it("newly dropped hero → targetDowned, life state downed, not targetDefeated", () => {
    const hero = makeHero({ hp: 0 });
    const state = makeState([hero]);

    const result = resolvePostDamageAftermath({
      state,
      targetUnitId: "hero_0",
      previousHp: 20,
      cause: "single_target",
    });

    expect(result.targetFound).toBe(true);
    expect(result.newlyDroppedToZero).toBe(true);
    expect(result.targetDowned).toBe(true);
    expect(result.targetDead).toBe(false);
    expect(result.targetDefeated).toBe(false);
    expect(result.targetStillValid).toBe(false);
    expect(result.shouldStopCaller).toBe(true);
    expect(hero.heroLifeState).toBe("downed");
    expect(state.log.some((e) => e.kind === "defeat")).toBe(true);
  });
});

describe("resolvePostDamageAftermath — boss threshold", () => {
  it("boss crossing HP threshold → triggeredReinforcements and non-empty spawnedReinforcementIds", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    // Set boss HP just at threshold (21 = floor(42 * 0.5))
    const boss = makeBoss({ hp: 21 });
    const state = makeState([hero, boss]);

    const result = resolvePostDamageAftermath({
      state,
      targetUnitId: "boss_0",
      previousHp: 22,
      cause: "single_target",
    });

    expect(result.triggeredBossThreshold).toBe(true);
    expect(result.triggeredReinforcements).toBe(true);
    expect(result.spawnedReinforcementIds.length).toBeGreaterThan(0);
    expect(state.units.some((u) => u.instanceId === "boss_0_reinforcement_1")).toBe(true);
  });
});

describe("resolvePostDamageAftermath — elite rally", () => {
  it("first elite death triggers rally once", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    const e1 = makeEnemy({ instanceId: "e1", hp: 0, pos: { q: 1, r: 0 } });
    const e2 = makeEnemy({ instanceId: "e2", hp: 8, pos: { q: 2, r: 0 } });
    const state = makeState([hero, e1, e2], {
      encounterId: "encounter.broken_banner_elite",
    });

    const result = resolvePostDamageAftermath({
      state,
      targetUnitId: "e1",
      previousHp: 5,
      cause: "single_target",
    });

    expect(result.triggeredEliteRally).toBe(true);
    expect(result.triggeredEncounterDeathTraits).toBe(true);
    expect(getTraitTriggered(state, "encounter:elite_rally_on_first_death")).toBe(true);
    expect(e2.conditions.some((c) => c.id === "rallied")).toBe(true);
  });

  it("second elite death does not re-trigger rally", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    const e1 = makeEnemy({ instanceId: "e1", hp: 0, pos: { q: 1, r: 0 } });
    const e2 = makeEnemy({ instanceId: "e2", hp: 0, pos: { q: 2, r: 0 } });
    const state = makeState([hero, e1, e2], {
      encounterId: "encounter.broken_banner_elite",
    });

    // Kill first enemy
    resolvePostDamageAftermath({ state, targetUnitId: "e1", previousHp: 5, cause: "single_target" });
    const logsAfterFirst = state.log.length;

    // Kill second enemy — rally must not fire again
    const result = resolvePostDamageAftermath({
      state,
      targetUnitId: "e2",
      previousHp: 5,
      cause: "single_target",
    });

    expect(result.triggeredEliteRally).toBe(false);
    const newRallyLogs = state.log.slice(logsAfterFirst).filter((l) => l.text.includes("Rally"));
    expect(newRallyLogs.length).toBe(0);
  });
});

describe("resolvePostDamageAftermath — telegraph clear", () => {
  it("defeating the telegraph source clears bossTelegraph and sets clearedTelegraph", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    const boss = makeBoss({ hp: 0 });
    const state = makeState([hero, boss], {
      bossTelegraph: {
        sourceId: "boss_0",
        actionId: "action.ground_slam",
        targetHexes: ["0,1"],
        setOnRound: 1,
      },
    });

    const result = resolvePostDamageAftermath({
      state,
      targetUnitId: "boss_0",
      previousHp: 5,
      cause: "single_target",
    });

    expect(result.clearedTelegraph).toBe(true);
    expect(state.bossTelegraph).toBeNull();
  });

  it("defeating a non-source enemy does not clear an unrelated telegraph", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    const boss = makeBoss({ hp: 10 });
    const minion = makeEnemy({ instanceId: "minion_0", hp: 0, pos: { q: 2, r: 0 } });
    const state = makeState([hero, boss, minion], {
      bossTelegraph: {
        sourceId: "boss_0",
        actionId: "action.ground_slam",
        targetHexes: ["0,1"],
        setOnRound: 1,
      },
    });

    const result = resolvePostDamageAftermath({
      state,
      targetUnitId: "minion_0",
      previousHp: 5,
      cause: "single_target",
    });

    expect(result.clearedTelegraph).toBe(false);
    expect(state.bossTelegraph).not.toBeNull();
  });
});

describe("resolvePostDamageAftermath — unit not found", () => {
  it("returns targetFound false and does not modify state", () => {
    const state = makeState([]);

    const result = resolvePostDamageAftermath({
      state,
      targetUnitId: "missing_unit",
      previousHp: 10,
      cause: "single_target",
    });

    expect(result.targetFound).toBe(false);
    expect(result.shouldStopCaller).toBe(true);
    expect(state.log.length).toBe(0);
  });
});
