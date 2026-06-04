// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountApp, cleanup } from "./helpers/mountApp.ts";
import { setupDefaultRun } from "./helpers/seededRun.ts";
import { gameState } from "../../src/state/GameState.ts";
import { resetEventScreenState } from "../../src/ui/screens/EventScreen.ts";

/** Pin a specific pack event to the current node, then open the event screen. */
function forceEvent(eventId: string): void {
  const run = gameState.run!;
  run.eventSelections[run.mapState.currentNodeId] = eventId;
  gameState.screen = "event";
}

/** Force the next d20 to a fixed face (1..20) so check outcomes are deterministic. */
function forceRoll(face: number): void {
  gameState.rng = () => (face - 1) / 20;
}

describe("event content pack — end-to-end through the F24 screen (no per-event code)", () => {
  beforeEach(() => {
    resetEventScreenState();
    setupDefaultRun(); // guardian/acolyte/arcanist, 30 gold
  });

  afterEach(() => {
    cleanup();
  });

  it("Glassroot Thicket: a successful Agility check yields 2 potions and logs the roll", () => {
    const { app, root, clickTestId } = mountApp();
    forceEvent("event.glassroot_thicket");
    app.render();

    clickTestId("event-choice-harvest-carefully");
    forceRoll(20); // auto-success against DC 12
    clickTestId("check-hero-hero_001");

    expect(root.textContent).toContain("Agility check");
    expect(gameState.run!.inventory.potions.filter((p) => p === "potion.healing")).toHaveLength(2);
  });

  it("Glassroot Thicket: a failed Agility check damages a hero", () => {
    const { app, root, clickTestId } = mountApp();
    forceEvent("event.glassroot_thicket");
    app.render();

    const before = gameState.run!.party.reduce((s, p) => s + p.hp, 0);
    clickTestId("event-choice-harvest-carefully");
    forceRoll(1); // auto-failure
    clickTestId("check-hero-hero_001");

    expect(root.textContent).toContain("Failure");
    const after = gameState.run!.party.reduce((s, p) => s + p.hp, 0);
    expect(after).toBe(before - 4);
  });

  it("Whispering Milestone: a successful check grants the attempting hero +1 Spirit", () => {
    const { app, clickTestId } = mountApp();
    forceEvent("event.whispering_milestone");
    app.render();

    clickTestId("event-choice-let-one-hero-listen");
    forceRoll(20);
    // Acolyte (hero_002) attempts the Spirit check.
    clickTestId("check-hero-hero_002");

    expect(gameState.run!.party[1].bonusStats.spirit).toBe(1);
    expect(gameState.run!.party[0].bonusStats.spirit ?? 0).toBe(0);
  });

  it("Ashen Star Shrine: the offering choice is gated by gold and spends it on a stat boost", () => {
    const { app, root, clickTestId } = mountApp();
    gameState.run!.gold = 10; // below the 20-gold offering cost
    forceEvent("event.ashen_star_shrine");
    app.render();

    const offer = root.querySelector('[data-testid="event-choice-offer-coin-for-might"]')!;
    expect(offer.getAttribute("data-disabled")).toBe("true");
    expect(offer.textContent).toContain("Requires 20 gold");

    // Afford it, then commit: gold is spent and the chosen hero gains +1 Might.
    gameState.run!.gold = 25;
    app.render();
    clickTestId("event-choice-offer-coin-for-might");
    clickTestId("event-hero-hero_001");

    expect(gameState.run!.gold).toBe(5);
    expect(gameState.run!.party[0].bonusStats.might).toBe(1);
  });

  it("Old Drill Ring: 'Drill Together' grants party-wide XP with no hero pick", () => {
    const { app, clickTestId } = mountApp();
    forceEvent("event.old_drill_ring");
    app.render();

    clickTestId("event-choice-drill-together");
    for (const pm of gameState.run!.party) {
      expect(pm.xp).toBe(7);
    }
  });
});
