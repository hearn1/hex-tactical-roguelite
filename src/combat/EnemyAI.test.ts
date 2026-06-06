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
    perEncounterUses: {},
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

function makeStalker(pos: Hex, move = 5): UnitInstance {
  return makeUnit({
    instanceId: "amb1", pos, defId: "enemy.shadow_stalker", team: "enemy", displayName: "Shadow Stalker",
    stats: { maxHp: 11, armor: 13, move, might: 2, agility: 4, spirit: 0 },
    hp: 11, movePointsRemaining: move,
  });
}

describe("EnemyAI ambusher", () => {
  it("holds back from a healthy, escorted party instead of charging into melee", () => {
    const rng = createRng(42);
    const stalker = makeStalker({ q: 3, r: 0 });
    // Two adjacent, full-HP heroes: neither wounded nor exposed -> no opening.
    const h1 = makeUnit({ instanceId: "h1", pos: { q: 0, r: 0 }, defId: "class.guardian" });
    const h2 = makeUnit({ instanceId: "h2", pos: { q: 1, r: 0 }, defId: "class.guardian" });
    const state = makeState([stalker, h1, h2]);
    const before = h1.hp + h2.hp;
    takeEnemyTurn(stalker, state, rng);
    // It must not have struck (no opening) and must not have dived into melee range.
    expect(h1.hp + h2.hp).toBe(before);
    const nearest = Math.min(
      Math.abs(stalker.pos.q - 0) + Math.abs(stalker.pos.q + stalker.pos.r - 0) + Math.abs(stalker.pos.r - 0),
      Math.abs(stalker.pos.q - 1) + Math.abs(stalker.pos.q + stalker.pos.r - 1) + Math.abs(stalker.pos.r - 0),
    ) / 2;
    expect(nearest).toBeGreaterThanOrEqual(1);
  });

  it("rushes and bursts an exposed (lone) hero", () => {
    const rng = createRng(1); // first d20 = 13 -> hits armor 5
    const stalker = makeStalker({ q: 0, r: 0 });
    // A single hero with no ally adjacent is "exposed" -> prime target.
    const lone = makeUnit({
      instanceId: "h1", pos: { q: 2, r: 0 }, defId: "class.guardian",
      stats: { maxHp: 18, armor: 5, move: 3, might: 3, agility: 1, spirit: 0 }, hp: 18,
    });
    const state = makeState([stalker, lone]);
    takeEnemyTurn(stalker, state, rng);
    // Closed to melee and struck (low armor guarantees a hit), logging the ambush burst.
    const dist = (Math.abs(stalker.pos.q - lone.pos.q) + Math.abs(stalker.pos.q + stalker.pos.r - lone.pos.q - lone.pos.r) + Math.abs(stalker.pos.r - lone.pos.r)) / 2;
    expect(dist).toBeLessThanOrEqual(1);
    expect(state.log.some((l) => l.text.includes("Ambush!"))).toBe(true);
    expect(lone.hp).toBeLessThan(18);
  });

  it("treats a wounded but escorted hero as a prime target", () => {
    const rng = createRng(3);
    const stalker = makeStalker({ q: 0, r: 0 });
    const wounded = makeUnit({
      instanceId: "h1", pos: { q: 1, r: 0 }, defId: "class.guardian",
      stats: { maxHp: 18, armor: 5, move: 3, might: 3, agility: 1, spirit: 0 }, hp: 4,
    });
    const ally = makeUnit({
      instanceId: "h2", pos: { q: 1, r: 1 }, defId: "class.guardian",
      stats: { maxHp: 18, armor: 5, move: 3, might: 3, agility: 1, spirit: 0 }, hp: 18,
    });
    const state = makeState([stalker, wounded, ally]);
    takeEnemyTurn(stalker, state, rng);
    expect(wounded.hp).toBeLessThan(4);
    expect(state.log.some((l) => l.text.includes("Ambush!"))).toBe(true);
  });
});
