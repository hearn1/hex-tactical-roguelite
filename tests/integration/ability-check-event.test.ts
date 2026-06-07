// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { setupDefaultRun } from "./helpers/seededRun.ts";
import { gameState } from "../../src/state/GameState.ts";
import { resetEventScreenState } from "../../src/ui/screens/EventScreen.ts";

/** Force the event node to resolve to the crumbling-bridge check event before rendering. */
function forceBridgeEvent(): void {
  const run = gameState.run!;
  run.eventSelections[run.mapState.currentNodeId] = "event.crumbling_bridge";
  gameState.screen = "event";
}

describe("ability-check event flow (F23)", () => {
  beforeEach(() => {
    resetEventScreenState();
    setupDefaultRun();
  });

  afterEach(() => {
    cleanup();
  });

  it("routes a check choice to a picker showing DC, modifier, and roll-needed before committing", () => {
    const { app, root, clickTestId } = mountApp();
    forceBridgeEvent();
    app.render();

    clickTestId("event-choice-leap-across");

    const text = root.textContent ?? "";
    expect(text).toContain("Dexterity check");
    expect(text).toContain("DC 12");

    // Each living hero button shows its dexterity modifier and the number it must roll.
    const heroBtn = root.querySelector('[data-testid="check-hero-hero_001"]');
    expect(heroBtn).not.toBeNull();
    const label = heroBtn!.textContent ?? "";
    expect(label).toMatch(/Dexterity [+-]\d+/);
    expect(label).toMatch(/need \d+\+|auto|impossible/);
  });

  it("can back out of the picker before committing", () => {
    const { app, root, clickTestId, clickButton } = mountApp();
    forceBridgeEvent();
    app.render();

    clickTestId("event-choice-leap-across");
    clickButton("Cancel");

    // Back to the choice menu with both options visible.
    expect(root.querySelector('[data-testid="event-choice-leap-across"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="event-choice-take-the-long-way"]')).not.toBeNull();
  });

  it("resolves the chosen hero's check and logs the result line", () => {
    const { app, root, clickTestId } = mountApp();
    forceBridgeEvent();
    app.render();

    const goldBefore = gameState.run!.gold;

    clickTestId("event-choice-leap-across");
    clickTestId("check-hero-hero_001");

    const text = root.textContent ?? "";
    // Log line reports the d20, modifier, total, DC and an outcome.
    expect(text).toMatch(/Dexterity check: d20 \d+ [+-]\d+ = \d+ vs DC 12 — (Success|Partial success|Failure)\./);

    // An outcome branch ran: gold changed (success/partial) or a hero took damage (failure).
    const goldChanged = gameState.run!.gold !== goldBefore;
    const someoneHurt = gameState.run!.party.some((p) => p.hp < p.maxHp);
    expect(goldChanged || someoneHurt).toBe(true);
  });
});
