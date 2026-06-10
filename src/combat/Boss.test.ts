import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import { takeEnemyTurn } from "./EnemyAI.ts";
import { resolveAction } from "./Action.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import { getTraitTriggered, checkEnemyThresholdTraits } from "./Traits.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";
import { hexesWithinRange, hexKey, distance } from "../core/hex.ts";

function makeUnit(overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex; defId: string }): UnitInstance {
  return {
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
    hp: 18,
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeState(units: UnitInstance[]): CombatState {
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
    traitState: { actionRotationIndex: {}, triggered: {} },
  };
}

describe("Boss", () => {
  it("boss rotation produces Roar, Massive Swing, Ground Slam, Roar", () => {
    const rng = createRng(42);
    const boss = makeUnit({
      instanceId: "boss",
      pos: { q: 0, r: 0 },
      defId: "enemy.ogre_hexbreaker",
      team: "enemy",
      displayName: "Ogre Hexbreaker",
      stats: { maxHp: 42, armor: 13, move: 3, str: 4, dex: 0, con: 0, int: 1, wis: 0, cha: 0 },
      hp: 42,
      movePointsRemaining: 3,
    });

    const heroes: UnitInstance[] = [];
    for (let i = 0; i < 3; i++) {
      heroes.push(makeUnit({
        instanceId: `hero_${i}`,
        pos: { q: 0, r: i + 1 },
        defId: "class.guardian",
        stats: { maxHp: 18, armor: 10, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      }));
    }

    const state = makeState([boss, ...heroes]);

    for (let turn = 0; turn < 4; turn++) {
      takeEnemyTurn(boss, state, rng);
      boss.hasActed = false;
    }

    expect(state.traitState?.actionRotationIndex?.["boss:boss_action_rotation"]).toBe(4);
    expect(state.log.length).toBeGreaterThan(0);

    const actionEntries = state.log.filter((l) => l.kind === "action");
    expect(actionEntries.length).toBeGreaterThanOrEqual(4);

    const actionTexts = actionEntries.map((e) => e.text);
    const expectedSequence = ["Roar", "Massive Swing", "Ground Slam", "Roar"];

    const observed: string[] = [];
    for (const text of actionTexts) {
      if (text.includes("Roar")) observed.push("Roar");
      else if (text.includes("Massive Swing")) observed.push("Massive Swing");
      else if (text.includes("Ground Slam")) observed.push("Ground Slam");
    }

    for (let i = 0; i < Math.min(observed.length, expectedSequence.length); i++) {
      expect(observed[i]).toBe(expectedSequence[i]);
    }
  });

  it("reinforcement triggers exactly once when boss HP crosses below 50%", () => {
    const rng = createRng(42);
    const boss = makeUnit({
      instanceId: "boss",
      pos: { q: 0, r: 0 },
      defId: "enemy.ogre_hexbreaker",
      team: "enemy",
      displayName: "Ogre Hexbreaker",
      stats: { maxHp: 42, armor: 10, move: 3, str: 4, dex: 0, con: 0, int: 1, wis: 0, cha: 0 },
      hp: 30,
      movePointsRemaining: 3,
    });

    const hero = makeUnit({
      instanceId: "hero_0",
      pos: { q: 1, r: 0 },
      defId: "class.guardian",
      stats: { maxHp: 100, armor: 10, move: 3, str: 10, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 100,
    });

    const state = makeState([boss, hero]);

    expect(getTraitTriggered(state, "boss:boss_reinforcement_at_hp_threshold")).toBe(false);
    expect(state.units.length).toBe(2);

    resolveAction(ACTION_REGISTRY["action.slash"], hero, boss, state, rng);

    expect(state.units.length).toBe(3);
    expect(getTraitTriggered(state, "boss:boss_reinforcement_at_hp_threshold")).toBe(true);

    const reinforcementLog = state.log.find((l) => l.text.includes("reinforcement"));
    expect(reinforcementLog).toBeDefined();

    const unitCountBefore = state.units.length;
    resolveAction(ACTION_REGISTRY["action.slash"], hero, boss, state, rng);
    expect(state.units.length).toBe(unitCountBefore);
  });

  it("reinforcement insertion preserves active hero immediately after boss", () => {
    const rng = () => 0.5;
    const boss = makeUnit({
      instanceId: "boss",
      pos: { q: 0, r: 0 },
      defId: "enemy.ogre_hexbreaker",
      team: "enemy",
      displayName: "Ogre Hexbreaker",
      stats: { maxHp: 42, armor: 10, move: 3, str: 4, dex: 0, con: 0, int: 1, wis: 0, cha: 0 },
      hp: 30,
      movePointsRemaining: 3,
    });

    const hero1 = makeUnit({
      instanceId: "hero_1",
      pos: { q: 1, r: 0 },
      defId: "class.guardian",
      stats: { maxHp: 100, armor: 10, move: 3, str: 10, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 100,
    });
    const hero2 = makeUnit({
      instanceId: "hero_2",
      pos: { q: 0, r: 1 },
      defId: "class.guardian",
      stats: { maxHp: 100, armor: 10, move: 3, str: 10, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 100,
    });

    const state = makeState([boss, hero1, hero2]);
    state.activeIndex = 1;

    resolveAction(ACTION_REGISTRY["action.slash"], hero1, boss, state, rng);

    expect(state.turnQueue.slice(0, 3)).toEqual(["boss", "boss_reinforcement_1", "hero_1"]);
    expect(state.turnQueue[state.activeIndex]).toBe("hero_1");
  });

  it("reinforcement insertion preserves active hero later in queue", () => {
    const rng = () => 0.5;
    const boss = makeUnit({
      instanceId: "boss",
      pos: { q: 0, r: 0 },
      defId: "enemy.ogre_hexbreaker",
      team: "enemy",
      displayName: "Ogre Hexbreaker",
      stats: { maxHp: 42, armor: 10, move: 3, str: 4, dex: 0, con: 0, int: 1, wis: 0, cha: 0 },
      hp: 30,
      movePointsRemaining: 3,
    });

    const hero1 = makeUnit({
      instanceId: "hero_1",
      pos: { q: 0, r: 1 },
      defId: "class.guardian",
      stats: { maxHp: 100, armor: 10, move: 3, str: 10, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 100,
    });
    const hero2 = makeUnit({
      instanceId: "hero_2",
      pos: { q: 1, r: 0 },
      defId: "class.guardian",
      stats: { maxHp: 100, armor: 10, move: 3, str: 10, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 100,
    });

    const state = makeState([boss, hero1, hero2]);
    state.activeIndex = 2;

    resolveAction(ACTION_REGISTRY["action.slash"], hero2, boss, state, rng);

    expect(state.turnQueue).toEqual(["boss", "boss_reinforcement_1", "hero_1", "hero_2"]);
    expect(state.turnQueue[state.activeIndex]).toBe("hero_2");
  });

  it("count:2 trait spawns two reinforcements with distinct deterministic IDs", () => {
    ENEMY_REGISTRY["test.twin_spawner"] = {
      id: "test.twin_spawner",
      displayName: "Twin Spawner",
      aiTag: "boss",
      baseStats: { maxHp: 50, armor: 10, move: 3, str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      actionIds: [],
      traits: [{
        id: "boss_reinforcement_at_hp_threshold",
        thresholdHpPct: 0.5,
        enemyId: "enemy.skeleton_archer",
        count: 2,
        spawnCandidates: [{ q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }],
      }],
    };

    const boss = makeUnit({
      instanceId: "twin_boss",
      pos: { q: 0, r: 0 },
      defId: "test.twin_spawner",
      team: "enemy",
      displayName: "Twin Spawner",
      stats: { maxHp: 50, armor: 10, move: 3, str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 20,
    });
    const hero = makeUnit({
      instanceId: "hero_0",
      pos: { q: 0, r: 1 },
      defId: "class.guardian",
      stats: { maxHp: 100, armor: 10, move: 3, str: 10, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 100,
    });
    const state = makeState([boss, hero]);

    const result = checkEnemyThresholdTraits(boss, state);

    expect(result.spawnedReinforcementIds).toHaveLength(2);
    expect(result.spawnedReinforcementIds[0]).not.toBe(result.spawnedReinforcementIds[1]);
    expect(state.units.length).toBe(4);
    const unitIds = state.units.map((u) => u.instanceId);
    for (const id of result.spawnedReinforcementIds) {
      expect(unitIds).toContain(id);
      expect(state.turnQueue).toContain(id);
    }

    delete ENEMY_REGISTRY["test.twin_spawner"];
  });

  it("spawnedReinforcementIds from checkEnemyThresholdTraits matches units added to state", () => {
    const boss = makeUnit({
      instanceId: "boss",
      pos: { q: 0, r: 0 },
      defId: "enemy.ogre_hexbreaker",
      team: "enemy",
      displayName: "Ogre Hexbreaker",
      stats: { maxHp: 42, armor: 10, move: 3, str: 4, dex: 0, con: 0, int: 1, wis: 0, cha: 0 },
      hp: 20,
    });
    const hero = makeUnit({
      instanceId: "hero_0",
      pos: { q: 0, r: 1 },
      defId: "class.guardian",
      stats: { maxHp: 100, armor: 10, move: 3, str: 10, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 100,
    });
    const state = makeState([boss, hero]);

    const result = checkEnemyThresholdTraits(boss, state);

    expect(result.spawnedReinforcementIds).toHaveLength(1);
    const spawnedId = result.spawnedReinforcementIds[0];
    const unitIds = state.units.map((u) => u.instanceId);
    expect(unitIds).toContain(spawnedId);
    expect(state.turnQueue).toContain(spawnedId);
  });

  it("Ground Slam hits primary plus all adjacent heroes", () => {
    const rng = createRng(42);
    const boss = makeUnit({
      instanceId: "boss",
      pos: { q: 0, r: 0 },
      defId: "enemy.ogre_hexbreaker",
      team: "enemy",
      displayName: "Ogre Hexbreaker",
      stats: { maxHp: 42, armor: 13, move: 3, str: 4, dex: 0, con: 0, int: 1, wis: 0, cha: 0 },
      hp: 42,
      movePointsRemaining: 3,
    });

    const hero1 = makeUnit({
      instanceId: "hero_1",
      pos: { q: 1, r: 0 },
      defId: "class.guardian",
      stats: { maxHp: 100, armor: 10, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 100,
    });
    const hero2 = makeUnit({
      instanceId: "hero_2",
      pos: { q: 0, r: 1 },
      defId: "class.guardian",
      stats: { maxHp: 100, armor: 10, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 100,
    });

    const state = makeState([boss, hero1, hero2]);

    // Advance rotation to index 2 (Ground Slam is at index 2 in the trait rotation).
    state.traitState!.actionRotationIndex!["boss:boss_action_rotation"] = 2;
    takeEnemyTurn(boss, state, rng);

    const hitEntries = state.log.filter((l) => l.text.includes("Ground Slam"));
    expect(hitEntries.length).toBeGreaterThan(0);

    expect(hero1.hp).toBeLessThan(100);
    expect(hero2.hp).toBeLessThan(100);
  });
});
