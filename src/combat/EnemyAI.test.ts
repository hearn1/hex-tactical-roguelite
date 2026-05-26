import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import { takeEnemyTurn } from "./EnemyAI.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";

function makeUnit(overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex; defId: string }): UnitInstance {
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
  };
}

describe("EnemyAI", () => {
  it("brute moves toward target on open grid", () => {
    const rng = createRng(42);
    const enemy = makeUnit({
      instanceId: "e1", pos: { q: 0, r: 0 }, defId: "enemy.wolf",
      team: "enemy", displayName: "Wolf",
      stats: { maxHp: 10, armor: 12, move: 5, might: 2, agility: 2, spirit: 0 },
      hp: 10, movePointsRemaining: 5,
    });
    const hero = makeUnit({
      instanceId: "h1", pos: { q: 3, r: 0 }, defId: "class.guardian",
      stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    const state = makeState([enemy, hero]);
    takeEnemyTurn(enemy, state, rng);
    const dist = Math.abs(enemy.pos.q - hero.pos.q) + Math.abs(enemy.pos.q + enemy.pos.r - hero.pos.q - hero.pos.r) + Math.abs(enemy.pos.r - hero.pos.r);
    expect(dist / 2).toBeLessThan(3);
  });

  it("brute attacks instead of moving when target is adjacent", () => {
    const rng = createRng(42);
    const enemy = makeUnit({
      instanceId: "e1", pos: { q: 0, r: 0 }, defId: "enemy.wolf",
      team: "enemy", displayName: "Wolf",
      stats: { maxHp: 10, armor: 12, move: 5, might: 2, agility: 2, spirit: 0 },
      hp: 10, movePointsRemaining: 5,
    });
    const hero = makeUnit({
      instanceId: "h1", pos: { q: 1, r: 0 }, defId: "class.guardian",
      stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    const state = makeState([enemy, hero]);
    const beforePos = { ...enemy.pos };
    takeEnemyTurn(enemy, state, rng);
    expect(enemy.pos).toEqual(beforePos);
    expect(enemy.hasActed).toBe(true);
  });

  it("skirmisher stops at range instead of closing to melee", () => {
    const rng = createRng(42);
    const enemy = makeUnit({
      instanceId: "e1", pos: { q: 0, r: 0 }, defId: "enemy.goblin_skirmisher",
      team: "enemy", displayName: "Goblin",
      stats: { maxHp: 8, armor: 12, move: 4, might: 1, agility: 3, spirit: 0 },
      hp: 8, movePointsRemaining: 4,
    });
    const hero = makeUnit({
      instanceId: "h1", pos: { q: 4, r: 0 }, defId: "class.guardian",
      stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    const state = makeState([enemy, hero]);
    takeEnemyTurn(enemy, state, rng);
    const dist = Math.abs(enemy.pos.q - hero.pos.q) + Math.abs(enemy.pos.q + enemy.pos.r - hero.pos.q - hero.pos.r) + Math.abs(enemy.pos.r - hero.pos.r);
    expect(dist / 2).toBeGreaterThanOrEqual(1);
  });

  it("does not crash when no living hero remains", () => {
    const rng = createRng(42);
    const enemy = makeUnit({
      instanceId: "e1", pos: { q: 0, r: 0 }, defId: "enemy.wolf",
      team: "enemy", displayName: "Wolf",
      stats: { maxHp: 10, armor: 12, move: 5, might: 2, agility: 2, spirit: 0 },
      hp: 10, movePointsRemaining: 5,
    });
    const deadHero = makeUnit({
      instanceId: "h1", pos: { q: 1, r: 0 }, defId: "class.guardian",
      hp: 0, stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    const state = makeState([enemy, deadHero]);
    expect(() => takeEnemyTurn(enemy, state, rng)).not.toThrow();
  });
});
