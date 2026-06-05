import type { CheckStat } from "../state/types.ts";
import { ITEM_REGISTRY } from "./items.ts";
import { POTION_REGISTRY } from "./potions.ts";

/**
 * Backgrounds are composite choices: one small stat bonus, one starter item or potion,
 * and one lightweight perk. Perks intentionally reuse existing run/combat levers.
 */
export type BackgroundStat = CheckStat | "armor";

export type BackgroundPerk =
  | { type: "startCombatGuarded" }
  | { type: "xpMultiplier"; value: number }
  | { type: "revealNodes"; count: number }
  | { type: "bonusGold"; amount: number }
  | { type: "shopDiscount"; value: number };

export interface BackgroundStatBonus {
  stat: BackgroundStat;
  amount: number;
}

export interface BackgroundDef {
  id: string;
  displayName: string;
  /** Short original flavor text shown in setup and hero panels. */
  flavor: string;
  statBonus: BackgroundStatBonus;
  startingItemId?: string;
  startingPotionId?: string;
  startingPotionCount?: number;
  perk: BackgroundPerk;
}

/**
 * Five original backgrounds, evolved into #87's composite shape. Any background can be
 * assigned to any class; they are flavor and utility, not class-locked.
 */
export const BACKGROUND_REGISTRY: Record<string, BackgroundDef> = {
  "background.hedge_scholar": {
    id: "background.hedge_scholar",
    displayName: "Hedge Scholar",
    flavor: "Self-taught from borrowed books and long nights by the candle.",
    statBonus: { stat: "spirit", amount: 1 },
    startingItemId: "item.apprentice_wand",
    perk: { type: "revealNodes", count: 2 },
  },
  "background.caravan_guard": {
    id: "background.caravan_guard",
    displayName: "Caravan Guard",
    flavor: "Years spent shielding wagons taught a steady arm and a hard stare.",
    statBonus: { stat: "might", amount: 1 },
    startingPotionId: "potion.healing",
    startingPotionCount: 1,
    perk: { type: "startCombatGuarded" },
  },
  "background.cutpurse": {
    id: "background.cutpurse",
    displayName: "Cutpurse",
    flavor: "Quick fingers and quicker feet, honed in crowded market lanes.",
    statBonus: { stat: "agility", amount: 1 },
    startingItemId: "item.quickstep_buckle",
    perk: { type: "bonusGold", amount: 10 },
  },
  "background.merchants_heir": {
    id: "background.merchants_heir",
    displayName: "Merchant's Heir",
    flavor: "Left the family ledgers behind, but not the family coin.",
    statBonus: { stat: "armor", amount: 1 },
    startingItemId: "item.lucky_charm",
    perk: { type: "shopDiscount", value: 0.1 },
  },
  "background.field_medic": {
    id: "background.field_medic",
    displayName: "Field Medic",
    flavor: "Patched soldiers on the line and never travels without a remedy.",
    statBonus: { stat: "spirit", amount: 1 },
    startingPotionId: "potion.healing",
    startingPotionCount: 1,
    perk: { type: "xpMultiplier", value: 1.1 },
  },
};

/** Convenience accessor mirroring the other registries' lookup pattern. */
export function getBackground(id: string): BackgroundDef | undefined {
  return BACKGROUND_REGISTRY[id];
}

/** Short human-readable summary of a background's mechanical effect, for setup + hero panels. */
export function describeBackgroundEffect(def: BackgroundDef): string {
  const parts = [
    `Stat: +${def.statBonus.amount} ${statLabel(def.statBonus.stat)}`,
    `Item: ${describeStarter(def)}`,
    `Perk: ${describeBackgroundPerk(def.perk)}`,
  ];
  return parts.join(" | ");
}

export function describeBackgroundPerk(perk: BackgroundPerk): string {
  switch (perk.type) {
    case "startCombatGuarded":
      return "Start each combat Guarded";
    case "xpMultiplier":
      return `+${Math.round((perk.value - 1) * 100)}% XP gains`;
    case "revealNodes":
      return `Reveal ${perk.count} upcoming nodes`;
    case "bonusGold":
      return `+${perk.amount} starting gold`;
    case "shopDiscount":
      return `${Math.round(perk.value * 100)}% shop discount`;
  }
}

function describeStarter(def: BackgroundDef): string {
  if (def.startingItemId) {
    return ITEM_REGISTRY[def.startingItemId]?.displayName ?? def.startingItemId;
  }
  if (def.startingPotionId) {
    const count = def.startingPotionCount ?? 1;
    const name = POTION_REGISTRY[def.startingPotionId]?.displayName ?? def.startingPotionId;
    return `${count}x ${name}`;
  }
  return "None";
}

function statLabel(stat: BackgroundStat): string {
  return stat.charAt(0).toUpperCase() + stat.slice(1);
}
