import { describe, it, expect } from "vitest";
import { rollShopInventory, buyShopItem, buyShopPotion, useHealService, stashShopItem, equipShopItem, applyShopService, getShopItemPrice, getShopPotionPrice } from "./Shop.ts";
import { applyShopDiscount } from "./ShopPricing.ts";
import { createRng } from "../core/rng.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";
import { createInventory } from "./Inventory.ts";
import { HEAL_SERVICE_ID, REMOVE_DRAWBACK_SERVICE_ID, BUY_RUMOR_SERVICE_ID, BUY_CAMP_SUPPLY_SERVICE_ID } from "../data/shopServices.ts";

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

function makeRun(overrides?: Partial<RunState>): RunState {
  return {
    seed: 42,
    gold: 50,
    party: makeParty(),
    inventory: createInventory(),
    mapState: {
      currentNodeId: "node.shop_1",
      visitedNodeIds: [],
      nodesCleared: 0,
      elitesDefeated: 0,
      bossDefeated: false,
    },
    runStatus: "active",
    shopStates: {},
    campStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
    ...overrides,
  };
}

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
    const validIds = ["item.iron_sword", "item.wooden_shield", "item.apprentice_wand", "item.hunter_bow", "item.padded_armor", "item.soldier_badge", "item.ember_staff", "item.bloodstone", "item.owl_feather", "item.hearthstone_charm", "item.runemark_blade", "item.emberglass_wand", "item.ward_stitched_vest", "item.moonwell_robe", "item.quickstep_buckle", "item.lantern_moth_pin"];
    for (const entry of shop.items) {
      expect(validIds).toContain(entry.itemId);
    }
  });

  it("potions are from the valid pool", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    const validPotions = ["potion.healing", "potion.focus", "potion.fire_flask", "potion.bottled_dawn"];
    for (const entry of shop.potions) {
      expect(validPotions).toContain(entry.potionId);
    }
  });

  it("servicesUsed starts empty", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    expect(shop.servicesUsed).toEqual({});
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

describe("shop pricing", () => {
  it("applies shop_discount modifiers to item and potion prices", () => {
    const modifiers = [{ kind: "shop_discount" as const, value: 0.1 }];

    expect(getShopItemPrice("item.iron_sword", modifiers)).toBe(7);
    expect(getShopPotionPrice("potion.healing", modifiers)).toBe(5);
  });

  it("stacks multiple shop discounts multiplicatively and floors to whole gold", () => {
    expect(applyShopDiscount(100, [
      { kind: "shop_discount", value: 0.1 },
      { kind: "shop_discount", value: 0.2 },
    ])).toBe(72);
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

describe("shop item resolution", () => {
  it("stashes a purchased item", () => {
    const inventory = createInventory();

    stashShopItem(inventory, "item.hunter_bow");

    expect(inventory.items).toEqual(["item.hunter_bow"]);
  });

  it("equips a purchased item to the item's slot", () => {
    const inventory = createInventory();
    const [guardian] = makeParty();
    guardian.equippedItemIds.weapon = null;

    const result = equipShopItem(guardian, "item.hunter_bow", inventory);

    expect(result.ok).toBe(true);
    expect(result.replacedItemId).toBeNull();
    expect(guardian.equippedItemIds.weapon).toBe("item.hunter_bow");
    expect(inventory.items).toEqual([]);
  });

  it("stashes the replaced item when equipping into an occupied slot", () => {
    const inventory = createInventory();
    const [guardian] = makeParty();

    const result = equipShopItem(guardian, "item.hunter_bow", inventory);

    expect(result.ok).toBe(true);
    expect(result.replacedItemId).toBe("item.iron_sword");
    expect(guardian.equippedItemIds.weapon).toBe("item.hunter_bow");
    expect(inventory.items).toEqual(["item.iron_sword"]);
  });

  it("blocks an attuned item when the hero is already at the attunement limit", () => {
    const inventory = createInventory();
    const [guardian] = makeParty();
    guardian.equippedItemIds.weapon = "item.runemark_blade";
    guardian.equippedItemIds.armor = "item.ward_stitched_vest";

    const result = equipShopItem(guardian, "item.quickstep_buckle", inventory);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("2/2");
    expect(guardian.equippedItemIds.trinket).toBeNull();
    expect(inventory.items).toEqual([]);
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

  it("marks service used after use", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    const party = makeParty();
    useHealService(shop, party);
    expect(shop.servicesUsed[HEAL_SERVICE_ID]).toBe(true);
  });

  it("returns false if already used", () => {
    const rng = createRng(42);
    const shop = rollShopInventory(rng);
    shop.servicesUsed[HEAL_SERVICE_ID] = true;
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

describe("applyShopService — heal party", () => {
  it("heals each living hero and deducts gold", () => {
    const shop = rollShopInventory(createRng(42));
    const run = makeRun({ gold: 50 });
    run.party[0].hp = 5;
    run.party[1].hp = 12;

    const msg = applyShopService(HEAL_SERVICE_ID, run, shop);

    expect(msg).toBe("Party healed for 8 HP each!");
    expect(shop.servicesUsed[HEAL_SERVICE_ID]).toBe(true);
    expect(run.gold).toBe(35);
    expect(run.party[0].hp).toBe(13);
    expect(run.party[1].hp).toBe(14);
  });

  it("uses discounted service prices", () => {
    const shop = rollShopInventory(createRng(42));
    const run = makeRun({
      gold: 50,
      runModifiers: [{ kind: "shop_discount", value: 0.1 }],
    });

    applyShopService(HEAL_SERVICE_ID, run, shop);

    expect(run.gold).toBe(37);
  });

  it("deducts gold exactly once", () => {
    const shop = rollShopInventory(createRng(42));
    const run = makeRun({ gold: 50 });

    applyShopService(HEAL_SERVICE_ID, run, shop);
    applyShopService(HEAL_SERVICE_ID, run, shop);

    expect(run.gold).toBe(35);
  });

  it("heals party up to maxHp cap", () => {
    const shop = rollShopInventory(createRng(42));
    const run = makeRun({ gold: 50 });
    run.party[0].hp = 17;
    run.party[1].hp = 13;

    applyShopService(HEAL_SERVICE_ID, run, shop);

    expect(run.party[0].hp).toBe(18);
    expect(run.party[1].hp).toBe(14);
  });
});

describe("applyShopService — remove drawback", () => {
  it("applies when a drawback exists and removes it", () => {
    const shop = rollShopInventory(createRng(42));
    const run = makeRun({
      gold: 50,
      runModifiers: [{ kind: "gold_multiplier", value: 0.5 }],
    });

    const msg = applyShopService(REMOVE_DRAWBACK_SERVICE_ID, run, shop);

    expect(msg).toContain("Removed drawback");
    expect(shop.servicesUsed[REMOVE_DRAWBACK_SERVICE_ID]).toBe(true);
    expect(run.runModifiers).toHaveLength(0);
    expect(run.gold).toBe(40);
  });

  it("reports no drawbacks when none exist", () => {
    const shop = rollShopInventory(createRng(42));
    const run = makeRun({ gold: 50 });

    const msg = applyShopService(REMOVE_DRAWBACK_SERVICE_ID, run, shop);

    expect(msg).toBe("No drawbacks to remove.");
    expect(shop.servicesUsed[REMOVE_DRAWBACK_SERVICE_ID]).toBe(true);
    expect(run.gold).toBe(40);
  });
});

describe("applyShopService — buy rumor", () => {
  it("reveals an upcoming node's type and title", () => {
    const shop = rollShopInventory(createRng(42));
    const run = makeRun({
      gold: 50,
      mapState: {
        currentNodeId: "node.shop_1",
        visitedNodeIds: [],
        nodesCleared: 0,
        elitesDefeated: 0,
        bossDefeated: false,
      },
    });

    const msg = applyShopService(BUY_RUMOR_SERVICE_ID, run, shop);

    expect(msg).toContain("Rumor reveals");
    expect(shop.servicesUsed[BUY_RUMOR_SERVICE_ID]).toBe(true);
    expect(run.gold).toBe(42);
    expect(run.revealedForecasts).toBeDefined();
    const forecastedKey = Object.keys(run.revealedForecasts!)[0];
    expect(forecastedKey).toBeTruthy();
  });

  it("reports no nodes when current node has no next nodes", () => {
    const shop = rollShopInventory(createRng(42));
    const run = makeRun({
      gold: 50,
      mapState: {
        currentNodeId: "node.boss",
        visitedNodeIds: [],
        nodesCleared: 0,
        elitesDefeated: 0,
        bossDefeated: false,
      },
    });

    const msg = applyShopService(BUY_RUMOR_SERVICE_ID, run, shop);

    expect(msg).toBe("No upcoming nodes to reveal.");
    expect(shop.servicesUsed[BUY_RUMOR_SERVICE_ID]).toBe(true);
    expect(run.gold).toBe(42);
  });
});

describe("applyShopService — camp supply", () => {
  it("buys one Camp Supply and deducts gold", () => {
    const shop = rollShopInventory(createRng(42));
    const run = makeRun({ gold: 50, campSupplies: 1 });

    const msg = applyShopService(BUY_CAMP_SUPPLY_SERVICE_ID, run, shop);

    expect(msg).toBe("Bought 1 Camp Supply.");
    expect(shop.servicesUsed[BUY_CAMP_SUPPLY_SERVICE_ID]).toBe(true);
    expect(run.gold).toBe(42);
    expect(run.campSupplies).toBe(2);
  });
});
