// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { gameState, resetGameState } from "../../src/state/GameState.ts";
import { initCombatState } from "../../src/state/GameState.ts";
import { setupDefaultRun, setupWonRun } from "./helpers/seededRun.ts";

describe("screen-smoke", () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    cleanup();
  });

  it("main_menu renders without throwing", () => {
    const { app } = mountApp();
    gameState.screen = "main_menu";
    expect(() => app.render()).not.toThrow();
  });

  it("meta_upgrades renders without throwing", () => {
    const { app } = mountApp();
    gameState.screen = "meta_upgrades";
    expect(() => app.render()).not.toThrow();
  });

  it("map renders without throwing with an active run", () => {
    const { app } = mountApp();
    setupDefaultRun();
    gameState.screen = "map";
    expect(() => app.render()).not.toThrow();
  });

  it("combat renders without throwing", () => {
    const { app } = mountApp();
    gameState.screen = "combat";
    gameState.combat = initCombatState(gameState.rng);
    expect(() => app.render()).not.toThrow();
  });

  it("reward renders without throwing after combat", () => {
    const { app } = mountApp();
    setupDefaultRun();
    gameState.combat = initCombatState(gameState.rng);
    gameState.screen = "reward";
    expect(() => app.render()).not.toThrow();
  });

  it("shop renders without throwing with an active run", () => {
    const { app } = mountApp();
    setupDefaultRun();
    gameState.screen = "shop";
    expect(() => app.render()).not.toThrow();
  });

  it("camp renders without throwing with an active run", () => {
    const { app } = mountApp();
    setupDefaultRun();
    gameState.screen = "camp";
    expect(() => app.render()).not.toThrow();
  });

  it("event renders without throwing with an active run", () => {
    const { app } = mountApp();
    setupDefaultRun();
    gameState.screen = "event";
    expect(() => app.render()).not.toThrow();
  });

  it("recruit renders without throwing with an active run", () => {
    const { app } = mountApp();
    setupDefaultRun();
    gameState.screen = "recruit";
    expect(() => app.render()).not.toThrow();
  });

  it("pet renders without throwing with an active run", () => {
    const { app } = mountApp();
    setupDefaultRun();
    gameState.screen = "pet";
    expect(() => app.render()).not.toThrow();
  });

  it("run_summary renders without throwing (won)", () => {
    const { app } = mountApp();
    setupWonRun();
    gameState.screen = "run_summary";
    expect(() => app.render()).not.toThrow();
  });
});
