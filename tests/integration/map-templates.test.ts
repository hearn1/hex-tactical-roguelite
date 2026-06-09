// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest";

// Prevent Three.js geometry allocation on every app.render() during combat.
// Each render creates a new CombatScreen → new CombatThreeRenderer(), which
// allocates PlaneGeometry/SphereGeometry/etc. as class-field initializers
// before assertWebGLAvailable() can throw. Across thousands of renders in a
// full playthrough, this exhausts worker memory. The stub throws immediately
// with no Three.js allocations, keeping the existing 2D canvas fallback path.
vi.mock("../../src/render/combat3d/CombatThreeRenderer.ts", () => ({
  CombatThreeRenderer: class {
    constructor() {
      throw new Error("WebGL unavailable (test stub)");
    }
  },
}));
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { gameState, resetGameState } from "../../src/state/GameState.ts";
import { autoPlayCombat, autoPlayMapNode, autoPlayReward, autoPlayNonCombatScreen } from "./helpers/autoPlay.ts";
import { buildParty, defaultPartySpecs, createRunState } from "../../src/run/PartySetup.ts";
import { MAP_TEMPLATES } from "../../src/data/nodes.ts";

function runFullFlow(mounted: ReturnType<typeof mountApp>, safetyLimit: number): number {
  const { app, getScreen, root } = mounted;
  let safety = 0;
  while (getScreen() !== "run_summary" && safety < safetyLimit) {
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
  return safety;
}

describe("map templates full runs", () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    ["short", 12345],
    ["long", 12345],
    ["long", 54321],
  ])("completes a full %s-template run (seed=%i)", (templateId, seed) => {
    const mounted = mountApp();
    resetGameState(seed);
    const run = createRunState(buildParty(defaultPartySpecs()), "normal", templateId);
    expect(run.mapTemplateId).toBe(templateId);
    expect(run.mapState.currentNodeId).toBe(MAP_TEMPLATES[templateId].startNodeId);
    gameState.run = run;
    gameState.screen = "map";
    mounted.app.render();

    const safety = runFullFlow(mounted, 80);

    expect(safety).toBeLessThan(80);
    expect(mounted.getScreen()).toBe("run_summary");
    // A victorious long run resolves more nodes than the short prototype.
    expect(gameState.run?.mapState.nodesCleared).toBeGreaterThan(0);
    if (gameState.run?.runStatus === "won") {
      expect(gameState.run.mapState.bossDefeated).toBe(true);
      if (templateId === "long") {
        expect(gameState.run.mapState.nodesCleared).toBeGreaterThanOrEqual(6);
      }
    }
  }, 25_000);
});
