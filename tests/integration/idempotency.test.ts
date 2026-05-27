// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { gameState, resetGameState } from "../../src/state/GameState.ts";
import { setupWonRun } from "./helpers/seededRun.ts";

describe("idempotency", () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    cleanup();
  });

  it("RunSummary.render() called twice does not double-award renown", () => {
    const { app } = mountApp();
    setupWonRun();
    gameState.screen = "run_summary";

    const before = gameState.meta.renown;
    app.render();
    const afterFirst = gameState.meta.renown;
    app.render();
    expect(gameState.meta.renown).toBe(afterFirst);
    expect(afterFirst).toBeGreaterThan(before);
  });

  it("RunSummary.render() called twice does not double-increment completedRuns", () => {
    const { app } = mountApp();
    setupWonRun();
    gameState.screen = "run_summary";

    const before = gameState.meta.completedRuns;
    app.render();
    const afterFirst = gameState.meta.completedRuns;
    app.render();
    expect(gameState.meta.completedRuns).toBe(afterFirst);
    expect(afterFirst).toBe(before + 1);
  });

  it("MainMenu.render() called twice does not create duplicate DOM", () => {
    const { app, root } = mountApp();
    gameState.screen = "main_menu";
    app.render();
    app.render();
    const buttons = root.querySelectorAll("button");
    const newRunBtns = Array.from(buttons).filter((b) => b.textContent?.trim() === "New Run");
    expect(newRunBtns.length).toBe(1);
  });
});
