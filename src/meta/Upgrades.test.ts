import { describe, it, expect } from "vitest";
import { canPurchase, purchase, applyMetaUpgradesToFreshRun } from "./Upgrades.ts";
import type { MetaProgressionState } from "./MetaProgression.ts";
import type { RunState } from "../state/RunState.ts";

function makeMeta(overrides?: Partial<MetaProgressionState>): MetaProgressionState {
  return {
    renown: 0,
    upgradeRanks: {},
    completedRuns: 0,
    bossWins: 0,
    ...overrides,
  };
}

function makeRun(): RunState {
  return {
    seed: 0,
    gold: 0,
    party: [
      { instanceId: "h1", classId: "class.guardian", displayName: "Mara", level: 1, xp: 0, hp: 18, maxHp: 18, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
      { instanceId: "h2", classId: "class.acolyte", displayName: "Sable", level: 1, xp: 0, hp: 14, maxHp: 14, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
      { instanceId: "h3", classId: "class.arcanist", displayName: "Eldra", level: 1, xp: 0, hp: 11, maxHp: 11, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
    ],
    inventory: { items: [], potions: [], gold: 0 },
    mapState: {
      currentNodeId: "node.start",
      visitedNodeIds: ["node.start"],
      nodesCleared: 0,
      elitesDefeated: 0,
      bossDefeated: false,
    },
    runStatus: "active",
    shopStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
}

describe("canPurchase", () => {
  it("returns ok with sufficient renown", () => {
    const meta = makeMeta({ renown: 10 });
    expect(canPurchase("upgrade.starting_gold", meta)).toEqual({ ok: true });
  });

  it("returns not enough renown when broke", () => {
    const meta = makeMeta({ renown: 2 });
    const result = canPurchase("upgrade.starting_gold", meta);
    expect(result).toEqual({ ok: false, reason: "Not enough Renown" });
  });

  it("returns max rank for one-shot upgrade", () => {
    const meta = makeMeta({ renown: 99, upgradeRanks: { "upgrade.veteran_guardian": 1 } });
    const result = canPurchase("upgrade.veteran_guardian", meta);
    expect(result).toEqual({ ok: false, reason: "Max rank reached" });
  });
});

describe("purchase", () => {
  it("starting_gold rank 1 deducts renown and increments rank", () => {
    const meta = makeMeta({ renown: 10 });
    purchase("upgrade.starting_gold", meta);
    expect(meta.renown).toBe(5);
    expect(meta.upgradeRanks["upgrade.starting_gold"]).toBe(1);
  });

  it("does nothing if max rank reached", () => {
    const meta = makeMeta({ renown: 99, upgradeRanks: { "upgrade.veteran_guardian": 1 } });
    purchase("upgrade.veteran_guardian", meta);
    expect(meta.renown).toBe(99);
    expect(meta.upgradeRanks["upgrade.veteran_guardian"]).toBe(1);
  });
});

describe("applyMetaUpgradesToFreshRun", () => {
  it("starting_gold rank 2 adds 10 gold", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.starting_gold": 2 } });
    const run = makeRun();
    applyMetaUpgradesToFreshRun(run, meta);
    expect(run.gold).toBe(10);
  });

  it("starting_xp rank 1 grants 10 XP to every hero", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.starting_xp": 1 } });
    const run = makeRun();
    applyMetaUpgradesToFreshRun(run, meta);
    for (const pm of run.party) {
      expect(pm.xp).toBeGreaterThanOrEqual(10);
    }
  });

  it("potion_belt rank 1 adds healing potion", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.potion_belt": 1 } });
    const run = makeRun();
    applyMetaUpgradesToFreshRun(run, meta);
    expect(run.inventory.potions).toContain("potion.healing");
  });

  it("veteran_guardian adds might to guardian", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.veteran_guardian": 1 } });
    const run = makeRun();
    applyMetaUpgradesToFreshRun(run, meta);
    const guardian = run.party.find((p) => p.classId === "class.guardian")!;
    expect(guardian.bonusStats.might).toBe(1);
  });
});
