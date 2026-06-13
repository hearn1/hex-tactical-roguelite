import type { EncounterDef } from "../data/encounters.ts";
import type { RunModifier } from "../state/types.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import { REWARD_REGISTRY } from "../data/rewards.ts";
import { CLASS_LOOT_HOOK_REGISTRY } from "../data/classLoot.ts";
import { roll } from "../core/dice.ts";
import { DIFFICULTY_CONFIG } from "../data/difficulty.ts";

export type RewardCard =
  | { kind: "item"; itemId: string; matchedClassIds?: string[] }
  | { kind: "potion"; potionId: string }
  | { kind: "gold"; amount: number };

export interface RewardGenerationContext {
  partyClassIds: string[];
  ownedItemIds: string[];
  equippedItemIds: string[];
  rewardPoolId?: string;
  nodeType?: string;
}

export interface CombatReward {
  xpPerHero: number;
  gold: number;
  campSupplies: number;
  cards: RewardCard[];
}

const COMMON_ITEM_POOL: string[] = [
  "item.iron_sword",
  "item.wooden_shield",
  "item.padded_armor",
  "item.apprentice_wand",
  "item.soldier_badge",
  "item.hearthstone_charm",
];

const UNCOMMON_ITEM_POOL: string[] = [
  "item.ember_staff",
  "item.bloodstone",
  "item.owl_feather",
  "item.runed_robe",
  "item.runemark_blade",
  "item.emberglass_wand",
  "item.ward_stitched_vest",
  "item.moonwell_robe",
  "item.quickstep_buckle",
  "item.lantern_moth_pin",
];

const POTION_WEIGHTS: { id: string; weight: number }[] = [
  { id: "potion.healing", weight: 45 },
  { id: "potion.focus", weight: 25 },
  { id: "potion.fire_flask", weight: 20 },
  { id: "potion.bottled_dawn", weight: 10 },
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

interface WeightedCandidate {
  id: string;
  weight: number;
  matchedClassIds: string[];
}

function buildClassWeightedPool(
  pool: string[],
  ownedIds: string[],
  context: RewardGenerationContext,
): WeightedCandidate[] {
  const poolSet = new Set(pool);
  const ownedSet = new Set(ownedIds);
  const weights = new Map<string, number>();
  const matched = new Map<string, Set<string>>();

  for (const id of pool) {
    weights.set(id, 1);
    matched.set(id, new Set());
  }

  for (const classId of context.partyClassIds) {
    for (const entry of CLASS_LOOT_HOOK_REGISTRY[classId] ?? []) {
      if (ownedSet.has(entry.itemId) || !ITEM_REGISTRY[entry.itemId]) continue;
      if (poolSet.has(entry.itemId)) {
        weights.set(entry.itemId, (weights.get(entry.itemId) ?? 1) + entry.weight);
        matched.get(entry.itemId)!.add(classId);
      } else {
        // Off-pool: 10% weight contribution so class items can occasionally surface
        const offPoolWeight = Math.max(1, Math.floor(entry.weight * 0.1));
        weights.set(entry.itemId, (weights.get(entry.itemId) ?? 0) + offPoolWeight);
        if (!matched.has(entry.itemId)) matched.set(entry.itemId, new Set());
        matched.get(entry.itemId)!.add(classId);
      }
    }
  }

  return [...weights.entries()]
    .filter(([id]) => !ownedSet.has(id))
    .map(([id, weight]) => ({ id, weight, matchedClassIds: [...matched.get(id)!] }));
}

function pickClassWeighted(
  pool: string[],
  ownedIds: string[],
  context: RewardGenerationContext | undefined,
  rng: () => number,
): { itemId: string; matchedClassIds: string[] } {
  if (!context || context.partyClassIds.length === 0) {
    const available = excludingOwned(pool, ownedIds);
    const itemPool = available.length > 0 ? available : pool;
    return { itemId: itemPool[Math.floor(rng() * itemPool.length)], matchedClassIds: [] };
  }

  const candidates = buildClassWeightedPool(pool, ownedIds, context);
  if (candidates.length === 0) {
    // All items owned: fall back to unfiltered pool
    const fallback = pool[Math.floor(rng() * pool.length)];
    return { itemId: fallback, matchedClassIds: [] };
  }

  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let r = rng() * total;
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) return { itemId: c.id, matchedClassIds: c.matchedClassIds };
  }
  const last = candidates[candidates.length - 1];
  return { itemId: last.id, matchedClassIds: last.matchedClassIds };
}

export function generateReward(
  encounter: EncounterDef,
  rng: () => number,
  context?: RewardGenerationContext,
): CombatReward {
  const numEnemies = encounter.enemyGroups.reduce((sum, g) => sum + g.count, 0);

  const xpPerHero = 5 * numEnemies;
  const goldFormula = getGoldFormulaForEncounter(encounter);
  const goldRoll = roll(goldFormula, rng);
  const gold = goldRoll.total + 3 * numEnemies;

  const ownedIds = context ? [...context.ownedItemIds, ...context.equippedItemIds] : [];
  const pool = getPoolForEncounter(encounter);
  const { itemId, matchedClassIds } = pickClassWeighted(pool, ownedIds, context, rng);

  const potionId = pickWeighted(POTION_WEIGHTS, rng);

  const goldAmount = 5 + roll("1d4", rng).total;

  const cards: RewardCard[] = [
    { kind: "item", itemId, matchedClassIds: matchedClassIds.length > 0 ? matchedClassIds : undefined },
    { kind: "potion", potionId },
    { kind: "gold", amount: goldAmount },
  ];

  const extraChance = getExtraItemChance(encounter);
  if (extraChance > 0 && rng() < extraChance) {
    const { itemId: extraId, matchedClassIds: extraMatched } = pickClassWeighted(UNCOMMON_ITEM_POOL, ownedIds, context, rng);
    cards.push({ kind: "item", itemId: extraId, matchedClassIds: extraMatched.length > 0 ? extraMatched : undefined });
  }

  const campSupplies = 1 + Math.floor(rng() * 2);

  return { xpPerHero, gold, campSupplies, cards };
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

export function applyXpModifiers(xp: number, modifiers: RunModifier[]): number {
  let result = xp;
  for (const mod of modifiers) {
    if (mod.kind === "reward_xp_multiplier") {
      result = Math.floor(result * mod.value);
    }
  }
  return result;
}

export function applyEliteRewardMultiplier(value: number, modifiers: RunModifier[]): number {
  let result = value;
  for (const mod of modifiers) {
    if (mod.kind === "elite_reward_multiplier") {
      result = Math.floor(result * mod.value);
    }
  }
  return result;
}

export function applyDifficultyToReward(gold: number, difficulty: string): number {
  const config = DIFFICULTY_CONFIG[difficulty as keyof typeof DIFFICULTY_CONFIG] ?? DIFFICULTY_CONFIG.normal;
  return Math.floor(gold * config.rewardGoldMultiplier);
}

export function applyDifficultyToXp(xp: number, difficulty: string): number {
  const config = DIFFICULTY_CONFIG[difficulty as keyof typeof DIFFICULTY_CONFIG] ?? DIFFICULTY_CONFIG.normal;
  return Math.floor(xp * config.rewardXpMultiplier);
}

