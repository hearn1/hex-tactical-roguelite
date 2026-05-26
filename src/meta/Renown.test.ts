import { describe, it, expect } from "vitest";
import { computeRenown } from "./Renown.ts";
import type { RunState } from "../state/RunState.ts";

function makeRunState(overrides: {
  runStatus: "won" | "lost";
  nodesCleared?: number;
  elitesDefeated?: number;
  bossDefeated?: boolean;
  party?: RunState["party"];
}): RunState {
  return {
    seed: 0,
    gold: 0,
    party: overrides.party ?? [],
    inventory: { items: [], potions: [], gold: 0 },
    mapState: {
      currentNodeId: "node.start",
      visitedNodeIds: ["node.start"],
      nodesCleared: overrides.nodesCleared ?? 0,
      elitesDefeated: overrides.elitesDefeated ?? 0,
      bossDefeated: overrides.bossDefeated ?? false,
    },
    runStatus: overrides.runStatus,
    shopStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
}

describe("computeRenown", () => {
  it("empty lost run returns 1 with minimumApplied", () => {
    const run = makeRunState({ runStatus: "lost" });
    const result = computeRenown(run);
    expect(result.total).toBe(1);
    expect(result.minimumApplied).toBe(true);
  });

  it("4 nodes, 1 elite, no boss, 3 chars leveled, lost = 16", () => {
    const run = makeRunState({
      runStatus: "lost",
      nodesCleared: 4,
      elitesDefeated: 1,
      party: [
        { instanceId: "h1", classId: "class.guardian", displayName: "A", level: 3, xp: 60, hp: 18, maxHp: 18, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
        { instanceId: "h2", classId: "class.acolyte", displayName: "B", level: 2, xp: 30, hp: 14, maxHp: 14, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
        { instanceId: "h3", classId: "class.arcanist", displayName: "C", level: 2, xp: 25, hp: 11, maxHp: 11, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
      ],
    });
    const result = computeRenown(run);
    expect(result.nodes).toBe(8);
    expect(result.elites).toBe(5);
    expect(result.boss).toBe(0);
    expect(result.characters).toBe(3);
    expect(result.total).toBe(16);
    expect(result.minimumApplied).toBe(false);
  });

  it("6 nodes, 1 elite, boss defeated, 4 chars leveled, won = 36", () => {
    const run = makeRunState({
      runStatus: "won",
      nodesCleared: 6,
      elitesDefeated: 1,
      bossDefeated: true,
      party: [
        { instanceId: "h1", classId: "class.guardian", displayName: "A", level: 4, xp: 100, hp: 18, maxHp: 18, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
        { instanceId: "h2", classId: "class.acolyte", displayName: "B", level: 2, xp: 30, hp: 14, maxHp: 14, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
        { instanceId: "h3", classId: "class.arcanist", displayName: "C", level: 2, xp: 25, hp: 11, maxHp: 11, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
        { instanceId: "h4", classId: "class.guardian", displayName: "D", level: 2, xp: 20, hp: 18, maxHp: 18, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
      ],
    });
    const result = computeRenown(run);
    expect(result.nodes).toBe(12);
    expect(result.elites).toBe(5);
    expect(result.boss).toBe(15);
    expect(result.characters).toBe(4);
    expect(result.total).toBe(36);
    expect(result.minimumApplied).toBe(false);
  });

  it("won run with zero everything returns 0 (minimum does not apply)", () => {
    const run = makeRunState({
      runStatus: "won",
      party: [
        { instanceId: "h1", classId: "class.guardian", displayName: "A", level: 1, xp: 0, hp: 18, maxHp: 18, bonusStats: {}, equippedItemIds: { weapon: null, armor: null, trinket: null } },
      ],
    });
    const result = computeRenown(run);
    expect(result.total).toBe(0);
    expect(result.minimumApplied).toBe(false);
  });
});
