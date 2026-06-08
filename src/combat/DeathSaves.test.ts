import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import type { UnitInstance, CombatState } from "../state/types.ts";
import {
  heroLifeState,
  isStandingHero,
  isDownedHero,
  isStableHero,
  isDeadForCombat,
  canAct,
  canBeHealed,
  isTargetableByEnemies,
  markHeroDowned,
  markHeroDead,
  clearDeathSavesOnHealing,
  handleUnitDroppedToZero,
  resolveDeathSaveTurn,
  DEATH_SAVE_TARGET,
  DEATH_SAVE_SUCCESSES_TO_STABILIZE,
  DEATH_SAVE_FAILURES_TO_DIE,
} from "./DeathSaves.ts";

function makeHero(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "hero_0",
    displayName: "Hero",
    team: "hero",
    defId: "class.guardian",
    level: 1,
    xp: 0,
    stats: { maxHp: 20, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
    hp: 20,
    pos: { q: 0, r: 0 },
    heroLifeState: "standing",
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "enemy_0",
    displayName: "Goblin",
    team: "enemy",
    defId: "enemy.goblin_skirmisher",
    level: 1,
    xp: 0,
    stats: { maxHp: 8, armor: 12, move: 4, str: 1, dex: 3, con: 0, int: 0, wis: 0, cha: 0 },
    hp: 8,
    pos: { q: 1, r: 0 },
    conditions: [],
    movePointsRemaining: 4,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeState(units: UnitInstance[]): CombatState {
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: units.map((u) => u.instanceId),
    units,
    log: [],
    status: "active",
    gridKeys: [],
    targetingActionId: null,
    perEncounterUses: {},
    bossTelegraph: null,
    encounterId: "encounter.goblin_ambush",
  };
}

describe("heroLifeState", () => {
  it("returns 'standing' for enemies regardless of heroLifeState field", () => {
    const e = makeEnemy();
    expect(heroLifeState(e)).toBe("standing");
  });

  it("returns 'standing' when hero has no heroLifeState set", () => {
    const h = makeHero({ heroLifeState: undefined });
    expect(heroLifeState(h)).toBe("standing");
  });

  it("returns the hero's explicit life state", () => {
    expect(heroLifeState(makeHero({ heroLifeState: "downed" }))).toBe("downed");
    expect(heroLifeState(makeHero({ heroLifeState: "stable" }))).toBe("stable");
    expect(heroLifeState(makeHero({ heroLifeState: "dead" }))).toBe("dead");
  });
});

describe("predicate helpers", () => {
  it("isStandingHero is true for standing heroes and all enemies", () => {
    expect(isStandingHero(makeHero())).toBe(true);
    expect(isStandingHero(makeHero({ heroLifeState: "downed" }))).toBe(false);
    // Enemies always map to "standing" â€” callers filter by team separately.
    expect(isStandingHero(makeEnemy())).toBe(true);
  });

  it("isDownedHero", () => {
    expect(isDownedHero(makeHero({ heroLifeState: "downed", hp: 0 }))).toBe(true);
    expect(isDownedHero(makeHero())).toBe(false);
  });

  it("isStableHero", () => {
    expect(isStableHero(makeHero({ heroLifeState: "stable", hp: 1 }))).toBe(true);
    expect(isStableHero(makeHero())).toBe(false);
  });

  it("isDeadForCombat", () => {
    expect(isDeadForCombat(makeHero({ heroLifeState: "dead", hp: 0 }))).toBe(true);
    expect(isDeadForCombat(makeHero())).toBe(false);
  });

  it("canAct: only standing heroes and living enemies can act", () => {
    expect(canAct(makeHero())).toBe(true);
    expect(canAct(makeHero({ heroLifeState: "downed", hp: 0 }))).toBe(false);
    expect(canAct(makeHero({ heroLifeState: "stable", hp: 1 }))).toBe(false);
    expect(canAct(makeHero({ heroLifeState: "dead", hp: 0 }))).toBe(false);
    expect(canAct(makeEnemy())).toBe(true);
    expect(canAct(makeEnemy({ hp: 0 }))).toBe(false);
  });

  it("canBeHealed: standing/downed/stable heroes can be healed; dead cannot", () => {
    expect(canBeHealed(makeHero())).toBe(true);
    expect(canBeHealed(makeHero({ heroLifeState: "downed", hp: 0 }))).toBe(true);
    expect(canBeHealed(makeHero({ heroLifeState: "stable", hp: 1 }))).toBe(true);
    expect(canBeHealed(makeHero({ heroLifeState: "dead", hp: 0 }))).toBe(false);
  });

  it("isTargetableByEnemies: only standing heroes are valid enemy targets", () => {
    expect(isTargetableByEnemies(makeHero())).toBe(true);
    expect(isTargetableByEnemies(makeHero({ heroLifeState: "downed", hp: 0 }))).toBe(false);
    expect(isTargetableByEnemies(makeHero({ heroLifeState: "stable", hp: 1 }))).toBe(false);
    expect(isTargetableByEnemies(makeHero({ heroLifeState: "dead", hp: 0 }))).toBe(false);
    expect(isTargetableByEnemies(makeEnemy())).toBe(false);
  });
});

describe("markHeroDowned", () => {
  it("transitions a standing hero to downed and initialises death saves", () => {
    const hero = makeHero({ hp: 0 });
    const state = makeState([hero]);
    markHeroDowned(hero, state);
    expect(hero.heroLifeState).toBe("downed");
    expect(hero.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(hero.hp).toBe(0);
    expect(state.log.some((e) => e.kind === "defeat")).toBe(true);
  });

  it("no-ops if hero is already downed", () => {
    const hero = makeHero({ heroLifeState: "downed", hp: 0, deathSaves: { successes: 1, failures: 0 } });
    const state = makeState([hero]);
    markHeroDowned(hero, state);
    expect(hero.deathSaves).toEqual({ successes: 1, failures: 0 });
  });

  it("no-ops for enemies", () => {
    const enemy = makeEnemy({ hp: 0 });
    const state = makeState([enemy]);
    markHeroDowned(enemy, state);
    expect(enemy.heroLifeState).toBeUndefined();
  });
});

describe("markHeroDead", () => {
  it("sets heroLifeState to dead and clears death saves", () => {
    const hero = makeHero({ heroLifeState: "downed", hp: 0, deathSaves: { successes: 0, failures: 3 } });
    const state = makeState([hero]);
    markHeroDead(hero, state);
    expect(hero.heroLifeState).toBe("dead");
    expect(hero.deathSaves).toBeUndefined();
    expect(state.log.some((e) => e.kind === "defeat")).toBe(true);
  });
});

describe("handleUnitDroppedToZero", () => {
  it("downs a hero at 0 HP", () => {
    const hero = makeHero({ hp: 0 });
    const state = makeState([hero]);
    handleUnitDroppedToZero(hero, state);
    expect(hero.heroLifeState).toBe("downed");
  });

  it("logs defeat for an enemy at 0 HP", () => {
    const enemy = makeEnemy({ hp: 0 });
    const state = makeState([enemy]);
    handleUnitDroppedToZero(enemy, state);
    expect(enemy.heroLifeState).toBeUndefined();
    expect(state.log.some((e) => e.kind === "defeat")).toBe(true);
  });

  it("no-ops if hp > 0", () => {
    const hero = makeHero({ hp: 5 });
    const state = makeState([hero]);
    handleUnitDroppedToZero(hero, state);
    expect(hero.heroLifeState).toBe("standing");
  });
});

describe("clearDeathSavesOnHealing", () => {
  it("restores a downed hero to standing when hp > 0", () => {
    const hero = makeHero({ heroLifeState: "downed", hp: 5, deathSaves: { successes: 1, failures: 1 } });
    const state = makeState([hero]);
    clearDeathSavesOnHealing(hero, state);
    expect(hero.heroLifeState).toBe("standing");
    expect(hero.deathSaves).toBeUndefined();
  });

  it("restores a stable hero to standing when hp > 0", () => {
    const hero = makeHero({ heroLifeState: "stable", hp: 3 });
    const state = makeState([hero]);
    clearDeathSavesOnHealing(hero, state);
    expect(hero.heroLifeState).toBe("standing");
  });

  it("no-ops for a downed hero still at 0 HP (not yet healed enough)", () => {
    const hero = makeHero({ heroLifeState: "downed", hp: 0 });
    const state = makeState([hero]);
    clearDeathSavesOnHealing(hero, state);
    expect(hero.heroLifeState).toBe("downed");
  });

  it("no-ops for standing heroes", () => {
    const hero = makeHero({ hp: 10 });
    const state = makeState([hero]);
    clearDeathSavesOnHealing(hero, state);
    expect(hero.heroLifeState).toBe("standing");
  });
});

describe("resolveDeathSaveTurn", () => {
  it("nat 20 revives the hero at 1 HP", () => {
    // createRng(seed) â€” find a seed that produces 20/20 on d20
    // We'll mock by constructing a fixed rng that returns 19/20 (= nat20 on d20)
    const rng = () => 19 / 20; // Math.floor(19/20 * 20) + 1 = Math.floor(19) + 1 = 20
    const hero = makeHero({ heroLifeState: "downed", hp: 0, deathSaves: { successes: 0, failures: 0 } });
    const state = makeState([hero]);
    const result = resolveDeathSaveTurn(hero, state, rng);
    expect(result).toBe("revived");
    expect(hero.hp).toBe(1);
    expect(hero.heroLifeState).toBe("standing");
  });

  it("nat 1 adds 2 failures", () => {
    const rng = () => 0; // Math.floor(0 * 20) + 1 = 1
    const hero = makeHero({ heroLifeState: "downed", hp: 0, deathSaves: { successes: 0, failures: 0 } });
    const state = makeState([hero]);
    const result = resolveDeathSaveTurn(hero, state, rng);
    expect(result).toBe("still_downed");
    expect(hero.deathSaves?.failures).toBe(2);
  });

  it(`roll >= ${DEATH_SAVE_TARGET} adds a success`, () => {
    const rng = () => (DEATH_SAVE_TARGET - 1) / 20; // exactly at threshold
    const hero = makeHero({ heroLifeState: "downed", hp: 0, deathSaves: { successes: 0, failures: 0 } });
    const state = makeState([hero]);
    const result = resolveDeathSaveTurn(hero, state, rng);
    expect(result).toBe("still_downed");
    expect(hero.deathSaves?.successes).toBe(1);
  });

  it(`${DEATH_SAVE_SUCCESSES_TO_STABILIZE} successes stabilises the hero`, () => {
    const rng = () => (DEATH_SAVE_TARGET - 1) / 20;
    const hero = makeHero({
      heroLifeState: "downed",
      hp: 0,
      deathSaves: { successes: DEATH_SAVE_SUCCESSES_TO_STABILIZE - 1, failures: 0 },
    });
    const state = makeState([hero]);
    const result = resolveDeathSaveTurn(hero, state, rng);
    expect(result).toBe("stable");
    expect(hero.heroLifeState).toBe("stable");
    expect(hero.hp).toBe(1);
  });

  it(`${DEATH_SAVE_FAILURES_TO_DIE} failures kills the hero`, () => {
    const rng = () => 0.1 / 20; // low roll â†’ failure
    const hero = makeHero({
      heroLifeState: "downed",
      hp: 0,
      deathSaves: { successes: 0, failures: DEATH_SAVE_FAILURES_TO_DIE - 1 },
    });
    const state = makeState([hero]);
    const result = resolveDeathSaveTurn(hero, state, rng);
    expect(result).toBe("dead");
    expect(hero.heroLifeState).toBe("dead");
  });

  it("no-ops for a standing hero", () => {
    const hero = makeHero();
    const state = makeState([hero]);
    const result = resolveDeathSaveTurn(hero, state, () => 0.5);
    expect(result).toBe("still_downed");
    expect(hero.heroLifeState).toBe("standing");
  });
});
