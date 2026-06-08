import { describe, it, expect } from "vitest";
import {
  canPurchase,
  purchase,
  applyMetaUpgradesToFreshRun,
  getAmbiguousClassUpgrades,
} from "./Upgrades.ts";
import type { MetaProgressionState } from "./MetaProgression.ts";
import type { RunState, PartyMember } from "../state/RunState.ts";

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
    campStates: {},
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
    expect(guardian.bonusStats.str).toBe(1);
  });
});

function makeMember(instanceId: string, classId: string): PartyMember {
  return {
    instanceId,
    classId,
    displayName: instanceId,
    level: 1,
    xp: 0,
    hp: 18,
    maxHp: 18,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: null, trinket: null },
  };
}

function makeRunWithParty(party: PartyMember[]): RunState {
  const run = makeRun();
  run.party = party;
  return run;
}

describe("getAmbiguousClassUpgrades", () => {
  it("returns nothing when each target class is unique", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.veteran_guardian": 1 } });
    const party = [makeMember("h1", "class.guardian"), makeMember("h2", "class.acolyte")];
    expect(getAmbiguousClassUpgrades(party, meta)).toHaveLength(0);
  });

  it("flags a class-targeted upgrade when the target class has duplicates", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.veteran_guardian": 1 } });
    const party = [makeMember("h1", "class.guardian"), makeMember("h2", "class.guardian")];
    const amb = getAmbiguousClassUpgrades(party, meta);
    expect(amb).toHaveLength(1);
    expect(amb[0].upgradeId).toBe("upgrade.veteran_guardian");
    expect(amb[0].candidates.map((c) => c.instanceId)).toEqual(["h1", "h2"]);
  });

  it("ignores non-class-targeted upgrades", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.starting_gold": 2 } });
    const party = [makeMember("h1", "class.guardian"), makeMember("h2", "class.guardian")];
    expect(getAmbiguousClassUpgrades(party, meta)).toHaveLength(0);
  });
});

describe("applyMetaUpgradesToFreshRun with duplicate classes", () => {
  it("falls back to the first matching hero when no assignment is given", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.veteran_guardian": 1 } });
    const run = makeRunWithParty([
      makeMember("h1", "class.guardian"),
      makeMember("h2", "class.guardian"),
    ]);
    applyMetaUpgradesToFreshRun(run, meta);
    expect(run.party[0].bonusStats.str).toBe(1);
    expect(run.party[1].bonusStats.str).toBeUndefined();
  });

  it("applies a stat bonus to the player-assigned hero", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.veteran_guardian": 1 } });
    const run = makeRunWithParty([
      makeMember("h1", "class.guardian"),
      makeMember("h2", "class.guardian"),
    ]);
    applyMetaUpgradesToFreshRun(run, meta, { "upgrade.veteran_guardian": "h2" });
    expect(run.party[0].bonusStats.str).toBeUndefined();
    expect(run.party[1].bonusStats.str).toBe(1);
  });

  it("applies a starting item to the player-assigned hero", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.apprentice_kit": 1 } });
    const run = makeRunWithParty([
      makeMember("a1", "class.arcanist"),
      makeMember("a2", "class.arcanist"),
    ]);
    applyMetaUpgradesToFreshRun(run, meta, { "upgrade.apprentice_kit": "a2" });
    expect(run.party[0].equippedItemIds.weapon).toBeNull();
    expect(run.party[1].equippedItemIds.weapon).toBe("item.apprentice_wand");
  });

  it("ignores a stale assignment whose class no longer matches", () => {
    const meta = makeMeta({ upgradeRanks: { "upgrade.veteran_guardian": 1 } });
    const run = makeRunWithParty([
      makeMember("h1", "class.guardian"),
      makeMember("h2", "class.guardian"),
    ]);
    // "x9" is not in the party — should fall back to first matching guardian.
    applyMetaUpgradesToFreshRun(run, meta, { "upgrade.veteran_guardian": "x9" });
    expect(run.party[0].bonusStats.str).toBe(1);
  });
});
