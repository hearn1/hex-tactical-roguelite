import { createRng } from "../core/rng.ts";
import type { ScreenId, CombatState } from "./types.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import type { Team, Hex, UnitInstance } from "./types.ts";

export type ClassId = keyof typeof CLASS_REGISTRY;
export type EnemyId = keyof typeof ENEMY_REGISTRY;

export interface GameState {
  screen: ScreenId;
  rng: () => number;
  rngSeed: number;
  combat: CombatState | null;
}

function createHeroInstance(instanceId: string, classId: ClassId, name: string, pos: Hex): UnitInstance {
  const def = CLASS_REGISTRY[classId];
  return {
    instanceId,
    defId: classId,
    displayName: name,
    team: "hero",
    level: 1,
    xp: 0,
    stats: { ...def.baseStats },
    hp: def.baseStats.maxHp,
    pos,
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
  };
}

function createEnemyInstance(instanceId: string, enemyId: EnemyId, name: string, pos: Hex): UnitInstance {
  const def = ENEMY_REGISTRY[enemyId];
  const stats = def.baseStats;
  return {
    instanceId,
    defId: enemyId,
    displayName: name,
    team: "enemy",
    level: 1,
    xp: 0,
    stats: { ...stats },
    hp: stats.maxHp,
    pos,
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
  };
}

export function initCombatState(rng: () => number): CombatState {
  const gridKeys = hexesWithinRange({ q: 0, r: 0 }, 3).map(hexKey);

  const units: UnitInstance[] = [
    createHeroInstance("hero_001", "class.guardian", "Mara", { q: -3, r: 0 }),
    createHeroInstance("hero_002", "class.acolyte", "Sable", { q: -3, r: 1 }),
    createHeroInstance("hero_003", "class.arcanist", "Eldra", { q: -3, r: 2 }),
    createEnemyInstance("enemy_g1", "enemy.goblin_skirmisher", "Goblin Skirmisher 1", { q: 3, r: -1 }),
    createEnemyInstance("enemy_w1", "enemy.wolf", "Wolf", { q: 2, r: 1 }),
    createEnemyInstance("enemy_s1", "enemy.skeleton_archer", "Skeleton Archer", { q: 3, r: -2 }),
  ];

  const rolls = units.map((u) => ({
    id: u.instanceId,
    value: Math.floor(rng() * 20) + 1 + u.stats.agility,
  }));
  rolls.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    const aTeam = units.find((u) => u.instanceId === a.id)!.team;
    const bTeam = units.find((u) => u.instanceId === b.id)!.team;
    if (aTeam !== bTeam) return aTeam === "hero" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  const turnQueue = rolls.map((r) => r.id);
  const initParts = rolls.map((r) => {
    const u = units.find((u2) => u2.instanceId === r.id)!;
    return `${u.displayName}(${r.value})`;
  });

  const firstUnit = units.find((u) => u.instanceId === turnQueue[0])!;
  firstUnit.movePointsRemaining = firstUnit.stats.move;

  return {
    round: 1,
    activeIndex: 0,
    turnQueue,
    units,
    log: [
      { kind: "initiative", text: `[T1] Initiative: ${initParts.join(", ")}`, round: 1 },
      { kind: "turn_start", text: `[T1] ${firstUnit.displayName}'s turn begins.`, round: 1 },
    ],
    status: "active",
    gridKeys,
    targetingActionId: null,
  };
}

function createGameState(): GameState {
  const seed = Date.now();
  return {
    screen: "main_menu",
    rng: createRng(seed),
    rngSeed: seed,
    combat: null,
  };
}

export const gameState: GameState = createGameState();
