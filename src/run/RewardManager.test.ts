import { describe, it, expect } from "vitest";
import { generateReward } from "./RewardManager.ts";
import type { EncounterDef } from "../data/encounters.ts";
import { createRng } from "../core/rng.ts";

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
    expect(["item.iron_sword", "item.wooden_shield", "item.padded_armor", "item.apprentice_wand", "item.soldier_badge"]).toContain(itemId);
  });
});
