import type { ShopInventory } from "../state/types.ts";
import type { PartyMember } from "../state/RunState.ts";
import type { InventoryState } from "./Inventory.ts";
import { ITEM_REGISTRY } from "../data/items.ts";

export const ITEM_PRICE: Record<string, number> = {
  common: 8,
  uncommon: 18,
  rare: 35,
};

export const POTION_PRICE: Record<string, number> = {
  "potion.healing": 6,
  "potion.focus": 8,
  "potion.fire_flask": 10,
};

export const HEAL_SERVICE_PRICE = 15;
export const HEAL_AMOUNT = 8;

const COMMON_ITEMS = [
  "item.iron_sword", "item.wooden_shield", "item.apprentice_wand",
  "item.hunter_bow", "item.padded_armor", "item.soldier_badge",
];

const UNCOMMON_ITEMS = ["item.ember_staff", "item.bloodstone", "item.owl_feather"];

const POTION_POOL = ["potion.healing", "potion.focus", "potion.fire_flask"];

function filterExisting(pool: string[], registry: Record<string, unknown>): string[] {
  return pool.filter((id) => registry[id] !== undefined);
}

export function rollShopInventory(rng: () => number): ShopInventory {
  const common = filterExisting(COMMON_ITEMS, ITEM_REGISTRY);
  const uncommon = filterExisting(UNCOMMON_ITEMS, ITEM_REGISTRY);

  const items: { itemId: string; sold: boolean }[] = [];

  const availCommon = [...common];
  for (let i = 0; i < 2; i++) {
    if (availCommon.length === 0) {
      const fallback = filterExisting([...COMMON_ITEMS, ...UNCOMMON_ITEMS], ITEM_REGISTRY);
      if (fallback.length > 0) {
        items.push({ itemId: fallback[Math.floor(rng() * fallback.length)], sold: false });
      }
      break;
    }
    const idx = Math.floor(rng() * availCommon.length);
    items.push({ itemId: availCommon[idx], sold: false });
    availCommon.splice(idx, 1);
  }

  if (uncommon.length > 0) {
    const idx = Math.floor(rng() * uncommon.length);
    items.push({ itemId: uncommon[idx], sold: false });
  } else if (common.length > 0) {
    const idx = Math.floor(rng() * common.length);
    items.push({ itemId: common[idx], sold: false });
  }

  const potions: { potionId: string; sold: boolean }[] = [];
  for (let i = 0; i < 2; i++) {
    const idx = Math.floor(rng() * POTION_POOL.length);
    potions.push({ potionId: POTION_POOL[idx], sold: false });
  }

  return { items, potions, healServiceUsed: false };
}

export function buyShopItem(inventory: ShopInventory, itemIndex: number): boolean {
  const entry = inventory.items[itemIndex];
  if (!entry || entry.sold) return false;
  entry.sold = true;
  return true;
}

export function stashShopItem(inventory: InventoryState, itemId: string): void {
  inventory.items.push(itemId);
}

export function equipShopItem(partyMember: PartyMember, itemId: string, inventory: InventoryState): string | null {
  const itemDef = ITEM_REGISTRY[itemId];
  if (!itemDef) return null;

  const slot = itemDef.slot;
  const replacedItemId = partyMember.equippedItemIds[slot];
  partyMember.equippedItemIds[slot] = itemId;

  if (replacedItemId) {
    inventory.items.push(replacedItemId);
  }

  return replacedItemId;
}

export function buyShopPotion(inventory: ShopInventory, potionIndex: number): boolean {
  const entry = inventory.potions[potionIndex];
  if (!entry || entry.sold) return false;
  entry.sold = true;
  return true;
}

export function useHealService(inventory: ShopInventory, party: PartyMember[]): boolean {
  if (inventory.healServiceUsed) return false;
  inventory.healServiceUsed = true;
  for (const pm of party) {
    if (pm.hp > 0) {
      pm.hp = Math.min(pm.maxHp, pm.hp + HEAL_AMOUNT);
    }
  }
  return true;
}
