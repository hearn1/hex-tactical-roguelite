import type { EncounterDef } from "../data/encounters.ts";
import type { RunModifier } from "../state/types.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import { REWARD_REGISTRY } from "../data/rewards.ts";
import { roll } from "../core/dice.ts";

export type RewardCard =
  | { kind: "item"; itemId: string }
  | { kind: "potion"; potionId: string }
  | { kind: "gold"; amount: number };

export interface CombatReward {
  xpPerHero: number;
  gold: number;
  cards: RewardCard[];
}

const COMMON_ITEM_POOL: string[] = [
  "item.iron_sword",
  "item.wooden_shield",
  "item.padded_armor",
  "item.apprentice_wand",
  "item.soldier_badge",
];

const UNCOMMON_ITEM_POOL: string[] = [
  "item.ember_staff",
  "item.bloodstone",
  "item.owl_feather",
  "item.runed_robe",
];

const POTION_WEIGHTS: { id: string; weight: number }[] = [
  { id: "potion.healing", weight: 50 },
  { id: "potion.focus", weight: 30 },
  { id: "potion.fire_flask", weight: 20 },
];

function pickWeighted(options: { id: string; weight: number }[], rng: () => number): string {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let rollVal = rng() * total;
  for (const opt of options) {
    rollVal -= opt.weight;
    if (rollVal <= 0) return opt.id;
  }
  return options[options.length - 1].id;
}

function excludingOwned(pool: string[], ownedItemIds: string[]): string[] {
  const owned = new Set(ownedItemIds);
  return pool.filter((id) => !owned.has(id));
}

function getPoolForEncounter(encounter: EncounterDef): string[] {
  if (encounter.rewardPoolId) {
    const poolDef = REWARD_REGISTRY[encounter.rewardPoolId];
    if (poolDef) return poolDef.itemIds;
  }
  return COMMON_ITEM_POOL;
}

function getGoldFormulaForEncounter(encounter: EncounterDef): string {
  if (encounter.rewardPoolId) {
    const poolDef = REWARD_REGISTRY[encounter.rewardPoolId];
    if (poolDef) return poolDef.goldFormula;
  }
  return "2d6";
}

function getExtraItemChance(encounter: EncounterDef): number {
  if (encounter.rewardPoolId) {
    const poolDef = REWARD_REGISTRY[encounter.rewardPoolId];
    if (poolDef && poolDef.extraItemChance) return poolDef.extraItemChance;
  }
  return 0;
}

export function generateReward(encounter: EncounterDef, rng: () => number): CombatReward {
  const numEnemies = encounter.enemyGroups.reduce((sum, g) => sum + g.count, 0);

  const xpPerHero = 5 * numEnemies;
  const goldFormula = getGoldFormulaForEncounter(encounter);
  const goldRoll = roll(goldFormula, rng);
  const gold = goldRoll.total + 3 * numEnemies;

  const pool = getPoolForEncounter(encounter);
  const available = excludingOwned(pool, []);
  const itemPool = available.length > 0 ? available : pool;
  const itemId = itemPool[Math.floor(rng() * itemPool.length)];

  const potionId = pickWeighted(POTION_WEIGHTS, rng);

  const goldAmount = 5 + roll("1d4", rng).total;

  const cards: RewardCard[] = [
    { kind: "item", itemId },
    { kind: "potion", potionId },
    { kind: "gold", amount: goldAmount },
  ];

  const extraChance = getExtraItemChance(encounter);
  if (extraChance > 0 && rng() < extraChance) {
    const extraPool = excludingOwned(UNCOMMON_ITEM_POOL, []);
    if (extraPool.length > 0) {
      const extraId = extraPool[Math.floor(rng() * extraPool.length)];
      cards.push({ kind: "item", itemId: extraId });
    }
  }

  return { xpPerHero, gold, cards };
}

export function applyGoldModifiers(gold: number, modifiers: RunModifier[]): number {
  let result = gold;
  for (const mod of modifiers) {
    if (mod.kind === "gold_multiplier") {
      result = Math.floor(result * mod.value);
    }
  }
  return result;
}

export function applyDifficultyToReward(gold: number, difficulty: string): number {
  const mult = difficulty === "hard" ? 0.75 : 1.0;
  return Math.floor(gold * mult);
}

export function generateRewardWithInventory(
  encounter: EncounterDef,
  rng: () => number,
  ownedItemIds: string[],
): CombatReward {
  const numEnemies = encounter.enemyGroups.reduce((sum, g) => sum + g.count, 0);

  const xpPerHero = 5 * numEnemies;
  const goldRoll = roll("2d6", rng);
  const gold = goldRoll.total + 3 * numEnemies;

  const available = excludingOwned(COMMON_ITEM_POOL, ownedItemIds);
  const itemPool = available.length > 0 ? available : COMMON_ITEM_POOL;
  const itemId = itemPool[Math.floor(rng() * itemPool.length)];

  const potionId = pickWeighted(POTION_WEIGHTS, rng);

  const goldAmount = 5 + roll("1d4", rng).total;

  const cards: RewardCard[] = [
    { kind: "item", itemId },
    { kind: "potion", potionId },
    { kind: "gold", amount: goldAmount },
  ];

  return { xpPerHero, gold, cards };
}
