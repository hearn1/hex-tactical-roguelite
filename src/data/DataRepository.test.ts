import { describe, it, expect, beforeEach } from "vitest";
import { DataRepository } from "./DataRepository.ts";
import { ENCOUNTER_POOLS } from "./encounters.ts";

describe("DataRepository", () => {
  let repo: DataRepository;

  beforeEach(() => {
    repo = new DataRepository();
    repo.loadAll();
  });

  it("loads all definitions without crashing", () => {
    expect(repo.isLoaded()).toBe(true);
  });

  it("validate() returns valid: true with no errors", () => {
    const report = repo.validate();
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("getClass returns expected def", () => {
    const def = repo.getClass("class.guardian");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Guardian");
    expect(def!.baseStats.maxHp).toBe(18);
  });

  it("getAction returns expected def", () => {
    const def = repo.getAction("action.slash");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Slash");
    expect(def!.effect).toEqual({ type: "damage", formula: "1d6 + might" });
  });

  it("getItem returns expected def", () => {
    const def = repo.getItem("item.iron_sword");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Iron Sword");
    expect(def!.slot).toBe("weapon");
  });

  it("getEnemy returns expected def", () => {
    const def = repo.getEnemy("enemy.goblin_skirmisher");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Goblin Skirmisher");
    expect(def!.baseStats.maxHp).toBe(8);
  });

  it("getEncounter returns expected def", () => {
    const def = repo.getEncounter("encounter.road_ambush");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Road Ambush");
  });

  it("getNode returns expected def", () => {
    const def = repo.getNode("node.start");
    expect(def).toBeDefined();
    expect(def!.type).toBe("start");
  });

  it("getPotion returns expected def", () => {
    const def = repo.getPotion("potion.healing");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Healing Potion");
  });

  it("getUpgrade returns expected def", () => {
    const def = repo.getUpgrade("upgrade.starting_gold");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Coin Purse");
  });

  it("getEvent returns expected def", () => {
    const def = repo.getEvent("event.strange_shrine");
    expect(def).toBeDefined();
    expect(def!.title).toBe("Strange Shrine");
  });

  it("getReward returns expected def", () => {
    const def = repo.getReward("reward.basic");
    expect(def).toBeDefined();
    expect(def!.itemIds.length).toBeGreaterThan(0);
  });

  it("getting non-existent id returns undefined", () => {
    expect(repo.getClass("class.nonexistent")).toBeUndefined();
    expect(repo.getAction("action.nonexistent")).toBeUndefined();
    expect(repo.getItem("item.nonexistent")).toBeUndefined();
    expect(repo.getEnemy("enemy.nonexistent")).toBeUndefined();
  });

  it("getAllEncounters returns all encounters", () => {
    const all = repo.getAllEncounters();
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  it("getAllNodes returns all nodes", () => {
    const all = repo.getAllNodes();
    expect(all.length).toBeGreaterThanOrEqual(10);
  });

  it("getAllUpgrades returns all upgrades", () => {
    const all = repo.getAllUpgrades();
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  it("getAllEvents returns all events", () => {
    const all = repo.getAllEvents();
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it("getBackground returns expected def", () => {
    const def = repo.getBackground("background.caravan_guard");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Caravan Guard");
    expect(def!.statBonus).toEqual({ stat: "might", amount: 1 });
    expect(def!.perk).toEqual({ type: "startCombatGuarded" });
  });

  it("getAllBackgrounds returns all backgrounds", () => {
    const all = repo.getAllBackgrounds();
    expect(all.length).toBe(5);
  });

  it("every class default background resolves", () => {
    for (const cls of [repo.getClass("class.guardian")!, repo.getClass("class.acolyte")!, repo.getClass("class.arcanist")!]) {
      expect(repo.getBackground(cls.defaultBackgroundId)).toBeDefined();
    }
  });
});

describe("DataRepository validation rejects broken references", () => {
  it("detects missing action in class", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const originalActions = [...cls.actionIds];
    cls.actionIds.push("action.nonexistent");
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("action.nonexistent"))).toBe(true);
    cls.actionIds = originalActions;
  });

  it("detects missing item in class startingItems", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const original = [...cls.startingItems];
    cls.startingItems.push("item.nonexistent");
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("item.nonexistent"))).toBe(true);
    cls.startingItems = original;
  });

  it("detects missing enemy in encounter", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const enc = repo.getEncounter("encounter.road_ambush")!;
    const original = [...enc.enemyGroups];
    enc.enemyGroups.push({ enemyId: "enemy.nonexistent", count: 1 });
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("enemy.nonexistent"))).toBe(true);
    enc.enemyGroups = original;
  });

  it("detects an invalid class default background reference", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const original = cls.defaultBackgroundId;
    cls.defaultBackgroundId = "background.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("background.nonexistent"))).toBe(true);
    cls.defaultBackgroundId = original;
  });

  it("detects an unknown potion reference in a background", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const bg = repo.getBackground("background.field_medic")!;
    const original = bg.startingPotionId;
    bg.startingPotionId = "potion.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("potion.nonexistent"))).toBe(true);
    bg.startingPotionId = original;
  });

  it("detects an unknown item reference in a background", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const bg = repo.getBackground("background.cutpurse")!;
    const original = bg.startingItemId;
    bg.startingItemId = "item.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("item.nonexistent"))).toBe(true);
    bg.startingItemId = original;
  });

  it("detects an unknown item referenced by an event effect", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.rogue_trader")!;
    const choice = ev.choices[0];
    const original = [...choice.effects];
    choice.effects.push({ type: "item", itemId: "item.nonexistent" });
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("item.nonexistent"))).toBe(true);
    choice.effects = original;
  });

  it("detects an unknown potion nested inside a check branch", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.crumbling_bridge")!;
    const choice = ev.choices[0];
    const original = [...choice.effects];
    choice.effects = [{
      type: "check",
      check: { stat: "dex", dc: 12 },
      onSuccess: [{ type: "potion", potionId: "potion.nonexistent" }],
      onFailure: [{ type: "noop" }],
    }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("potion.nonexistent"))).toBe(true);
    choice.effects = original;
  });

  it("detects a non-positive check DC", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.crumbling_bridge")!;
    const choice = ev.choices[0];
    const original = [...choice.effects];
    choice.effects = [{
      type: "check",
      check: { stat: "dex", dc: 0 },
      onSuccess: [{ type: "noop" }],
      onFailure: [{ type: "noop" }],
    }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("DC must be > 0"))).toBe(true);
    choice.effects = original;
  });

  it("detects an unknown item in a choice requirement", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.rogue_trader")!;
    const choice = ev.choices[0];
    choice.requirements = [{ type: "hasItem", itemId: "item.nonexistent" }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("item.nonexistent"))).toBe(true);
    delete choice.requirements;
  });

  it("detects an event with fewer than 2 choices", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.quiet_hollow")!;
    const original = [...ev.choices];
    ev.choices = [original[0]];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("at least 2 choices"))).toBe(true);
    ev.choices = original;
  });

  it("detects an unknown event tag", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.quiet_hollow")!;
    const original = ev.tags;
    // @ts-expect-error — deliberately invalid tag to exercise the validator
    ev.tags = ["bogus"];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('unknown tag "bogus"'))).toBe(true);
    ev.tags = original;
  });

  it("detects an encounter referencing an unknown reward pool", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const enc = repo.getEncounter("encounter.road_ambush")!;
    enc.rewardPoolId = "reward.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("reward.nonexistent"))).toBe(true);
    delete enc.rewardPoolId;
  });

  it("detects an enemy position outside the combat grid", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const enc = repo.getEncounter("encounter.shadowed_defile")!;
    const original = enc.positions ? [...enc.positions] : undefined;
    enc.positions = [{ q: 9, r: 9 }, { q: 0, r: 2 }, { q: 0, r: -2 }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("outside the grid"))).toBe(true);
    enc.positions = original;
  });

  it("detects overlapping enemy positions", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const enc = repo.getEncounter("encounter.shadowed_defile")!;
    const original = enc.positions ? [...enc.positions] : undefined;
    enc.positions = [{ q: 0, r: 2 }, { q: 0, r: 2 }, { q: 0, r: -2 }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("used twice"))).toBe(true);
    enc.positions = original;
  });

  it("detects an encounter exceeding the 5-enemy cap", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const enc = repo.getEncounter("encounter.road_ambush")!;
    const original = [...enc.enemyGroups];
    enc.enemyGroups = [{ enemyId: "enemy.wolf", count: 6 }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("exceeds cap"))).toBe(true);
    enc.enemyGroups = original;
  });

  it("detects an encounter pool referencing an unknown encounter", () => {
    const repo = new DataRepository();
    repo.loadAll();
    ENCOUNTER_POOLS["pool.standard_combat"].push("encounter.nonexistent");
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("encounter.nonexistent"))).toBe(true);
    ENCOUNTER_POOLS["pool.standard_combat"].pop();
  });

  it("detects a node referencing an unknown encounter pool", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const node = repo.getNode("node.long_combat_a")!;
    const original = node.encounterPoolId;
    node.encounterPoolId = "pool.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("pool.nonexistent"))).toBe(true);
    node.encounterPoolId = original;
  });

  it("detects a node referencing an unknown event pool", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const node = repo.getNode("node.event_1")!;
    node.eventPoolId = "pool.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("pool.nonexistent"))).toBe(true);
    delete node.eventPoolId;
  });

  it("validation fails when not loaded", () => {
    const repo = new DataRepository();
    const report = repo.validate();
    expect(report.valid).toBe(false);
  });

  it("rejects legacy check stat 'might' — must use AbilityKey", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.crumbling_bridge")!;
    const choice = ev.choices[0];
    const original = [...choice.effects];
    // @ts-expect-error — deliberately injecting a legacy stat to test the validator
    choice.effects = [{ type: "check", check: { stat: "might", dc: 12 }, onSuccess: [{ type: "noop" }], onFailure: [{ type: "noop" }] }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('"might"') && e.includes("valid ability"))).toBe(true);
    choice.effects = original;
  });

  it("accepts stat_boost with legacy combat stat 'spirit'", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const report = repo.validate();
    expect(report.valid).toBe(true);
    // event.strange_shrine and others use stat_boost: spirit — validate must not reject them
    const shrine = repo.getEvent("event.strange_shrine")!;
    const prayChoice = shrine.choices.find((c) => c.id === "event.strange_shrine.pray")!;
    expect(prayChoice.effects[0]).toMatchObject({ type: "stat_boost", stat: "spirit" });
  });

  it("rejects an invalid ability key in a check stat", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.crumbling_bridge")!;
    const choice = ev.choices[0];
    const original = [...choice.effects];
    // @ts-expect-error — deliberately injecting a bad ability key
    choice.effects = [{ type: "check", check: { stat: "luck", dc: 12 }, onSuccess: [{ type: "noop" }], onFailure: [{ type: "noop" }] }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('"luck"'))).toBe(true);
    choice.effects = original;
  });
});
