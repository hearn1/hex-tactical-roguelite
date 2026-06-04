// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { gameState, resetGameState, createCombatFromRun } from "../../src/state/GameState.ts";
import { applyAdventureModifier } from "../../src/data/adventureModifiers.ts";
import { setupDefaultRun } from "./helpers/seededRun.ts";
import { DIFFICULTY_CONFIG, scaleStat } from "../../src/data/difficulty.ts";

function runModMaxHp(combatState: ReturnType<typeof createCombatFromRun>, instanceId: string): number {
  const u = combatState.units.find((x) => x.instanceId === instanceId)!;
  return u.stats.maxHp;
}

function getEnemies(combatState: ReturnType<typeof createCombatFromRun>) {
  return combatState.units.filter((u) => u.team === "enemy");
}

describe("adventure modifiers — combat integration", () => {
  it("without modifiers, enemy HP matches base (normal difficulty)", () => {
    resetGameState(42);
    setupDefaultRun(42);
    const run = gameState.run!;
    const combat = createCombatFromRun(run, "encounter.road_ambush", gameState.rng);
    const enemies = getEnemies(combat);
    // Goblin: 8 HP, Wolf: 10 HP
    expect(enemies.length).toBe(3);
    const goblins = enemies.filter((e) => e.defId === "enemy.goblin_skirmisher");
    const wolves = enemies.filter((e) => e.defId === "enemy.wolf");
    expect(goblins.length).toBe(2);
    expect(wolves.length).toBe(1);
    for (const g of goblins) expect(g.stats.maxHp).toBe(8);
    expect(wolves[0].stats.maxHp).toBe(10);
    expect(combat.modifierDamageBonus).toBeUndefined();
  });

  it("dangerous_roads scales enemy HP and sets modifierDamageBonus", () => {
    resetGameState(42);
    setupDefaultRun(42);
    const run = gameState.run!;
    applyAdventureModifier(run, "modifier.dangerous_roads");
    const combat = createCombatFromRun(run, "encounter.road_ambush", gameState.rng);
    const enemies = getEnemies(combat);
    const goblins = enemies.filter((e) => e.defId === "enemy.goblin_skirmisher");
    const wolves = enemies.filter((e) => e.defId === "enemy.wolf");
    const expectedGoblinHp = scaleStat(Math.ceil(8 * 1.1), 1.0);
    const expectedWolfHp = scaleStat(Math.ceil(10 * 1.1), 1.0);
    for (const g of goblins) expect(g.stats.maxHp).toBe(expectedGoblinHp);
    expect(wolves[0].stats.maxHp).toBe(expectedWolfHp);
    expect(combat.modifierDamageBonus).toBe(1);
  });

  it("modifier + difficulty HP multipliers stack multiplicatively", () => {
    resetGameState(42);
    setupDefaultRun(42);
    const run = gameState.run!;
    run.difficulty = "hard";
    applyAdventureModifier(run, "modifier.dangerous_roads");
    const combat = createCombatFromRun(run, "encounter.road_ambush", gameState.rng);
    const enemies = getEnemies(combat);
    const goblins = enemies.filter((e) => e.defId === "enemy.goblin_skirmisher");
    const wolves = enemies.filter((e) => e.defId === "enemy.wolf");
    const diffMult = DIFFICULTY_CONFIG["hard"].enemyHpMultiplier;
    const expectedGoblinHp = scaleStat(Math.ceil(8 * 1.1), diffMult);
    const expectedWolfHp = scaleStat(Math.ceil(10 * 1.1), diffMult);
    for (const g of goblins) expect(g.stats.maxHp).toBe(expectedGoblinHp);
    expect(wolves[0].stats.maxHp).toBe(expectedWolfHp);
    // no modifier damage bonus from hard alone with these checks — modifierDamageBonus
    // comes only from runModifiers, not from difficulty
    expect(combat.modifierDamageBonus).toBe(1);
  });

  it("elite_contracts HP multiplier applies to all enemies", () => {
    resetGameState(42);
    setupDefaultRun(42);
    const run = gameState.run!;
    applyAdventureModifier(run, "modifier.elite_contracts");
    const combat = createCombatFromRun(run, "encounter.broken_banner_elite", gameState.rng);
    const enemies = getEnemies(combat);
    expect(enemies.length).toBe(4);
    // bandit_brute: 16 HP → ceil(16*1.15) = 19
    const brute = enemies.find((e) => e.defId === "enemy.bandit_brute")!;
    expect(brute.stats.maxHp).toBe(scaleStat(Math.ceil(16 * 1.15), 1.0));
  });

  it("multiple enemy_hp_multiplier modifiers stack", () => {
    resetGameState(42);
    setupDefaultRun(42);
    const run = gameState.run!;
    // Add both dangerous_roads (1.1x) and elite_contracts (1.15x) → 1.1 * 1.15 = 1.265x
    applyAdventureModifier(run, "modifier.dangerous_roads");
    applyAdventureModifier(run, "modifier.elite_contracts");
    const combat = createCombatFromRun(run, "encounter.road_ambush", gameState.rng);
    const enemies = getEnemies(combat);
    const goblin = enemies.find((e) => e.defId === "enemy.goblin_skirmisher")!;
    const expected = scaleStat(Math.ceil(8 * 1.1 * 1.15), 1.0);
    expect(goblin.stats.maxHp).toBe(expected);
  });
});
