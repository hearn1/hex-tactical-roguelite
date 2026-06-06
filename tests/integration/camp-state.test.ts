// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { gameState, resetGameState } from "../../src/state/GameState.ts";
import { createInventory } from "../../src/run/Inventory.ts";
import { CLASS_REGISTRY } from "../../src/data/classes.ts";
import type { PartyMember } from "../../src/state/RunState.ts";
import { buildParty, createRunState, defaultPartySpecs } from "../../src/run/PartySetup.ts";
import { getCampState } from "../../src/ui/screens/CampScreen.ts";

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
    campStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
}

function createFreshCampRun(nodeId: string = "node.camp_1") {
  const run = createRunState(buildParty(defaultPartySpecs()), "normal", "short");
  run.seed = 12345;
  run.mapState = {
    currentNodeId: nodeId,
    visitedNodeIds: ["node.start", nodeId],
    nodesCleared: 2,
    elitesDefeated: 0,
    bossDefeated: false,
  };
  return run;
}

function findButton(root: HTMLElement, startsWith: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll("button")).find((b) =>
    b.textContent?.startsWith(startsWith),
  );
  if (!button) throw new Error(`Missing button: ${startsWith}`);
  return button as HTMLButtonElement;
}

describe("CampScreen state", () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    cleanup();
  });

  it("stores camp actions on RunState so a fresh run starts with fresh camp choices", () => {
    const { root, app, clickButton } = mountApp();
    const runA = createFreshCampRun("node.camp_1");
    gameState.run = runA;
    gameState.screen = "camp";
    app.render();

    clickButton("Long Rest");
    clickButton("Confirm");

    expect(runA.campStates["node.camp_1"].used).toEqual(["rest"]);
    expect(runA.campStates["node.camp_1"].outcomes[0]).toContain("Long Rest complete");

    const runB = createFreshCampRun("node.camp_1");
    gameState.run = runB;
    gameState.screen = "camp";
    app.render();

    expect(getCampState(runB).used).toEqual([]);
    const restButton = findButton(root, "Long Rest");
    expect(restButton.disabled).toBe(false);
    expect(restButton.textContent).not.toContain("Already done");
  });

  it("persists used actions when revisiting the same camp node in the same run", () => {
    const { root, app, clickButton } = mountApp();
    const run = createFreshCampRun("node.camp_1");
    gameState.run = run;
    gameState.screen = "camp";
    app.render();

    clickButton("Battle Prayer (Bless + Prepare Spells)");
    clickButton("Confirm");
    app.render();

    expect(getCampState(run).used).toEqual(["prepare"]);
    const prepareButton = findButton(root, "Battle Prayer");
    expect(prepareButton.disabled).toBe(true);
    expect(prepareButton.textContent).toContain("Already done at this camp");
  });

  it("keeps different camp nodes fresh within the same run", () => {
    const { root, app, clickButton } = mountApp();
    const run = createFreshCampRun("node.camp_a");
    gameState.run = run;
    gameState.screen = "camp";
    app.render();

    clickButton("Long Rest");
    clickButton("Confirm");
    expect(run.campStates["node.camp_a"].used).toEqual(["rest"]);

    run.mapState.currentNodeId = "node.camp_b";
    run.mapState.visitedNodeIds.push("node.camp_b");
    run.campSupplies = run.party.length;
    app.render();

    expect(getCampState(run).used).toEqual([]);
    const restButton = findButton(root, "Long Rest");
    expect(restButton.disabled).toBe(false);
    expect(restButton.textContent).not.toContain("Already");
  });

  it("Rest shows a preview, Confirm applies it, and Leave returns to map", () => {
    const { root, app, getScreen, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Long Rest");
    // Pre-confirm preview shows the heal before it applies, and stays reversible.
    expect(root.textContent).toContain("fully heal");
    expect(root.textContent).toContain("Confirm");

    clickButton("Confirm");
    expect(root.textContent).toContain("Long Rest complete");

    clickButton("Leave");
    expect(getScreen()).toBe("map");
  });

  it("Cancel from the Rest preview returns to the menu without applying", () => {
    const { root, app, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Long Rest");
    expect(root.textContent).toContain("Confirm");

    clickButton("Cancel");
    expect(root.textContent).toContain("Brew Potion");
    expect(root.textContent).not.toContain("fully heal");
    // Nothing recorded in the camp log.
    expect(root.textContent).not.toContain("Long Rest complete");
  });

  it("blocks Long Rest when Camp Supplies are insufficient", () => {
    const { root, app } = mountApp();
    setupCampRun();
    gameState.run!.campSupplies = 2;
    gameState.screen = "camp";
    app.render();

    const restButton = findButton(root, "Long Rest");
    expect(restButton.disabled).toBe(true);
    expect(restButton.textContent).toContain("Requires 3 Camp Supplies");
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
    expect(root.textContent).toContain("Long Rest");
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

    clickButton("Long Rest");
    clickButton("Confirm");

    const brewBtn = Array.from(root.querySelectorAll("button")).find((b) =>
      b.textContent?.startsWith("Brew Potion"),
    ) as HTMLButtonElement;
    expect(brewBtn.disabled).toBe(true);
    expect(brewBtn.textContent).toContain("Already recovered");
  });

  it("Battle Prayer queues a buff consumed by the next combat", () => {
    const { root, app, clickButton } = mountApp();
    setupCampRun();
    gameState.screen = "camp";
    app.render();

    clickButton("Battle Prayer (Bless + Prepare Spells)");
    expect(root.textContent).toContain("Blessed");
    clickButton("Confirm");

    expect(gameState.run!.runModifiers.some((m) => m.kind === "next_combat_blessing")).toBe(true);
    // Prepare is not recovery — Rest is still available afterwards.
    expect(root.textContent).toContain("Long Rest");
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
