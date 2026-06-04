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

  it("Rest shows a preview, Confirm applies it, and Leave returns to map", () => {
    const { root, app, getScreen, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Rest (Heal 40% max HP)");
    // Pre-confirm preview shows the heal before it applies, and stays reversible.
    expect(root.textContent).toContain("Heal each living hero");
    expect(root.textContent).toContain("Confirm");

    clickButton("Confirm");
    expect(root.textContent).toContain("rested");

    clickButton("Leave");
    expect(getScreen()).toBe("map");
  });

  it("Cancel from the Rest preview returns to the menu without applying", () => {
    const { root, app, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Rest (Heal 40% max HP)");
    expect(root.textContent).toContain("Confirm");

    clickButton("Cancel");
    expect(root.textContent).toContain("Brew Potion");
    expect(root.textContent).not.toContain("Heal each living hero");
    // Nothing recorded in the camp log.
    expect(root.textContent).not.toContain("rested");
  });

  it("Train button transitions to hero picker, picking hero shows result", () => {
    const { root, app, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Train (+5 XP to a hero)");

    expect(root.textContent).toContain("Choose a hero to train");

    const heroBtns = Array.from(root.querySelectorAll("button")).filter(
      (b) => b.textContent?.includes("—") && b.textContent?.includes("XP)"),
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

  it("Brew Potion deducts gold, adds a potion, and shows it in the bag", () => {
    const { root, app, clickButton } = mountApp();
    setupCampRun(); // starts with 30 gold
    gameState.screen = "camp";
    app.render();

    clickButton("Brew Potion (Spend 10 gold → +1 Healing Potion)");
    expect(root.textContent).toContain("add 1 Healing Potion");
    clickButton("Confirm");

    expect(gameState.run!.gold).toBe(20);
    expect(gameState.run!.inventory.potions).toContain("potion.healing");
    // The bag summary on-screen confirms the potion is now held.
    expect(root.textContent).toContain("Potions: Healing Potion");
  });

  it("limits recovery to one per camp: after Rest, Brew is disabled with a reason", () => {
    const { root, app, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Rest (Heal 40% max HP)");
    clickButton("Confirm");

    const brewBtn = Array.from(root.querySelectorAll("button")).find((b) =>
      b.textContent?.startsWith("Brew Potion"),
    ) as HTMLButtonElement;
    expect(brewBtn.disabled).toBe(true);
    expect(brewBtn.textContent).toContain("Already recovered");
  });

  it("Prepare for Combat queues a buff consumed by the next combat", () => {
    const { root, app, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Prepare for Combat (Bless the party next battle)");
    expect(root.textContent).toContain("Blessed");
    clickButton("Confirm");

    expect(gameState.run!.runModifiers.some((m) => m.kind === "next_combat_blessing")).toBe(true);
    // Prepare is not recovery — Rest is still available afterwards.
    expect(root.textContent).toContain("Rest (Heal 40% max HP)");
  });

  it("Leave increments nodesCleared exactly once", () => {
    const { app, getScreen, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();
    const before = gameState.run!.mapState.nodesCleared;

    clickButton("Leave");
    expect(getScreen()).toBe("map");
    expect(gameState.run!.mapState.nodesCleared).toBe(before + 1);
  });
});
