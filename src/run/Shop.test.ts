import { describe, it, expect } from "vitest";
import { rollShopInventory, buyShopItem, buyShopPotion, useHealService, ITEM_PRICE, POTION_PRICE, HEAL_SERVICE_PRICE } from "./Shop.ts";
import { createRng } from "../core/rng.ts";
import type { PartyMember } from "../state/RunState.ts";

const makeParty = (): PartyMember[] => [
  {
    instanceId: "hero_001",
    classId: "class.guardian",
    displayName: "Mara",
    level: 1,
    xp: 0,
    hp: 18,
    maxHp: 18,
    bonusStats: {},
    equippedItemIds: { weapon: "item.iron_sword", armor: null, trinket: null },
  },
  {
    instanceId: "hero_002",
    classId: "class.acolyte",
    displayName: "Sable",
    level: 1,
    xp: 0,
    hp: 14,
    maxHp: 14,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: "item.padded_armor", trinket: null },
  },
];

describe("rollShopInventory", () => {
  it("returns exactly 3 items and 2 potions", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    expect(shop.items).toHaveLength(3);
    expect(shop.potions).toHaveLength(2);
  });

  it("all items have registered defs", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    for (const entry of shop.items) {
      expect(["item.iron_sword", "item.wooden_shield", "item.apprentice_wand", "item.hunter_bow", "item.padded_armor", "item.soldier_badge", "item.ember_staff", "item.bloodstone", "item.owl_feather"]).toContain(entry.itemId);
    }
  });

  it("potions are from the valid pool", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    for (const entry of shop.potions) {
      expect(["potion.healing", "potion.focus", "potion.fire_flask"]).toContain(entry.potionId);
    }
  });

  it("healServiceUsed starts false", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    expect(shop.healServiceUsed).toBe(false);
  });

  it("deterministic with fixed seed", () => {
    const rng1 = createRng(99);
    const rng2 = createRng(99);
    const a = rollShopInventory(rng1);
    const b = rollShopInventory(rng2);
    expect(a.items.map((e) => e.itemId)).toEqual(b.items.map((e) => e.itemId));
    expect(a.potions.map((e) => e.potionId)).toEqual(b.potions.map((e) => e.potionId));
  });
});

describe("buyShopItem", () => {
  it("marks item sold on buy", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    const result = buyShopItem(shop, 0);
    expect(result).toBe(true);
    expect(shop.items[0].sold).toBe(true);
  });

  it("returns false for already sold item", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    shop.items[0].sold = true;
    const result = buyShopItem(shop, 0);
    expect(result).toBe(false);
  });

  it("returns false for out-of-range index", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    const result = buyShopItem(shop, 99);
    expect(result).toBe(false);
  });
});

describe("buyShopPotion", () => {
  it("marks potion sold on buy", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    const result = buyShopPotion(shop, 0);
    expect(result).toBe(true);
    expect(shop.potions[0].sold).toBe(true);
  });
});

describe("useHealService", () => {
  it("heals each living hero by 8 HP, capped at maxHp", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    const party = makeParty();
    party[0].hp = 5;
    party[1].hp = 12;

    const result = useHealService(shop, party);
    expect(result).toBe(true);
    expect(party[0].hp).toBe(13);
    expect(party[1].hp).toBe(14);
  });

  it("marks healServiceUsed after use", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    const party = makeParty();
    useHealService(shop, party);
    expect(shop.healServiceUsed).toBe(true);
  });

  it("returns false if already used", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    shop.healServiceUsed = true;
    const party = makeParty();
    const result = useHealService(shop, party);
    expect(result).toBe(false);
  });

  it("does not heal dead heroes (hp <= 0)", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    const party = makeParty();
    party[0].hp = 0;
    useHealService(shop, party);
    expect(party[0].hp).toBe(0);
  });
});
