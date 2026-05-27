// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { gameState, resetGameState } from "../../src/state/GameState.ts";
import { autoPlayCombat, autoPlayMapNode, autoPlayReward, autoPlayNonCombatScreen } from "./helpers/autoPlay.ts";
import { setupLowHealthRun } from "./helpers/seededRun.ts";

function runFullFlow(mounted: ReturnType<typeof mountApp>): void {
  const { app, getScreen, root } = mounted;
  let safety = 0;
  while (getScreen() !== "run_summary" && safety < 30) {
    safety++;
    const screen = getScreen();

    if (screen === "map") {
      autoPlayMapNode(app);
    } else if (screen === "combat") {
      autoPlayCombat(app);
    } else if (screen === "reward") {
      autoPlayReward(app);
    } else {
      app.render();
      autoPlayNonCombatScreen(root);
      app.render();
    }
  }
}

describe("playthrough", () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    cleanup();
  });

  it.each([12345, 54321, 99999, 11111, 77777])(
    "seeded run (seed=%i) completes full flow and returns to main menu",
    (seed) => {
      const mounted = mountApp();
      const { app, getScreen, clickButton, root } = mounted;
      resetGameState(seed);
      gameState.screen = "main_menu";
      app.render();

      clickButton("New Run");
      expect(getScreen()).toBe("map");

      runFullFlow(mounted);

      expect(getScreen()).toBe("run_summary");
      expect(gameState.run?.runStatus).toBeTruthy();

      app.render();
      clickButton("Return to Main Menu");
      expect(getScreen()).toBe("main_menu");
      expect(gameState.run).toBeNull();
    },
    25_000,
  );

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
        autoPlayMapNode(app);
      } else if (screen === "combat") {
        autoPlayCombat(app);
      } else if (screen === "reward") {
        autoPlayReward(app);
      } else {
        app.render();
        autoPlayNonCombatScreen(root);
        app.render();
      }
    }

    expect(safety).toBeLessThan(10);
    expect(getScreen()).toBe("run_summary");
    expect(gameState.run?.runStatus).toBe("lost");

    app.render();
    clickButton("Return to Main Menu");
    expect(getScreen()).toBe("main_menu");
    expect(gameState.run).toBeNull();
  }, 10_000);
});
