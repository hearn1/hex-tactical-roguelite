// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { gameState, resetGameState } from "../../src/state/GameState.ts";
import { initCombatState, createCombatFromRun } from "../../src/state/GameState.ts";
import { setupDefaultRun, setupWonRun, setupLostRun, setupActiveRun } from "./helpers/seededRun.ts";

describe("screen-transitions", () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    cleanup();
  });

  it('MainMenu: "New Run" transitions to map', () => {
    const { app, getScreen, clickButton } = mountApp();
    gameState.screen = "main_menu";
    app.render();
    clickButton("New Run");
    expect(getScreen()).toBe("map");
    expect(gameState.run).not.toBeNull();
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

  it('Camp: "Leave" transitions to map', () => {
    const { app, getScreen, clickButton } = mountApp();
    setupDefaultRun();
    gameState.screen = "camp";
    app.render();
    clickButton("Leave");
    expect(getScreen()).toBe("map");
  });

  it('Recruit: "Skip" transitions to map', () => {
    const { app, getScreen, clickButton } = mountApp();
    setupDefaultRun();
    gameState.screen = "recruit";
    app.render();
    clickButton("Skip");
    expect(getScreen()).toBe("map");
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
