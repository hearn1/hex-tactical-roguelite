// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { gameState, resetGameState } from "../../src/state/GameState.ts";
import { autoPlayCombat, autoPlayMapNode, autoPlayReward, autoPlayNonCombatScreen } from "./helpers/autoPlay.ts";
import { setupDefaultRun, setupLowHealthRun } from "./helpers/seededRun.ts";

describe("playthrough", () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    cleanup();
  });

  it("seeded run on Easy reaches victory and returns to main menu", () => {
    const { app, getScreen, clickButton, root } = mountApp();
    resetGameState(12345);
    gameState.screen = "main_menu";
    app.render();

    clickButton("New Run");
    expect(getScreen()).toBe("map");

    let safety = 0;
    while (getScreen() !== "run_summary" && safety < 30) {
      safety++;
      const screen = getScreen();

      if (screen === "map") {
        autoPlayMapNode();
      } else if (screen === "combat") {
        autoPlayCombat();
      } else if (screen === "reward") {
        autoPlayReward();
      } else {
        app.render();
        autoPlayNonCombatScreen(root);
      }
      app.render();
    }

    expect(getScreen()).toBe("run_summary");
    expect(gameState.run?.runStatus).toBe("won");

    app.render();
    clickButton("Return to Main Menu");
    expect(getScreen()).toBe("main_menu");
    expect(gameState.run).toBeNull();
  }, 15_000);

  it("seeded run with low HP leads to defeat and returns to main menu", () => {
    const { app, getScreen, root, clickButton } = mountApp();
    setupLowHealthRun(98765);
    app.render();
    expect(getScreen()).toBe("map");

    let safety = 0;
    while (getScreen() !== "run_summary" && safety < 10) {
      safety++;
      const screen = getScreen();

      if (screen === "map") {
        autoPlayMapNode();
      } else if (screen === "combat") {
        autoPlayCombat();
      } else if (screen === "reward") {
        autoPlayReward();
      } else {
        app.render();
        autoPlayNonCombatScreen(root);
      }
      app.render();
    }

    expect(getScreen()).toBe("run_summary");
    expect(gameState.run?.runStatus).toBe("lost");

    app.render();
    clickButton("Return to Main Menu");
    expect(getScreen()).toBe("main_menu");
    expect(gameState.run).toBeNull();
  }, 10_000);
});
