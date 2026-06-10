import { describe, it, expect, beforeAll } from "vitest";
import { checkEnemyThresholdTraits, getTraitTriggered } from "./Traits.ts";
import { resolvePostDamageAftermath } from "./PostDamage.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";

const TEST_BOSS_ID = "test.reinforcement_boss";
const ENEMY_REINFORCEMENT_ID = "enemy_reinforcement";

beforeAll(() => {
  if (!ENEMY_REGISTRY[TEST_BOSS_ID]) {
    ENEMY_REGISTRY[TEST_BOSS_ID] = {
      id: TEST_BOSS_ID,
      displayName: "Test Reinforcement Boss",
      aiTag: "boss",
      baseStats: { maxHp: 30, armor: 12, move: 3, str: 3, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
      actionIds: ["action.test"],
      traits: [
        {
          id: "boss_reinforcement_at_hp_threshold",
          thresholdHpPct: 0.5,
          enemyId: "enemy.skeleton_archer",
          count: 3,
          spawnCandidates: [
            { q: 3, r: -2 },
            { q: 3, r: -1 },
            { q: 3, r: 0 },
            { q: 4, r: -2 },
            { q: 4, r: -1 },
            { q: 4, r: 0 },
          ],
        },
      ],
    };
  }
});

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

function makeTestBoss(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "boss_0",
    displayName: "Test Boss",
    team: "enemy",
    defId: TEST_BOSS_ID,
    level: 1,
    xp: 0,
    stats: { maxHp: 30, armor: 12, move: 3, str: 3, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
    hp: 30,
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

describe("reinforcement ID uniqueness", () => {
  it("multiple reinforcements from one threshold use unique IDs (via resolvePostDamageAftermath)", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    const boss = makeTestBoss({ hp: 15 });
    const state = makeState([hero, boss]);

    const result = resolvePostDamageAftermath({
      state,
      targetUnitId: "boss_0",
      previousHp: 16,
      cause: "single_target",
    });

    expect(result.triggeredBossThreshold).toBe(true);
    expect(result.triggeredReinforcements).toBe(true);
    expect(result.spawnedReinforcementIds.length).toBe(3);

    const ids = result.spawnedReinforcementIds;
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).not.toBe(ENEMY_REINFORCEMENT_ID);
    }
  });

  it("trait count is respected when enough valid spawn candidates exist", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    const boss = makeTestBoss({ hp: 15 });
    const state = makeState([hero, boss]);

    const result = checkEnemyThresholdTraits(boss, state);

    expect(result.triggeredReinforcements).toBe(true);
    expect(result.spawnedReinforcementIds.length).toBe(3);

    const spawnedInUnits = state.units.filter((u) =>
      result.spawnedReinforcementIds.includes(u.instanceId),
    );
    expect(spawnedInUnits.length).toBe(3);

    const spawnedInQueue = state.turnQueue.filter((id) =>
      result.spawnedReinforcementIds.includes(id),
    );
    expect(spawnedInQueue.length).toBe(3);
  });

  it("spawn count is capped by available valid spawn spaces", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    const blockers = [
      makeEnemy({ instanceId: "b_0", pos: { q: 3, r: -2 } }),
      makeEnemy({ instanceId: "b_1", pos: { q: 3, r: -1 } }),
      makeEnemy({ instanceId: "b_2", pos: { q: 3, r: 0 } }),
      makeEnemy({ instanceId: "b_3", pos: { q: 4, r: -2 } }),
      makeEnemy({ instanceId: "b_4", pos: { q: 4, r: -1 } }),
    ];
    const boss = makeTestBoss({ hp: 15 });
    const state = makeState([hero, boss, ...blockers]);

    const result = checkEnemyThresholdTraits(boss, state);

    expect(result.triggeredReinforcements).toBe(true);
    expect(result.spawnedReinforcementIds.length).toBe(1);
  });

  it("reinforcement counter is monotonic — advances from unset", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    const boss = makeTestBoss({ hp: 15 });
    const state = makeState([hero, boss]);

    expect(state.reinforcementCounter).toBeUndefined();

    checkEnemyThresholdTraits(boss, state);

    expect(state.reinforcementCounter).toBe(3);
  });

  it("reinforcement counter is monotonic — continues from nonzero start", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    const boss = makeTestBoss({ hp: 15 });
    const state = makeState([hero, boss], { reinforcementCounter: 5 });

    checkEnemyThresholdTraits(boss, state);

    expect(state.reinforcementCounter).toBe(8);
  });

  it("threshold trigger is idempotent — repeated call does not spawn duplicates", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 } });
    const boss = makeTestBoss({ hp: 15 });
    const state = makeState([hero, boss]);

    const first = checkEnemyThresholdTraits(boss, state);
    expect(first.triggeredReinforcements).toBe(true);
    expect(first.spawnedReinforcementIds.length).toBe(3);

    const second = checkEnemyThresholdTraits(boss, state);
    expect(second.triggeredReinforcements).toBe(false);
    expect(second.spawnedReinforcementIds.length).toBe(0);
  });

  it("active turn index remains stable after reinforcement insertion", () => {
    const hero = makeHero({ pos: { q: -1, r: 0 }, instanceId: "hero_0" });
    const boss = makeTestBoss({ hp: 15 });
    const state = makeState([hero, boss], { activeIndex: 0 });

    checkEnemyThresholdTraits(boss, state);

    expect(state.activeIndex).toBe(0);
    expect(state.turnQueue[0]).toBe("hero_0");
  });
});
