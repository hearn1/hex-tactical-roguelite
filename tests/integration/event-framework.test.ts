// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { setupDefaultRun } from "./helpers/seededRun.ts";
import { gameState } from "../../src/state/GameState.ts";
import { resetEventScreenState } from "../../src/ui/screens/EventScreen.ts";
import { EVENT_REGISTRY } from "../../src/data/events.ts";

const FIXTURE_ID = "event.test_fixture";

/**
 * A brand-new event defined purely in data — added to EVENT_REGISTRY at runtime to prove the
 * screen needs no per-event code. Exercises a `buff` effect, a hero-pick effect, and a
 * requirement-gated choice.
 */
function installFixtureEvent(): void {
  EVENT_REGISTRY[FIXTURE_ID] = {
    id: FIXTURE_ID,
    title: "Test Fixture",
    description: "A data-only adventure scene.",
    choices: [
      {
        id: "event.test_fixture.bribe",
        label: "Bribe the warden",
        description: "Pay 500 gold to pass.",
        effects: [{ type: "noop" }],
        requirements: [{ type: "minGold", amount: 500 }],
      },
      {
        id: "event.test_fixture.blessing",
        label: "Accept the blessing",
        description: "Gain a run-long boon.",
        effects: [{ type: "buff", modifier: { kind: "global_stat", stat: "might", value: 1 } }],
      },
      {
        id: "event.test_fixture.pray",
        label: "Pray at the altar",
        description: "One hero gains Spirit.",
        effects: [{ type: "stat_boost", stat: "spirit", amount: 1 }],
      },
    ],
  };
}

function forceFixtureEvent(): void {
  const run = gameState.run!;
  run.eventSelections[run.mapState.currentNodeId] = FIXTURE_ID;
  gameState.screen = "event";
}

describe("expanded event framework (F24)", () => {
  beforeEach(() => {
    resetEventScreenState();
    setupDefaultRun(); // 30 gold
    installFixtureEvent();
  });

  afterEach(() => {
    cleanup();
    delete EVENT_REGISTRY[FIXTURE_ID];
  });

  it("renders a requirement-gated choice disabled with its reason, and ignores clicks", () => {
    const { app, root, clickTestId } = mountApp();
    forceFixtureEvent();
    app.render();

    const bribe = root.querySelector('[data-testid="event-choice-bribe-the-warden"]')!;
    expect(bribe).not.toBeNull();
    expect(bribe.getAttribute("data-disabled")).toBe("true");
    expect(bribe.textContent).toContain("Requires 500 gold");

    // Clicking the disabled choice does nothing: we stay on the menu (choices still visible).
    clickTestId("event-choice-bribe-the-warden");
    expect(root.querySelector('[data-testid="event-choice-accept-the-blessing"]')).not.toBeNull();
    expect(gameState.run!.runModifiers).toHaveLength(0);
  });

  it("plays a brand-new data-only event end-to-end with no screen edits (buff effect)", () => {
    const { app, root, clickTestId, clickButton } = mountApp();
    forceFixtureEvent();
    app.render();

    clickTestId("event-choice-accept-the-blessing");

    // Result phase shows a mechanical log line and the modifier landed on the run.
    expect(root.textContent).toContain("might");
    expect(gameState.run!.runModifiers).toEqual([{ kind: "global_stat", stat: "might", value: 1 }]);

    clickButton("Continue");
    expect(gameState.screen).toBe("map");
  });

  it("routes a hero-pick effect through the picker and applies it to the chosen hero", () => {
    const { app, root, clickTestId } = mountApp();
    forceFixtureEvent();
    app.render();

    clickTestId("event-choice-pray-at-the-altar");
    // Picker appears with a button per hero.
    const heroId = gameState.run!.party[1].instanceId;
    expect(root.querySelector(`[data-testid="event-hero-${heroId}"]`)).not.toBeNull();

    clickTestId(`event-hero-${heroId}`);
    expect(gameState.run!.party[1].bonusStats.spirit).toBe(1);
    expect(gameState.run!.party[0].bonusStats.spirit ?? 0).toBe(0);
  });

  it("applies an effect exactly once even if the screen re-renders", () => {
    const { app, clickTestId } = mountApp();
    forceFixtureEvent();
    app.render();

    clickTestId("event-choice-accept-the-blessing");
    expect(gameState.run!.runModifiers).toHaveLength(1);

    // Re-rendering the result phase must not re-apply the effect (inherits #69 fix).
    app.render();
    app.render();
    expect(gameState.run!.runModifiers).toHaveLength(1);
  });
});
