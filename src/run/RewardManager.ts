import type { EncounterDef } from "../data/encounters.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
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

export function generateReward(encounter: EncounterDef, rng: () => number): CombatReward {
  const numEnemies = encounter.enemyGroups.reduce((sum, g) => sum + g.count, 0);

  const xpPerHero = 5 * numEnemies;
  const goldRoll = roll("2d6", rng);
  const gold = goldRoll.total + 3 * numEnemies;

  const available = excludingOwned(COMMON_ITEM_POOL, []);
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
