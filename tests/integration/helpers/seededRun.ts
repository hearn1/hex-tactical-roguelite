import { gameState, resetGameState } from "../../../src/state/GameState.ts";
import type { RunState, PartyMember } from "../../../src/state/RunState.ts";
import { createInventory } from "../../../src/run/Inventory.ts";
import { CLASS_REGISTRY } from "../../../src/data/classes.ts";

function createDefaultParty(): PartyMember[] {
  const classIds = ["class.guardian", "class.acolyte", "class.arcanist"];
  return classIds.map((classId, i) => {
    const def = CLASS_REGISTRY[classId];
    return {
      instanceId: `hero_00${i + 1}`,
      classId,
      displayName: def?.displayName ?? `Hero ${i + 1}`,
      level: 1,
      xp: 0,
      hp: def?.baseStats.maxHp ?? 20,
      maxHp: def?.baseStats.maxHp ?? 20,
      bonusStats: {},
      equippedItemIds: { weapon: null, armor: null, trinket: null },
    };
  });
}

export function setupDefaultRun(seed: number = 12345): void {
  resetGameState(seed);
  gameState.run = {
    seed: gameState.rngSeed,
    gold: 30,
    party: createDefaultParty(),
    inventory: createInventory(),
    mapState: {
      currentNodeId: "node.start",
      visitedNodeIds: ["node.start"],
      nodesCleared: 0,
      elitesDefeated: 0,
      bossDefeated: false,
    },
    runStatus: "active",
    shopStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
}

export function setupLowHealthRun(seed: number = 98765): void {
  resetGameState(seed);
  const party = createDefaultParty();
  for (const pm of party) {
    pm.hp = 1;
  }
  gameState.run = {
    seed: gameState.rngSeed,
    gold: 30,
    party,
    inventory: createInventory(),
    mapState: {
      currentNodeId: "node.start",
      visitedNodeIds: ["node.start"],
      nodesCleared: 0,
      elitesDefeated: 0,
      bossDefeated: false,
    },
    runStatus: "active",
    shopStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
  gameState.screen = "map";
}

export function setupWonRun(seed: number = 12345): void {
  resetGameState(seed);
  gameState.run = {
    seed: gameState.rngSeed,
    gold: 100,
    party: createDefaultParty(),
    inventory: createInventory(),
    mapState: {
      currentNodeId: "node.boss",
      visitedNodeIds: ["node.start", "node.combat_a", "node.shop_1", "node.camp_1", "node.combat_d", "node.boss"],
      nodesCleared: 4,
      elitesDefeated: 0,
      bossDefeated: true,
    },
    runStatus: "won",
    shopStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
}

export function setupLostRun(seed: number = 12345): void {
  resetGameState(seed);
  const party = createDefaultParty();
  for (const pm of party) {
    pm.hp = 0;
  }
  gameState.run = {
    seed: gameState.rngSeed,
    gold: 50,
    party,
    inventory: createInventory(),
    mapState: {
      currentNodeId: "node.combat_c",
      visitedNodeIds: ["node.start", "node.combat_a", "node.combat_c"],
      nodesCleared: 1,
      elitesDefeated: 0,
      bossDefeated: false,
    },
    runStatus: "lost",
    shopStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
}

export function setupActiveRun(seed: number = 12345): void {
  resetGameState(seed);
  gameState.run = {
    seed: gameState.rngSeed,
    gold: 30,
    party: createDefaultParty(),
    inventory: createInventory(),
    mapState: {
      currentNodeId: "node.start",
      visitedNodeIds: ["node.start"],
      nodesCleared: 0,
      elitesDefeated: 0,
      bossDefeated: false,
    },
    runStatus: "active",
    shopStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
  gameState.screen = "map";
}
