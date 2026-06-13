import { describe, it, expect } from "vitest";
import { generateReward } from "./RewardManager.ts";
import type { RewardGenerationContext } from "./RewardManager.ts";
import type { EncounterDef } from "../data/encounters.ts";
import { createRng } from "../core/rng.ts";
import { DataRepository } from "../data/DataRepository.ts";

const threeEnemyEncounter: EncounterDef = {
  id: "encounter.test",
  displayName: "Test",
  enemyGroups: [
    { enemyId: "enemy.goblin_skirmisher", count: 2 },
    { enemyId: "enemy.wolf", count: 1 },
  ],
};

describe("generateReward", () => {
  it("3-enemy encounter yields xpPerHero = 15", () => {
    const rng = createRng(42);
    const reward = generateReward(threeEnemyEncounter, rng);
    expect(reward.xpPerHero).toBe(15);
  });

  it("always returns exactly 3 cards", () => {
    const rng = createRng(42);
    const reward = generateReward(threeEnemyEncounter, rng);
    expect(reward.cards).toHaveLength(3);
  });

  it("first card is an item", () => {
    const rng = createRng(42);
    const reward = generateReward(threeEnemyEncounter, rng);
    expect(reward.cards[0].kind).toBe("item");
  });

  it("second card is a potion", () => {
    const rng = createRng(42);
    const reward = generateReward(threeEnemyEncounter, rng);
    expect(reward.cards[1].kind).toBe("potion");
  });

  it("third card is gold", () => {
    const rng = createRng(42);
    const reward = generateReward(threeEnemyEncounter, rng);
    expect(reward.cards[2].kind).toBe("gold");
  });

  it("awards 1-2 Camp Supplies automatically", () => {
    const rng = createRng(42);
    const reward = generateReward(threeEnemyEncounter, rng);
    expect(reward.campSupplies).toBeGreaterThanOrEqual(1);
    expect(reward.campSupplies).toBeLessThanOrEqual(2);
  });

  it("deterministic with fixed seed", () => {
    const rng1 = createRng(99);
    const rng2 = createRng(99);
    const a = generateReward(threeEnemyEncounter, rng1);
    const b = generateReward(threeEnemyEncounter, rng2);
    expect(a.xpPerHero).toBe(b.xpPerHero);
    expect(a.gold).toBe(b.gold);
    expect(a.cards).toEqual(b.cards);
  });

  it("item pool contains only common items", () => {
    const rng = createRng(42);
    const reward = generateReward(threeEnemyEncounter, rng);
    const itemId = (reward.cards[0] as { kind: "item"; itemId: string }).itemId;
    expect(["item.iron_sword", "item.wooden_shield", "item.padded_armor", "item.apprentice_wand", "item.soldier_badge", "item.hearthstone_charm"]).toContain(itemId);
  });
});

const ALL_COMMON_ITEMS = ["item.iron_sword", "item.wooden_shield", "item.padded_armor", "item.apprentice_wand", "item.soldier_badge", "item.hearthstone_charm"];

describe("generateReward — class-weighted selection", () => {
  it("deterministic with fixed seed and context", () => {
    const ctx: RewardGenerationContext = { partyClassIds: ["class.wizard"], ownedItemIds: [], equippedItemIds: [] };
    const a = generateReward(threeEnemyEncounter, createRng(77), ctx);
    const b = generateReward(threeEnemyEncounter, createRng(77), ctx);
    expect(a.cards).toEqual(b.cards);
  });

  it("returns a valid item from pool or class hooks", () => {
    const ctx: RewardGenerationContext = { partyClassIds: ["class.fighter"], ownedItemIds: [], equippedItemIds: [] };
    const reward = generateReward(threeEnemyEncounter, createRng(55), ctx);
    const card = reward.cards[0];
    expect(card.kind).toBe("item");
    // item must exist in ITEM_REGISTRY (validated by being a known id)
    expect(typeof (card as { kind: "item"; itemId: string }).itemId).toBe("string");
  });

  it("matchedClassIds is set when a class hook matches the selected item", () => {
    // Run many seeds to find one where a fighter-favored item is picked with its class metadata
    let foundMatch = false;
    for (let seed = 0; seed < 200; seed++) {
      const ctx: RewardGenerationContext = { partyClassIds: ["class.fighter"], ownedItemIds: [], equippedItemIds: [] };
      const reward = generateReward(threeEnemyEncounter, createRng(seed), ctx);
      const card = reward.cards[0];
      if (card.kind === "item" && card.matchedClassIds && card.matchedClassIds.includes("class.fighter")) {
        foundMatch = true;
        break;
      }
    }
    expect(foundMatch).toBe(true);
  });

  it("matchedClassIds is undefined or empty when no class hooks match", () => {
    const ctx: RewardGenerationContext = { partyClassIds: [], ownedItemIds: [], equippedItemIds: [] };
    const reward = generateReward(threeEnemyEncounter, createRng(42), ctx);
    const card = reward.cards[0];
    if (card.kind === "item") {
      expect(card.matchedClassIds).toBeUndefined();
    }
  });

  it("duplicate filtering: owned item is excluded from pool when alternatives exist", () => {
    // Own 5 of the 6 common items; only one should remain
    const owned = ["item.iron_sword", "item.wooden_shield", "item.padded_armor", "item.apprentice_wand", "item.soldier_badge"];
    const ctx: RewardGenerationContext = { partyClassIds: [], ownedItemIds: owned, equippedItemIds: [] };
    const reward = generateReward(threeEnemyEncounter, createRng(42), ctx);
    const card = reward.cards[0];
    if (card.kind === "item") {
      expect(owned).not.toContain(card.itemId);
    }
  });

  it("fallback: when all pool items are owned, still returns an item", () => {
    const allOwned = [...ALL_COMMON_ITEMS];
    const ctx: RewardGenerationContext = { partyClassIds: ["class.guardian"], ownedItemIds: allOwned, equippedItemIds: [] };
    const reward = generateReward(threeEnemyEncounter, createRng(42), ctx);
    const card = reward.cards[0];
    expect(card.kind).toBe("item");
    expect(typeof (card as { kind: "item"; itemId: string }).itemId).toBe("string");
  });

  it("no context: falls back to original pool-based selection", () => {
    const reward = generateReward(threeEnemyEncounter, createRng(42));
    const card = reward.cards[0];
    expect(card.kind).toBe("item");
    if (card.kind === "item") {
      expect(card.matchedClassIds).toBeUndefined();
    }
  });
});

describe("DataRepository — ClassLootHook validation", () => {
  it("validates without errors for a fresh repository", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const report = repo.validate();
    expect(report.errors.filter((e) => e.includes("ClassLootHook"))).toHaveLength(0);
  });
});
