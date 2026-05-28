// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { gameState, resetGameState } from "../../src/state/GameState.ts";
import { createInventory } from "../../src/run/Inventory.ts";
import { CLASS_REGISTRY } from "../../src/data/classes.ts";
import type { PartyMember } from "../../src/state/RunState.ts";

function createDefaultParty(): PartyMember[] {
  const classIds = ["class.guardian", "class.acolyte", "class.arcanist"];
  return classIds.map((classId, i) => {
    const def = CLASS_REGISTRY[classId];
    return {
      instanceId: `hero_00${i + 1}`,
      classId,
      displayName: def?.displayName ?? `Hero ${i + 1}`,
      level: 1,
      xp: 0,
      hp: Math.floor((def?.baseStats.maxHp ?? 20) / 2),
      maxHp: def?.baseStats.maxHp ?? 20,
      bonusStats: {},
      equippedItemIds: { weapon: null, armor: null, trinket: null },
    };
  });
}

function setupCampRun(seed: number = 12345): void {
  resetGameState(seed);
  gameState.run = {
    seed: gameState.rngSeed,
    gold: 30,
    party: createDefaultParty(),
    inventory: createInventory(),
    mapState: {
      currentNodeId: "node.camp_1",
      visitedNodeIds: ["node.start", "node.combat_a", "node.shop_1", "node.camp_1"],
      nodesCleared: 2,
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

describe("CampScreen state", () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    cleanup();
  });

  it("Rest button transitions to result phase and Continue returns to map", () => {
    const { root, app, getScreen, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Rest (Heal 40% max HP)");

    expect(root.textContent).toContain("rested");
    expect(root.textContent).toContain("Continue");

    clickButton("Continue");
    expect(getScreen()).toBe("map");
  });

  it("Train button transitions to hero picker, picking hero shows result", () => {
    const { root, app, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Train (+5 XP to a hero)");

    expect(root.textContent).toContain("Choose a hero to train");

    const heroBtns = Array.from(root.querySelectorAll("button")).filter(
      (b) => b.textContent?.includes("—"),
    );
    expect(heroBtns.length).toBe(3);
    (heroBtns[0] as HTMLButtonElement).click();

    expect(root.textContent).toContain("gains 5 XP");
  });

  it("Cancel returns from hero picker to menu", () => {
    const { root, app, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Train (+5 XP to a hero)");
    expect(root.textContent).toContain("Choose a hero to train");

    clickButton("Cancel");
    expect(root.textContent).toContain("Rest (Heal 40% max HP)");
    expect(root.textContent).toContain("Train (+5 XP to a hero)");
    expect(root.textContent).not.toContain("Choose a hero to train");
  });
});
