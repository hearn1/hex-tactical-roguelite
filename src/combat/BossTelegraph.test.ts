import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import { takeEnemyTurn } from "./EnemyAI.ts";
import { resolveAction, checkVictoryDefeat, removeDefeatedFromQueue } from "./Action.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";
import { hexesWithinRange, hexKey, neighbors } from "../core/hex.ts";

function makeUnit(
  overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex; defId: string },
): UnitInstance {
  return {
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    hp: 18,
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeBossState(units: UnitInstance[]): CombatState {
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
    bossActionIndex: 0,
    bossReinforcementSpawned: false,
    bossTelegraph: null,
    encounterId: "encounter.boss_ogre_hexbreaker",
  };
}

function makeBoss(hp: number): UnitInstance {
  return makeUnit({
    instanceId: "boss",
    pos: { q: 0, r: 0 },
    defId: "enemy.ogre_hexbreaker",
    team: "enemy",
    displayName: "Ogre Hexbreaker",
    stats: { maxHp: 42, armor: 13, move: 3, might: 4, agility: 0, spirit: 1 },
    hp,
    movePointsRemaining: 3,
  });
}

describe("Boss telegraphed Ground Slam (F28 / #59)", () => {
  it("does not telegraph while above 50% HP (uses normal rotation)", () => {
    const rng = createRng(7);
    const boss = makeBoss(42); // full HP
    const hero = makeUnit({ instanceId: "hero_0", pos: { q: 0, r: 3 }, defId: "class.guardian" });
    const state = makeBossState([boss, hero]);

    takeEnemyTurn(boss, state, rng);

    expect(state.bossTelegraph).toBeNull();
  });

  it("winds up (telegraphs) on the enraged turn instead of acting", () => {
    const rng = createRng(7);
    const boss = makeBoss(20); // <= 50% of 42
    const hero = makeUnit({ instanceId: "hero_0", pos: { q: 1, r: 0 }, defId: "class.guardian", hp: 50, stats: { maxHp: 50, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 } });
    const state = makeBossState([boss, hero]);

    const hpBefore = hero.hp;
    takeEnemyTurn(boss, state, rng);

    // Telegraph is set, targeting the radius-1 ring around the boss.
    expect(state.bossTelegraph).not.toBeNull();
    expect(state.bossTelegraph!.sourceId).toBe(boss.instanceId);
    expect(state.bossTelegraph!.actionId).toBe("action.ground_slam");
    const expectedRing = neighbors(boss.pos).map(hexKey);
    expect(new Set(state.bossTelegraph!.targetHexes)).toEqual(new Set(expectedRing));
    // No damage lands on the wind-up turn.
    expect(hero.hp).toBe(hpBefore);
    // A warning is logged before resolution.
    expect(state.log.some((l) => l.text.includes("winds up Ground Slam"))).toBe(true);
  });

  it("resolves on the next boss turn and hits a hero still in the area", () => {
    const rng = createRng(7);
    const boss = makeBoss(20);
    const hero = makeUnit({
      instanceId: "hero_0",
      pos: { q: 1, r: 0 }, // adjacent to boss
      defId: "class.guardian",
      hp: 50,
      stats: { maxHp: 50, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    const state = makeBossState([boss, hero]);

    takeEnemyTurn(boss, state, rng); // wind up
    expect(state.bossTelegraph).not.toBeNull();

    takeEnemyTurn(boss, state, rng); // resolve

    expect(state.bossTelegraph).toBeNull();
    expect(hero.hp).toBeLessThan(50);
    expect(hero.conditions.some((c) => c.id === "slowed")).toBe(true);
    expect(state.log.some((l) => l.text.includes("unleashes Ground Slam"))).toBe(true);
  });

  it("only telegraphs the adjacent ring — non-adjacent heroes are unaffected", () => {
    const rng = createRng(7);
    const boss = makeBoss(20);
    const far = makeUnit({
      instanceId: "hero_far",
      pos: { q: 0, r: 3 }, // distance 3, not adjacent
      defId: "class.guardian",
      hp: 50,
      stats: { maxHp: 50, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    const state = makeBossState([boss, far]);

    takeEnemyTurn(boss, state, rng); // wind up
    expect(state.bossTelegraph!.targetHexes).not.toContain(hexKey(far.pos));

    takeEnemyTurn(boss, state, rng); // resolve

    expect(far.hp).toBe(50);
    expect(state.log.some((l) => l.text.includes("cleared the area"))).toBe(true);
  });

  it("a hero who moves out of the telegraphed hexes avoids the hit", () => {
    const rng = createRng(7);
    const boss = makeBoss(20);
    const hero = makeUnit({
      instanceId: "hero_0",
      pos: { q: 1, r: 0 }, // adjacent
      defId: "class.guardian",
      hp: 50,
      stats: { maxHp: 50, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    const state = makeBossState([boss, hero]);

    takeEnemyTurn(boss, state, rng); // wind up
    // Hero repositions clear of the telegraphed ring before resolution.
    hero.pos = { q: 0, r: 3 };

    takeEnemyTurn(boss, state, rng); // resolve

    expect(hero.hp).toBe(50);
    expect(state.bossTelegraph).toBeNull();
  });

  it("Guarded halves the Ground Slam damage on resolution", () => {
    const rng = createRng(3);
    const boss = makeBoss(20);
    const guarded = makeUnit({
      instanceId: "hero_g",
      pos: { q: 1, r: 0 },
      defId: "class.guardian",
      hp: 50,
      stats: { maxHp: 50, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
      conditions: [{ id: "guarded", remainingTurns: 1 }],
    });
    const state = makeBossState([boss, guarded]);

    takeEnemyTurn(boss, state, rng); // wind up
    takeEnemyTurn(boss, state, rng); // resolve

    expect(state.log.some((l) => l.text.includes("Guarded consumed"))).toBe(true);
    expect(guarded.conditions.some((c) => c.id === "guarded")).toBe(false);
  });

  it("reinforcement still fires alongside the telegraph mechanic", () => {
    const rng = createRng(9);
    const boss = makeBoss(30); // above 50% (>21) so a hero hit can cross the threshold
    const hero = makeUnit({
      instanceId: "hero_0",
      pos: { q: 1, r: 0 },
      defId: "class.guardian",
      hp: 100,
      stats: { maxHp: 100, armor: 10, move: 3, might: 20, agility: 1, spirit: 0 },
    });
    const state = makeBossState([boss, hero]);

    // Hero smashes the boss below 50% → reinforcement spawns.
    resolveAction(ACTION_REGISTRY["action.slash"], hero, boss, state, rng);
    expect(state.bossReinforcementSpawned).toBe(true);
    const unitsAfterReinforce = state.units.length;

    // Boss, now enraged, telegraphs then resolves — both systems coexist.
    takeEnemyTurn(boss, state, rng);
    expect(state.bossTelegraph).not.toBeNull();
    takeEnemyTurn(boss, state, rng);
    expect(state.bossTelegraph).toBeNull();
    expect(state.units.length).toBe(unitsAfterReinforce);
  });

  it("lethal telegraph blow downs a hero; defeat requires all heroes dead", () => {
    const rng = createRng(1);
    const boss = makeBoss(20);
    const fragile = makeUnit({
      instanceId: "hero_0",
      pos: { q: 1, r: 0 },
      defId: "class.guardian",
      hp: 1,
      stats: { maxHp: 18, armor: 1, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    const state = makeBossState([boss, fragile]);

    takeEnemyTurn(boss, state, rng); // wind up
    takeEnemyTurn(boss, state, rng); // resolve, downs the hero

    expect(fragile.hp).toBe(0);
    expect(fragile.heroLifeState).toBe("downed");

    // Status stays active — a downed hero can still be saved.
    checkVictoryDefeat(state);
    expect(state.status).toBe("active");

    // Once all heroes are confirmed dead, defeat triggers.
    fragile.heroLifeState = "dead";
    checkVictoryDefeat(state);
    expect(state.status).toBe("defeat");
  });

  it("clears a boss telegraph when its source dies even if combat remains active", () => {
    const rng = createRng(7);
    const boss = makeBoss(20);
    const hero = makeUnit({ instanceId: "hero_0", pos: { q: 1, r: 0 }, defId: "class.guardian" });
    const minion = makeUnit({
      instanceId: "minion",
      pos: { q: 2, r: 0 },
      defId: "enemy.goblin_skirmisher",
      team: "enemy",
      displayName: "Minion",
      stats: { maxHp: 8, armor: 12, move: 4, might: 1, agility: 3, spirit: 0 },
      hp: 8,
    });
    const state = makeBossState([boss, hero, minion]);

    takeEnemyTurn(boss, state, rng);
    expect(state.bossTelegraph).not.toBeNull();

    boss.hp = 0;
    checkVictoryDefeat(state);
    removeDefeatedFromQueue(state);

    expect(state.status).toBe("active");
    expect(state.bossTelegraph).toBeNull();
  });

  it("preserves a boss telegraph when an unrelated unit dies", () => {
    const rng = createRng(7);
    const boss = makeBoss(20);
    const hero = makeUnit({ instanceId: "hero_0", pos: { q: 1, r: 0 }, defId: "class.guardian" });
    const minion = makeUnit({
      instanceId: "minion",
      pos: { q: 2, r: 0 },
      defId: "enemy.goblin_skirmisher",
      team: "enemy",
      displayName: "Minion",
      stats: { maxHp: 8, armor: 12, move: 4, might: 1, agility: 3, spirit: 0 },
      hp: 0,
    });
    const state = makeBossState([boss, hero, minion]);

    takeEnemyTurn(boss, state, rng);
    expect(state.bossTelegraph).not.toBeNull();

    removeDefeatedFromQueue(state);

    expect(state.bossTelegraph).not.toBeNull();
    expect(state.bossTelegraph!.sourceId).toBe(boss.instanceId);
  });

  it("clears a boss telegraph on victory and defeat", () => {
    const boss = makeBoss(0);
    const hero = makeUnit({ instanceId: "hero_0", pos: { q: 1, r: 0 }, defId: "class.guardian" });
    const victoryState = makeBossState([boss, hero]);
    victoryState.bossTelegraph = {
      sourceId: boss.instanceId,
      actionId: "action.ground_slam",
      targetHexes: neighbors(boss.pos).map(hexKey),
      setOnRound: victoryState.round,
    };

    checkVictoryDefeat(victoryState);

    expect(victoryState.status).toBe("victory");
    expect(victoryState.bossTelegraph).toBeNull();

    const fallenHero = makeUnit({
      instanceId: "hero_1",
      pos: { q: 1, r: 0 },
      defId: "class.guardian",
      hp: 0,
      heroLifeState: "dead",
    });
    const defeatBoss = makeBoss(20);
    const defeatState = makeBossState([defeatBoss, fallenHero]);
    defeatState.bossTelegraph = {
      sourceId: defeatBoss.instanceId,
      actionId: "action.ground_slam",
      targetHexes: neighbors(defeatBoss.pos).map(hexKey),
      setOnRound: defeatState.round,
    };

    checkVictoryDefeat(defeatState);

    expect(defeatState.status).toBe("defeat");
    expect(defeatState.bossTelegraph).toBeNull();
  });
});
