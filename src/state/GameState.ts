import { createRng } from "../core/rng.ts";
import type { ScreenId, CombatState, Hex, UnitInstance, UnitStats } from "./types.ts";
import { hexesWithinRange, hexKey, distance } from "../core/hex.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { ENCOUNTER_REGISTRY } from "../data/encounters.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import type { Team } from "./types.ts";
import type { RunState, PartyMember } from "./RunState.ts";
import type { InventoryState } from "../run/Inventory.ts";
import { createInventory } from "../run/Inventory.ts";
import { computeStats } from "../combat/Stats.ts";

export type ClassId = keyof typeof CLASS_REGISTRY;
export type EnemyId = keyof typeof ENEMY_REGISTRY;

export interface GameState {
  screen: ScreenId;
  rng: () => number;
  rngSeed: number;
  combat: CombatState | null;
  run: RunState | null;
  inventory: InventoryState;
}

function equipStartingItems(unit: UnitInstance): void {
  const classDef = CLASS_REGISTRY[unit.defId];
  if (!classDef?.startingItems) return;
  for (const itemId of classDef.startingItems) {
    const itemDef = ITEM_REGISTRY[itemId];
    if (!itemDef) continue;
    if (itemDef.slot === "weapon" || itemDef.slot === "armor" || itemDef.slot === "trinket") {
      if (!unit.equippedItemIds[itemDef.slot]) {
        unit.equippedItemIds[itemDef.slot] = itemId;
      }
    }
  }
}

function createHeroInstance(instanceId: string, classId: ClassId, name: string, pos: Hex): UnitInstance {
  const def = CLASS_REGISTRY[classId];
  const unit: UnitInstance = {
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
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
  };
  equipStartingItems(unit);
  unit.stats = computeStats(unit);
  unit.hp = unit.stats.maxHp;
  return unit;
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
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
  };
}

const HERO_SPAWN_POSITIONS: Hex[] = [
  { q: -3, r: 0 },
  { q: -3, r: 1 },
  { q: -3, r: -1 },
  { q: -3, r: 2 },
  { q: -3, r: -2 },
];

export function scatterEnemyPositions(count: number): Hex[] {
  const positions: Hex[] = [
    { q: 1, r: -1 },
    { q: 2, r: 0 },
    { q: 1, r: 1 },
    { q: 2, r: -2 },
    { q: 2, r: 2 },
  ];
  return positions.slice(0, count);
}

function buildTurnQueue(units: UnitInstance[], rng: () => number): string[] {
  const rolls = units.map((u) => ({
    id: u.instanceId,
    value: Math.floor(rng() * 20) + 1 + u.stats.agility,
  }));
  rolls.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    const aUnit = units.find((u) => u.instanceId === a.id)!;
    const bUnit = units.find((u) => u.instanceId === b.id)!;
    if (aUnit.team !== bUnit.team) return aUnit.team === "hero" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return rolls.map((r) => r.id);
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
    bossActionIndex: 0,
    bossReinforcementSpawned: false,
  };
}

function createHeroFromPartyMember(pm: PartyMember, pos: Hex): UnitInstance {
  const def = CLASS_REGISTRY[pm.classId];
  const unit: UnitInstance = {
    instanceId: pm.instanceId,
    defId: pm.classId,
    displayName: pm.displayName,
    team: "hero",
    level: pm.level,
    xp: pm.xp,
    stats: { ...def.baseStats },
    hp: pm.hp,
    pos,
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { ...pm.equippedItemIds },
    bonusStats: { ...pm.bonusStats },
  };
  unit.stats = computeStats(unit);
  return unit;
}

export function createCombatFromRun(run: RunState, encounterId: string, rng: () => number): CombatState {
  const encounterDef = ENCOUNTER_REGISTRY[encounterId];
  if (!encounterDef) throw new Error(`Unknown encounter: ${encounterId}`);

  const gridKeys = hexesWithinRange({ q: 0, r: 0 }, 3).map(hexKey);
  const units: UnitInstance[] = [];

  for (let i = 0; i < run.party.length; i++) {
    const pm = run.party[i];
    const pos = HERO_SPAWN_POSITIONS[i] ?? { q: -3, r: i };
    units.push(createHeroFromPartyMember(pm, pos));
  }

  let enemyCount = 0;
  for (const group of encounterDef.enemyGroups) {
    const enemyDef = ENEMY_REGISTRY[group.enemyId];
    if (!enemyDef) continue;
    const positions = scatterEnemyPositions(group.count);
    for (let i = 0; i < group.count; i++) {
      enemyCount++;
      const pos = positions[i] ?? { q: 2, r: enemyCount };
      const name = group.count > 1 ? `${enemyDef.displayName} ${i + 1}` : enemyDef.displayName;
      const instId = `enemy_${enemyDef.id}_${enemyCount}`;
      units.push(createEnemyInstance(instId, group.enemyId as EnemyId, name, pos));
    }
  }

  const turnQueue = buildTurnQueue(units, rng);
  const firstUnit = units.find((u) => u.instanceId === turnQueue[0])!;
  firstUnit.movePointsRemaining = firstUnit.stats.move;

  const isBoss = encounterId === "encounter.boss_ogre_hexbreaker";

  return {
    round: 1,
    activeIndex: 0,
    turnQueue,
    units,
    log: [
      { kind: "initiative", text: `[T1] Battle begins: ${encounterDef.displayName}`, round: 1 },
      { kind: "turn_start", text: `[T1] ${firstUnit.displayName}'s turn begins.`, round: 1 },
    ],
    status: "active",
    gridKeys,
    targetingActionId: null,
    bossActionIndex: isBoss ? 0 : undefined,
    bossReinforcementSpawned: isBoss ? false : undefined,
    encounterId,
  };
}

export function syncPartyFromCombat(combat: CombatState, run: RunState): void {
  for (const pm of run.party) {
    const unit = combat.units.find((u) => u.instanceId === pm.instanceId);
    if (!unit) continue;
    pm.hp = unit.hp > 0 ? unit.hp : 1;
    pm.xp = unit.xp;
    pm.level = unit.level;
    pm.bonusStats = { ...(unit.bonusStats ?? {}) };
    pm.equippedItemIds = { ...unit.equippedItemIds };
  }
}

export function findReinforcementSpawnPos(units: UnitInstance[], gridKeys: string[]): Hex | null {
  const occupied = new Set(units.filter((u) => u.hp > 0).map((u) => hexKey(u.pos)));
  const candidates: Hex[] = [
    { q: 3, r: -2 },
    { q: 3, r: -1 },
    { q: 3, r: 0 },
    { q: 4, r: -2 },
    { q: 4, r: -1 },
    { q: 4, r: 0 },
  ];
  for (const pos of candidates) {
    const key = hexKey(pos);
    if (!occupied.has(key) && gridKeys.includes(key)) {
      return pos;
    }
  }
  return null;
}

function createGameState(): GameState {
  const seed = Date.now();
  return {
    screen: "main_menu",
    rng: createRng(seed),
    rngSeed: seed,
    combat: null,
    run: null,
    inventory: createInventory(),
  };
}

export const gameState: GameState = createGameState();
