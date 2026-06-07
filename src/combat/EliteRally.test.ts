import { describe, it, expect } from "vitest";
import { resolveAction, RALLY_TO_HIT_BONUS, RALLY_DURATION } from "./Action.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import { getTraitTriggered } from "./Traits.ts";
import { processTurnStart } from "./Condition.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";

function makeUnit(
  overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex; defId: string },
): UnitInstance {
  return {
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    hp: 18,
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeEliteState(units: UnitInstance[], encounterId = "encounter.broken_banner_elite"): CombatState {
  const grid = hexesWithinRange({ q: 0, r: 0 }, 5);
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: units.map((u) => u.instanceId),
    units,
    log: [],
    status: "active",
    gridKeys: grid.map(hexKey),
    targetingActionId: null,
    perEncounterUses: {},
    encounterId,
    traitState: { actionRotationIndex: {}, triggered: {} },
  };
}

function makeHero(): UnitInstance {
  return makeUnit({
    instanceId: "hero_0",
    pos: { q: 1, r: 0 },
    defId: "class.guardian",
    hp: 100,
    stats: { maxHp: 100, armor: 10, move: 3, might: 20, agility: 1, spirit: 0 },
  });
}

function makeEnemy(id: string, hp: number, pos: Hex): UnitInstance {
  return makeUnit({
    instanceId: id,
    pos,
    defId: "enemy.goblin_skirmisher",
    team: "enemy",
    displayName: id,
    stats: { maxHp: 20, armor: 12, move: 4, might: 1, agility: 3, spirit: 0 },
    hp,
  });
}

describe("Elite Rally trait (F28 / #59)", () => {
  it("grants survivors the rallied bonus when the first elite member falls", () => {
    const hero = makeHero();
    const e1 = makeEnemy("e1", 1, { q: 2, r: 0 }); // about to die
    const e2 = makeEnemy("e2", 20, { q: 2, r: 1 });
    const e3 = makeEnemy("e3", 20, { q: 2, r: -1 });
    const state = makeEliteState([hero, e1, e2, e3]);

    const rng = () => 0.99; // ensure the hit lands
    resolveAction(ACTION_REGISTRY["action.slash"], hero, e1, state, rng);

    expect(e1.hp).toBe(0);
    expect(getTraitTriggered(state, "encounter:elite_rally_on_first_death")).toBe(true);
    expect(e2.conditions.some((c) => c.id === "rallied" && c.remainingTurns === RALLY_DURATION)).toBe(true);
    expect(e3.conditions.some((c) => c.id === "rallied")).toBe(true);
    expect(state.log.some((l) => l.text.includes("Rally"))).toBe(true);
  });

  it("does not re-trigger on subsequent elite deaths", () => {
    const hero = makeHero();
    const e1 = makeEnemy("e1", 1, { q: 2, r: 0 });
    const e2 = makeEnemy("e2", 1, { q: 2, r: 1 });
    const state = makeEliteState([hero, e1, e2]);
    const rng = () => 0.99;

    resolveAction(ACTION_REGISTRY["action.slash"], hero, e1, state, rng);
    expect(getTraitTriggered(state, "encounter:elite_rally_on_first_death")).toBe(true);
    // Clear logs and kill the second enemy — no second Rally line should appear.
    const logLenBefore = state.log.length;
    resolveAction(ACTION_REGISTRY["action.slash"], hero, e2, state, rng);
    const newRallyLogs = state.log
      .slice(logLenBefore)
      .filter((l) => l.text.includes("the survivors Rally"));
    expect(newRallyLogs.length).toBe(0);
  });

  it("does not fire for non-elite encounters", () => {
    const hero = makeHero();
    const e1 = makeEnemy("e1", 1, { q: 2, r: 0 });
    const e2 = makeEnemy("e2", 20, { q: 2, r: 1 });
    const state = makeEliteState([hero, e1, e2], "encounter.road_ambush");
    const rng = () => 0.99;

    resolveAction(ACTION_REGISTRY["action.slash"], hero, e1, state, rng);

    expect(e2.conditions.some((c) => c.id === "rallied")).toBe(false);
    expect(state.log.some((l) => l.text.includes("Rally"))).toBe(false);
  });

  it("rallied bonus improves the survivor's to-hit and expires after its duration", () => {
    // An enemy that would miss without Rally lands the hit with it.
    const enemy = makeEnemy("e2", 20, { q: 1, r: 0 });
    enemy.conditions = [{ id: "rallied", remainingTurns: RALLY_DURATION }];
    const hero = makeUnit({
      instanceId: "hero_0",
      pos: { q: 2, r: 0 },
      defId: "class.guardian",
      hp: 50,
      // Armor tuned so the attack only connects thanks to the +RALLY_TO_HIT_BONUS.
      stats: { maxHp: 50, armor: 12, move: 3, might: 0, agility: 0, spirit: 0 },
    });
    const state = makeEliteState([hero, enemy]);

    // rusty_stab uses might (1) + proficiency (2) = 3 fixed. d20 for rng()=0.3 is 7.
    // Without rally: 7 + 3 = 10 < armor 12 → miss. With rally +2: 12 ≥ 12 → hit.
    const rng = () => 0.3;
    const hpBefore = hero.hp;
    resolveAction(ACTION_REGISTRY["action.rusty_stab"], enemy, hero, state, rng);
    expect(hero.hp).toBeLessThan(hpBefore); // landed thanks to rally

    // Rally persists (not consumed) and counts down via processTurnStart.
    expect(enemy.conditions.some((c) => c.id === "rallied")).toBe(true);
    processTurnStart(enemy);
    expect(enemy.conditions.find((c) => c.id === "rallied")!.remainingTurns).toBe(RALLY_DURATION - 1);
    processTurnStart(enemy);
    expect(enemy.conditions.some((c) => c.id === "rallied")).toBe(false);
  });
});
