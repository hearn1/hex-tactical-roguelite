import { createRng } from "../core/rng.ts";
import type { ScreenId, CombatState, Hex, UnitInstance, UnitStats, RunModifier, TerrainType } from "./types.ts";
import { hexesWithinRange, hexKey, distance } from "../core/hex.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { ENCOUNTER_REGISTRY } from "../data/encounters.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import type { Team } from "./types.ts";
import type { RunState, PartyMember, PendingLevelUp } from "./RunState.ts";
import type { InventoryState } from "../run/Inventory.ts";
import { createInventory } from "../run/Inventory.ts";
import { computeStats } from "../combat/Stats.ts";
import { applyCondition } from "../combat/Condition.ts";
import { LEVELUP_PASSIVE_START_COMBAT_GUARDED } from "../data/levelups.ts";
import { resolveOncePerCombatBonus } from "../combat/ItemHooks.ts";
import type { MetaProgressionState } from "../meta/MetaProgression.ts";
import { createDefaultMetaProgression } from "../meta/MetaProgression.ts";
import { DIFFICULTY_CONFIG, scaleStat } from "../data/difficulty.ts";
import { nodeTypeToEnvironmentTheme } from "../data/environmentThemes.ts";
import type { NodeType } from "../data/nodes.ts";
import { resetRewardScreenState } from "../ui/screens/RewardScreen.ts";
import { resetCampScreenState } from "../ui/screens/CampScreen.ts";
import { resetShopScreenState } from "../ui/screens/ShopScreen.ts";
import { resetLevelUpScreenState } from "../ui/screens/LevelUpScreen.ts";
import { resetInventoryScreenState } from "../ui/screens/InventoryScreen.ts";
import { resetEventScreenState } from "../ui/screens/EventScreen.ts";
import { resetRecruitScreenState } from "../ui/screens/RecruitScreen.ts";
import { syncHitDiceForPartyMember, classSpellSlotsMax } from "../run/Rest.ts";

export type ClassId = keyof typeof CLASS_REGISTRY;
export type EnemyId = keyof typeof ENEMY_REGISTRY;

export interface GameState {
  screen: ScreenId;
  rng: () => number;
  rngSeed: number;
  combat: CombatState | null;
  run: RunState | null;
  inventory: InventoryState;
  meta: MetaProgressionState;
  /** Level-ups awaiting a player choice (F29 / #60), resolved one at a time on the levelup screen. */
  pendingLevelUps: PendingLevelUp[];
  /** Screen to return to once the pending level-up queue drains (set when routing to levelup). */
  levelUpReturnScreen: ScreenId;
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
    spellsKnown: [],
    preparedActionIds: [],
    spellSlotsMax: classSpellSlotsMax(classId),
    spellSlotsRemaining: classSpellSlotsMax(classId),
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
    spellsKnown: [],
    preparedActionIds: [],
  };
}

export const HERO_SPAWN_POSITIONS: Hex[] = [
  { q: -3, r: 0 },
  { q: -3, r: 1 },
  { q: -3, r: 2 },
  { q: -3, r: 3 },
];

for (const pos of HERO_SPAWN_POSITIONS) {
  if (distance({ q: 0, r: 0 }, pos) > 3) {
    throw new Error(`Hero spawn position ${hexKey(pos)} is outside the radius-3 combat grid.`);
  }
}

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
    perEncounterUses: {},
    traitState: { actionRotationIndex: {}, triggered: {} },
    theme: nodeTypeToEnvironmentTheme("combat"),
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
    abilityScores: pm.abilityScores ? { ...pm.abilityScores } : undefined,
    backgroundId: pm.backgroundId,
    archetypeId: pm.archetypeId,
    actionUpgrades: pm.actionUpgrades ? { ...pm.actionUpgrades } : undefined,
    passives: pm.passives ? [...pm.passives] : undefined,
    firstHealDone: false,
    spellsKnown: pm.spellsKnown ? [...pm.spellsKnown] : [],
    preparedActionIds: pm.preparedActionIds ? [...pm.preparedActionIds] : [],
    spellSlotsMax: pm.spellSlotsMax ?? classSpellSlotsMax(pm.classId),
    spellSlotsRemaining: pm.spellSlotsRemaining ?? pm.spellSlotsMax ?? classSpellSlotsMax(pm.classId),
    heroLifeState: "standing",
  };
  unit.stats = computeStats(unit);
  if (pm.hp >= pm.maxHp) {
    unit.hp = unit.stats.maxHp;
  } else {
    unit.hp = Math.min(pm.hp, unit.stats.maxHp);
  }
  return unit;
}

export function createCombatFromRun(
  run: RunState,
  encounterId: string,
  rng: () => number,
  sourceNodeType?: NodeType,
): CombatState {
  const encounterDef = ENCOUNTER_REGISTRY[encounterId];
  if (!encounterDef) throw new Error(`Unknown encounter: ${encounterId}`);

  const diffConfig = DIFFICULTY_CONFIG[run.difficulty ?? "normal"];

  const gridKeys = hexesWithinRange({ q: 0, r: 0 }, 3).map(hexKey);
  const units: UnitInstance[] = [];

  const activeParty = run.party.filter((pm) => !pm.deadForRun);
  for (let i = 0; i < activeParty.length; i++) {
    const pm = activeParty[i];
    const pos = HERO_SPAWN_POSITIONS[Math.min(i, HERO_SPAWN_POSITIONS.length - 1)];
    units.push(createHeroFromPartyMember(pm, pos));
  }

  // Enemy placement uses the encounter's declared `positions` (one entry per enemy slot,
  // in enemyGroups order) when present, else a shared scatter. Both index a single flat
  // counter so no two enemies share a hex.
  const totalEnemies = encounterDef.enemyGroups.reduce((sum, g) => sum + g.count, 0);
  const customPositions = encounterDef.positions;
  const fallbackPositions = scatterEnemyPositions(totalEnemies);
  const isEliteEncounter = encounterDef.eliteTrait !== undefined || (encounterDef.traits?.some((t) => t.id === "elite_rally_on_first_death") ?? false);
  let enemyIndex = 0;
  for (const group of encounterDef.enemyGroups) {
    const enemyDef = ENEMY_REGISTRY[group.enemyId];
    if (!enemyDef) continue;
    const actualCount = group.count;
    for (let i = 0; i < actualCount; i++) {
      const pos =
        customPositions?.[enemyIndex] ?? fallbackPositions[enemyIndex] ?? { q: 2, r: enemyIndex + 1 };
      enemyIndex++;
      const name = actualCount > 1 ? `${enemyDef.displayName} ${i + 1}` : enemyDef.displayName;
      const instId = `enemy_${enemyDef.id}_${enemyIndex}`;
      const inst = createEnemyInstance(instId, group.enemyId as EnemyId, name, pos);
      const modEffect = applyModifierCombatEffects(run.runModifiers, inst.stats.maxHp, isEliteEncounter);
      inst.stats.maxHp = scaleStat(modEffect.maxHp, diffConfig.enemyHpMultiplier);
      inst.hp = inst.stats.maxHp;
      units.push(inst);
    }
  }
  const modifierDamageBonus = run.runModifiers
    .filter((m): m is { kind: "enemy_damage_bonus"; value: number } => m.kind === "enemy_damage_bonus")
    .reduce((sum, m) => sum + m.value, 0);

  // Hold the Line passive (F29): heroes who took it begin combat already Guarded.
  for (const unit of units) {
    if (unit.team === "hero" && unit.passives?.includes(LEVELUP_PASSIVE_START_COMBAT_GUARDED)) {
      applyCondition(unit, "guarded", 1);
    }
  }

  // Camp "Prepare for Combat" buff (F30 / #61): a readied party enters Blessed. Consume every
  // queued blessing here so the buff is spent by the next battle (it persisted across any
  // non-combat nodes until now). Duration 2 survives the hero's first turn-start tick so the
  // bonus is still live for their opening attack/heal, then Blessed is consumed on use.
  const hadBlessing = run.runModifiers.some((m) => m.kind === "next_combat_blessing");
  if (hadBlessing) {
    run.runModifiers = run.runModifiers.filter((m) => m.kind !== "next_combat_blessing");
    for (const unit of units) {
      if (unit.team === "hero" && unit.hp > 0) applyCondition(unit, "blessed", 2);
    }
  }

  const turnQueue = buildTurnQueue(units, rng);
  const firstUnit = units.find((u) => u.instanceId === turnQueue[0])!;
  firstUnit.movePointsRemaining = firstUnit.stats.move;

  const theme = nodeTypeToEnvironmentTheme(sourceNodeType, encounterId);

  // Convert authored terrain list to a keyed lookup (normal tiles omitted, missing key = "normal").
  const terrain: Record<string, TerrainType> | undefined = encounterDef.terrain
    ? Object.fromEntries(encounterDef.terrain.map((t) => [hexKey({ q: t.q, r: t.r }), t.type]))
    : undefined;

  const log: CombatState["log"] = [
    { kind: "initiative", text: `[T1] Battle begins: ${encounterDef.displayName}`, round: 1 },
  ];
  if (hadBlessing) {
    log.push({ kind: "initiative", text: `[T1] The party was prepared — heroes enter Blessed.`, round: 1 });
  }
  log.push({ kind: "turn_start", text: `[T1] ${firstUnit.displayName}'s turn begins.`, round: 1 });

  // Item hook: combat-start triggers (e.g. Hearthstone Charm grants Guarded).
  const preState = { round: 1, log, units } as CombatState;
  for (const unit of units) {
    if (unit.team === "hero" && unit.hp > 0) {
      resolveOncePerCombatBonus(unit, "combatStart", preState);
    }
  }

  return {
    round: 1,
    activeIndex: 0,
    turnQueue,
    units,
    log,
    status: "active",
    gridKeys,
    targetingActionId: null,
    perEncounterUses: {},
    traitState: { actionRotationIndex: {}, triggered: {} },
    bossTelegraph: null,
    encounterId,
    sourceNodeType,
    theme,
    difficulty: run.difficulty,
    modifierDamageBonus: modifierDamageBonus > 0 ? modifierDamageBonus : undefined,
    terrain,
  };
}

export function syncPartyFromCombat(combat: CombatState, run: RunState): void {
  for (const pm of run.party) {
    const unit = combat.units.find((u) => u.instanceId === pm.instanceId);
    if (!unit) {
      // deadForRun heroes were skipped when building the combat — preserve their pm state.
      continue;
    }
    pm.maxHp = unit.stats.maxHp;
    pm.xp = unit.xp;
    pm.level = unit.level;
    pm.bonusStats = { ...(unit.bonusStats ?? {}) };
    pm.equippedItemIds = { ...unit.equippedItemIds };
    if (unit.spellSlotsRemaining !== undefined) pm.spellSlotsRemaining = unit.spellSlotsRemaining;

    if (unit.heroLifeState === "dead") {
      pm.deadForRun = true;
      pm.hp = 0;
    } else {
      pm.deadForRun = false;
      // Downed/stable survivors after victory return to next combat at 1 HP minimum.
      pm.hp = Math.max(1, Math.min(unit.hp, unit.stats.maxHp));
    }

    syncHitDiceForPartyMember(pm);
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
    meta: createDefaultMetaProgression(),
    pendingLevelUps: [],
    levelUpReturnScreen: "map",
  };
}

export function resetGameState(seed?: number): void {
  const actualSeed = seed ?? Date.now();
  gameState.screen = "main_menu";
  gameState.rng = createRng(actualSeed);
  gameState.rngSeed = actualSeed;
  gameState.combat = null;
  gameState.run = null;
  gameState.inventory = createInventory();
  gameState.meta = createDefaultMetaProgression();
  gameState.pendingLevelUps = [];
  gameState.levelUpReturnScreen = "map";
  resetRewardScreenState();
  resetCampScreenState();
  resetShopScreenState();
  resetLevelUpScreenState();
  resetInventoryScreenState();
  resetEventScreenState();
  resetRecruitScreenState();
}

/**
 * Reseed the global RNG from a run seed, making all subsequent draws deterministic.
 * Call this once when a new run starts, before any run-derived RNG consumption.
 */
export function reseedRngFromRun(seed: number): void {
  gameState.rng = createRng(seed);
  gameState.rngSeed = seed;
}

/**
 * Apply adventure modifier combat effects: scale enemy HP and add damage bonuses.
 * Stacks with difficulty config — called from createCombatFromRun.
 */
export function applyModifierCombatEffects(
  modifiers: RunModifier[],
  baseMaxHp: number,
  isElite: boolean,
): { maxHp: number; damageBonus: number } {
  let hpMult = 1.0;
  let damageBonus = 0;
  for (const mod of modifiers) {
    if (mod.kind === "enemy_hp_multiplier") {
      hpMult *= mod.value;
    }
    if (mod.kind === "enemy_damage_bonus") {
      damageBonus += mod.value;
    }
  }
  return {
    maxHp: Math.ceil(baseMaxHp * hpMult),
    damageBonus,
  };
}

export const gameState: GameState = createGameState();

/**
 * Transition to `intendedScreen`, but first divert through the level-up choice screen if any
 * level-ups are queued (F29 / #60). The level-up screen returns to `intendedScreen` once the
 * queue drains. Sites that grant run-time XP call this instead of setting `screen` directly.
 */
export function routeAfterXp(intendedScreen: ScreenId): void {
  if (gameState.pendingLevelUps.length > 0) {
    gameState.levelUpReturnScreen = intendedScreen;
    gameState.screen = "levelup";
  } else {
    gameState.screen = intendedScreen;
  }
}
