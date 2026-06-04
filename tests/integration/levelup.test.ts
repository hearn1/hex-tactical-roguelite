// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { setupDefaultRun } from "./helpers/seededRun.ts";
import { gameState, resetGameState, routeAfterXp } from "../../src/state/GameState.ts";
import { enqueuePendingLevelUps } from "../../src/run/LevelUp.ts";
import { applyMetaUpgradesToFreshRun } from "../../src/meta/Upgrades.ts";

describe("level-up choice screen (F29 / #60)", () => {
  beforeEach(() => resetGameState());
  afterEach(() => cleanup());

  it("a run-time level-up pauses at the choice screen and nothing applies until confirm", () => {
    setupDefaultRun();
    gameState.screen = "map";
    const guardian = gameState.run!.party[0];

    // Simulate a grant site: queue a level-up, then transition toward the map.
    enqueuePendingLevelUps(gameState.pendingLevelUps, guardian.instanceId, guardian.classId, [2]);
    routeAfterXp("map");
    expect(gameState.screen).toBe("levelup");

    const { app, root, getScreen, clickTestId } = mountApp();
    app.render();
    expect(root.querySelector('[data-testid="levelup-screen"]')).not.toBeNull();

    // Inspect-before-confirm: confirm is disabled and applies nothing until an option is chosen.
    const confirmBtn = root.querySelector('[data-testid="levelup-confirm"]') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    confirmBtn.click();
    expect(getScreen()).toBe("levelup");
    expect(guardian.levelUpChoiceIds ?? []).toEqual([]);

    // Choose Iron Stance and confirm → applies and returns to the originating screen.
    clickTestId("levelup-option-guardian.iron_stance");
    clickTestId("levelup-confirm");
    expect(getScreen()).toBe("map");
    expect(guardian.levelUpChoiceIds).toEqual(["guardian.iron_stance"]);
    expect(guardian.bonusStats.maxHp).toBe(2);
    expect(guardian.bonusStats.armor).toBe(1);
    expect(gameState.pendingLevelUps).toHaveLength(0);
  });

  it("a single grant crossing multiple thresholds resolves each level in order", () => {
    setupDefaultRun();
    gameState.screen = "map";
    const guardian = gameState.run!.party[0];

    enqueuePendingLevelUps(gameState.pendingLevelUps, guardian.instanceId, guardian.classId, [2, 3]);
    routeAfterXp("map");
    expect(gameState.screen).toBe("levelup");

    const { app, getScreen, clickTestId } = mountApp();
    app.render();

    // First level-up (L2): still on the screen with one more to resolve.
    clickTestId("levelup-option-guardian.pressing_strike");
    clickTestId("levelup-confirm");
    expect(getScreen()).toBe("levelup");
    expect(gameState.pendingLevelUps).toHaveLength(1);

    // Second level-up (L3): resolves and returns to the map.
    clickTestId("levelup-option-guardian.defenders_reach");
    clickTestId("levelup-confirm");
    expect(getScreen()).toBe("map");
    expect(guardian.levelUpChoiceIds).toEqual(["guardian.pressing_strike", "guardian.defenders_reach"]);
    expect(guardian.actionUpgrades?.["action.slash"]?.damageBonus).toBe(1);
    expect(guardian.bonusStats.might).toBe(1);
  });

  it("a won run still routes through level-up before the run summary", () => {
    setupDefaultRun();
    gameState.run!.runStatus = "won";
    const arc = gameState.run!.party[2];
    enqueuePendingLevelUps(gameState.pendingLevelUps, arc.instanceId, arc.classId, [2]);
    routeAfterXp(gameState.run!.runStatus === "won" ? "run_summary" : "map");
    expect(gameState.screen).toBe("levelup");

    const { app, getScreen, clickTestId } = mountApp();
    app.render();
    clickTestId("levelup-option-arcanist.ember_focus");
    clickTestId("levelup-confirm");
    expect(getScreen()).toBe("run_summary");
  });

  it("pre-run/meta starting XP applies defaults without opening the choice screen", () => {
    setupDefaultRun();
    gameState.screen = "setup";
    // Rank 2 of starting_xp grants 20 XP → level 2 for every hero.
    gameState.meta.upgradeRanks["upgrade.starting_xp"] = 2;

    applyMetaUpgradesToFreshRun(gameState.run!, gameState.meta);

    expect(gameState.pendingLevelUps).toHaveLength(0);
    expect(gameState.screen).toBe("setup");
    for (const pm of gameState.run!.party) {
      expect(pm.level).toBe(2);
      // Default = first L2 option for the class.
      expect((pm.levelUpChoiceIds ?? []).length).toBe(1);
    }
    // Guardian's default L2 is Iron Stance (+2 maxHp, +1 armor).
    expect(gameState.run!.party[0].levelUpChoiceIds).toEqual(["guardian.iron_stance"]);
  });
});
