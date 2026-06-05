// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { gameState, resetGameState } from "../../src/state/GameState.ts";
import { initCombatState, createCombatFromRun } from "../../src/state/GameState.ts";
import { setupDefaultRun, setupWonRun, setupLostRun, setupActiveRun } from "./helpers/seededRun.ts";
import { ITEM_PRICE } from "../../src/run/Shop.ts";

describe("screen-transitions", () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    cleanup();
  });

  it('MainMenu: "Quick Start" transitions to map', () => {
    const { app, getScreen, clickButton } = mountApp();
    gameState.screen = "main_menu";
    app.render();
    clickButton("Quick Start");
    expect(getScreen()).toBe("map");
    expect(gameState.run).not.toBeNull();
  });

  it('MainMenu: "Custom Party" transitions to setup', () => {
    const { app, getScreen, clickButton } = mountApp();
    gameState.screen = "main_menu";
    app.render();
    clickButton("Custom Party");
    expect(getScreen()).toBe("setup");
  });

  it('SetupScreen: "Confirm Party" starts a custom run on the map', () => {
    const { app, getScreen, clickButton } = mountApp();
    gameState.screen = "main_menu";
    app.render();
    clickButton("Custom Party");
    clickButton("Confirm Party");
    expect(getScreen()).toBe("map");
    expect(gameState.run).not.toBeNull();
    expect(gameState.run!.party).toHaveLength(3);
  });

  it('MainMenu: "Meta Upgrades" transitions to meta_upgrades', () => {
    const { app, getScreen, clickButton } = mountApp();
    gameState.screen = "main_menu";
    app.render();
    clickButton("Meta Upgrades");
    expect(getScreen()).toBe("meta_upgrades");
  });

  it('MetaUpgrades: "Back to Main Menu" transitions to main_menu', () => {
    const { app, getScreen, clickButton } = mountApp();
    gameState.screen = "meta_upgrades";
    app.render();
    clickButton("Back to Main Menu");
    expect(getScreen()).toBe("main_menu");
  });

  it('Map: clicking an available node transitions to combat', () => {
    const { app, getScreen, clickTestId } = mountApp();
    setupActiveRun();
    app.render();
    clickTestId("map-node-node.combat_a");
    expect(getScreen()).toBe("combat");
    expect(gameState.combat).not.toBeNull();
  });

  it('Combat (with run): victory auto-transitions to reward', () => {
    const { app, getScreen } = mountApp();
    setupDefaultRun();
    gameState.combat = createCombatFromRun(gameState.run!, "encounter.road_ambush", gameState.rng);
    for (const u of gameState.combat.units) {
      if (u.team === "enemy") u.hp = 0;
    }
    gameState.combat.status = "victory";
    gameState.screen = "combat";
    app.render();
    expect(getScreen()).toBe("reward");
  });

  it('Combat (no run/sandbox): defeat banner shows "Continue" button', () => {
    const { app, root } = mountApp();
    gameState.run = null;
    gameState.combat = initCombatState(gameState.rng);
    const cs = gameState.combat;
    for (const u of cs.units) {
      if (u.team === "hero") u.hp = 0;
    }
    cs.status = "defeat";
    gameState.screen = "combat";
    app.render();
    const contBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Continue");
    expect(contBtn).not.toBeNull();
  });

  it('Reward: clicking a card and Continue transitions to map and updates state', () => {
    const { app, root, getScreen } = mountApp();
    setupDefaultRun();
    gameState.combat = createCombatFromRun(gameState.run!, "encounter.road_ambush", gameState.rng);
    gameState.screen = "reward";
    app.render();
    const cards = root.querySelectorAll('[data-testid^="reward-card-"]');
    expect(cards.length).toBeGreaterThan(0);
    const beforeGold = gameState.run!.gold;
    (cards[0] as HTMLElement).click();
    const stashBtn = root.querySelector('[data-testid="stash-btn"]');
    if (stashBtn) {
      (stashBtn as HTMLElement).click();
    }
    app.render();
    const continueBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Continue");
    expect(continueBtn).toBeTruthy();
    continueBtn!.click();
    expect(getScreen()).toBe("map");
    expect(gameState.run).not.toBeNull();
    expect(gameState.run!.gold).toBeGreaterThanOrEqual(beforeGold);
    expect(gameState.combat).toBeNull();
  });

  it('Reward: fresh gold/XP and cards for each combat', () => {
    const { app, root } = mountApp();
    setupDefaultRun();

    gameState.combat = createCombatFromRun(gameState.run!, "encounter.road_ambush", gameState.rng);
    gameState.screen = "reward";
    const goldBefore1 = gameState.run!.gold;
    app.render();
    const goldAfter1 = gameState.run!.gold;
    expect(goldAfter1).toBeGreaterThan(goldBefore1);

    const cards1 = root.querySelectorAll('[data-testid^="reward-card-"]');
    expect(cards1.length).toBeGreaterThan(0);
    (cards1[0] as HTMLElement).click();
    const stash1 = root.querySelector('[data-testid="stash-btn"]');
    if (stash1) (stash1 as HTMLElement).click();
    app.render();
    const continue1 = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Continue");
    expect(continue1).toBeTruthy();
    continue1!.click();

    gameState.combat = createCombatFromRun(gameState.run!, "encounter.road_ambush", gameState.rng);
    gameState.screen = "reward";
    const goldBefore2 = gameState.run!.gold;
    app.render();
    const goldAfter2 = gameState.run!.gold;
    expect(goldAfter2).toBeGreaterThan(goldBefore2);

    const cards2 = root.querySelectorAll('[data-testid^="reward-card-"]');
    expect(cards2.length).toBeGreaterThan(0);
  });

  it('RunSummary (won): clicking "Return to Main Menu" transitions to main_menu', () => {
    const { app, getScreen, clickButton } = mountApp();
    setupWonRun();
    gameState.screen = "run_summary";
    app.render();
    clickButton("Return to Main Menu");
    expect(getScreen()).toBe("main_menu");
    expect(gameState.run).toBeNull();
  });

  it('RunSummary (lost): clicking "Return to Main Menu" transitions to main_menu', () => {
    const { app, getScreen, clickButton } = mountApp();
    setupLostRun();
    gameState.screen = "run_summary";
    app.render();
    clickButton("Return to Main Menu");
    expect(getScreen()).toBe("main_menu");
    expect(gameState.run).toBeNull();
  });

  it('Shop: "Leave Shop" transitions to map', () => {
    const { app, getScreen, clickButton } = mountApp();
    setupDefaultRun();
    gameState.screen = "shop";
    app.render();
    clickButton("Leave Shop");
    expect(getScreen()).toBe("map");
  });

  it("Shop: buying an item can stash it and keeps the slot sold", () => {
    const { app, root, getScreen } = mountApp();
    setupDefaultRun();
    const run = gameState.run!;
    run.mapState.currentNodeId = "node.shop_1";
    run.shopStates["node.shop_1"] = {
      items: [{ itemId: "item.padded_armor", sold: false }],
      potions: [],
      servicesUsed: {},
    };
    gameState.screen = "shop";
    app.render();

    const beforeGold = run.gold;
    (root.querySelector('[data-testid="shop-buy-item-0"]') as HTMLButtonElement).click();

    expect(run.gold).toBe(beforeGold - ITEM_PRICE.common);
    expect(run.inventory.gold).toBe(run.gold);
    expect(run.shopStates["node.shop_1"].items[0].sold).toBe(true);
    expect(root.querySelector('[data-testid="shop-equip-panel"]')).not.toBeNull();

    (root.querySelector('[data-testid="shop-stash-btn"]') as HTMLButtonElement).click();

    expect(run.inventory.items).toEqual(["item.padded_armor"]);
    expect(root.querySelector('[data-testid="shop-equip-panel"]')).toBeNull();

    const leave = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Leave Shop");
    expect(leave).toBeTruthy();
    leave!.click();
    expect(getScreen()).toBe("map");

    gameState.screen = "shop";
    app.render();
    expect(root.textContent).toContain("Sold");
    expect(root.querySelector('[data-testid="shop-buy-item-0"]')).toBeNull();
  });

  it("Shop: buying an item can equip it to party and next combat sees the equipment", () => {
    const { app, root } = mountApp();
    setupDefaultRun();
    const run = gameState.run!;
    run.mapState.currentNodeId = "node.shop_1";
    run.shopStates["node.shop_1"] = {
      items: [{ itemId: "item.soldier_badge", sold: false }],
      potions: [],
      servicesUsed: {},
    };
    gameState.screen = "shop";
    app.render();

    (root.querySelector('[data-testid="shop-buy-item-0"]') as HTMLButtonElement).click();
    (root.querySelector('[data-testid="shop-equip-hero_001"]') as HTMLButtonElement).click();

    expect(run.party[0].equippedItemIds.trinket).toBe("item.soldier_badge");
    expect(run.inventory.items).toEqual([]);

    const combat = createCombatFromRun(run, "encounter.road_ambush", gameState.rng);
    const guardian = combat.units.find((u) => u.instanceId === "hero_001")!;
    expect(guardian.equippedItemIds.trinket).toBe("item.soldier_badge");
    expect(guardian.stats.might).toBe(4);
  });

  it('Camp: "Leave" transitions to map', () => {
    const { app, getScreen, clickButton } = mountApp();
    setupDefaultRun();
    gameState.screen = "camp";
    app.render();
    clickButton("Leave");
    expect(getScreen()).toBe("map");
  });

  it("Camp Prepare buff blesses heroes at the next combat and is consumed", () => {
    setupDefaultRun();
    const run = gameState.run!;
    run.runModifiers.push({ kind: "next_combat_blessing" });

    const combat = createCombatFromRun(run, "encounter.road_ambush", gameState.rng);

    // Every living hero enters the battle Blessed...
    const heroes = combat.units.filter((u) => u.team === "hero" && u.hp > 0);
    expect(heroes.length).toBeGreaterThan(0);
    expect(heroes.every((h) => h.conditions.some((c) => c.id === "blessed"))).toBe(true);
    // ...and the buff is consumed so a later combat doesn't re-trigger it.
    expect(run.runModifiers.some((m) => m.kind === "next_combat_blessing")).toBe(false);

    const combat2 = createCombatFromRun(run, "encounter.road_ambush", gameState.rng);
    const heroes2 = combat2.units.filter((u) => u.team === "hero" && u.hp > 0);
    expect(heroes2.some((h) => h.conditions.some((c) => c.id === "blessed"))).toBe(false);
  });

  it('Recruit: "Skip" transitions to map', () => {
    const { app, getScreen, clickButton } = mountApp();
    setupDefaultRun();
    gameState.screen = "recruit";
    app.render();
    clickButton("Skip");
    expect(getScreen()).toBe("map");
  });

  it('Recruit: "Recruit" shows a result after App re-renders', () => {
    const { app, root, getScreen, clickButton } = mountApp();
    setupDefaultRun();
    const run = gameState.run!;
    run.mapState.currentNodeId = "node.recruit_1";
    gameState.screen = "recruit";
    app.render();

    clickButton("Recruit");

    expect(run.party).toHaveLength(4);
    expect(root.textContent).toContain("joins the party!");
    clickButton("Continue");
    expect(getScreen()).toBe("map");
    expect(run.mapState.nodesCleared).toBe(1);
  });

  it("Recruit: full-party replacement picker and result survive re-render", () => {
    const { app, root, clickButton } = mountApp();
    setupDefaultRun();
    const run = gameState.run!;
    run.mapState.currentNodeId = "node.recruit_1";
    run.party.push({
      ...run.party[0],
      instanceId: "hero_004",
      displayName: "Toren",
      equippedItemIds: { ...run.party[0].equippedItemIds },
      bonusStats: { ...run.party[0].bonusStats },
    });
    gameState.screen = "recruit";
    app.render();

    clickButton("Recruit");

    expect(run.party).toHaveLength(4);
    expect(root.textContent).toContain("Party is full. Replace which hero?");

    const replaceBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.includes("Toren"));
    expect(replaceBtn).toBeTruthy();
    replaceBtn!.click();

    expect(run.party).toHaveLength(4);
    expect(root.textContent).toContain("dismissed (items stashed).");
  });

  it('Recruit: "Accept" Pack Mule shows a result and adds one modifier', () => {
    const { app, root, clickButton } = mountApp();
    setupDefaultRun();
    const run = gameState.run!;
    run.mapState.currentNodeId = "node.recruit_1";
    gameState.screen = "recruit";
    app.render();

    clickButton("Accept");

    expect(root.textContent).toContain("Pack Mule follows your party!");
    expect(run.runModifiers.filter((m) => m.kind === "gold_multiplier")).toHaveLength(1);
  });

  it("Recruit: changing recruit nodes resets transient result state", () => {
    const { app, root, clickButton } = mountApp();
    setupDefaultRun();
    const run = gameState.run!;
    run.mapState.currentNodeId = "node.recruit_1";
    gameState.screen = "recruit";
    app.render();
    clickButton("Accept");
    expect(root.textContent).toContain("Pack Mule follows your party!");

    run.mapState.currentNodeId = "node.long_recruit_a";
    app.render();

    expect(root.textContent).toContain("A Traveler Approaches");
    expect(root.textContent).not.toContain("Pack Mule follows your party!");
    expect(Array.from(root.querySelectorAll("button")).some((b) => b.textContent?.trim() === "Accept")).toBe(true);
  });

  it('Pet: "Leave" transitions to map', () => {
    const { app, getScreen, clickButton } = mountApp();
    setupDefaultRun();
    gameState.screen = "pet";
    app.render();
    clickButton("Leave");
    expect(getScreen()).toBe("map");
  });
});
