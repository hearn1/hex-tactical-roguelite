import { describe, it, expect, beforeEach } from "vitest";
import { DataRepository } from "./DataRepository.ts";

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

  it("validation fails when not loaded", () => {
    const repo = new DataRepository();
    const report = repo.validate();
    expect(report.valid).toBe(false);
  });
});
