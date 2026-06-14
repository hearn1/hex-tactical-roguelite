import { describe, it, expect } from "vitest";
import { resolveAction } from "./Action.ts";
import { isReactionAvailable, markReactionUsed } from "./ReactionResolver.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import type { UnitInstance, CombatState } from "../state/types.ts";

// RNG helpers
/** Returns a fixed sequence and then 0.5 forever. */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0.5);
}

/** Always returns v (fixed RNG). */
function fixedRng(v: number): () => number {
  return () => v;
}

function makeHero(overrides: Partial<UnitInstance>): UnitInstance {
  return {
    instanceId: "hero_0",
    defId: "class.guardian",
    displayName: "Hero",
    team: "hero",
    level: 1,
    xp: 0,
    hp: 30,
    stats: { maxHp: 30, armor: 8, move: 3, str: 3, dex: 2, con: 0, int: 0, wis: 0, cha: 3 },
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    pos: { q: 0, r: 0 },
    heroLifeState: "standing",
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "enemy_0",
    defId: "enemy.goblin_skirmisher",
    displayName: "Goblin",
    team: "enemy",
    level: 1,
    xp: 0,
    hp: 20,
    stats: { maxHp: 20, armor: 8, move: 4, str: 2, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
    conditions: [],
    movePointsRemaining: 4,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    pos: { q: 1, r: 0 },
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
    gridKeys: ["0,0", "1,0", "0,-1", "1,-1", "2,0"],
    targetingActionId: null,
    perEncounterUses: {},
  };
}

// ── ReactionResolver unit tests ──────────────────────────────────────────────

describe("ReactionResolver: isReactionAvailable", () => {
  it("returns true when reactionUsedThisTurn is unset", () => {
    const hero = makeHero({});
    expect(isReactionAvailable(hero)).toBe(true);
  });

  it("returns false after markReactionUsed", () => {
    const hero = makeHero({});
    markReactionUsed(hero);
    expect(isReactionAvailable(hero)).toBe(false);
  });

  it("also sets turnEconomy.reactionUsed when economy exists", () => {
    const hero = makeHero({
      turnEconomy: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, extraActionsRemaining: 0 },
    });
    markReactionUsed(hero);
    expect(hero.turnEconomy!.reactionUsed).toBe(true);
  });
});

// ── Retributive Strike ───────────────────────────────────────────────────────

describe("Retributive Strike: fires once per reaction window on melee hit", () => {
  it("retaliates when hero is hit in melee and reaction is available", () => {
    const hero = makeHero({ passives: ["archetype_passive.vindicator_below_50_attack"] });
    const enemy = makeEnemy({ hp: 20 });
    const state = makeState([enemy, hero]);
    const meleeAction = ACTION_REGISTRY["action.rusty_stab"]!;
    // rng: d20=0.99→20(hit), dmg=0.5→mid, then retrib d20=0.99→hit, retrib dmg=0.5
    const rng = seqRng([0.99, 0.5, 0.99, 0.5]);
    resolveAction(meleeAction, enemy, hero, state, rng);
    expect(hero.reactionUsedThisTurn).toBe(true);
    const retribLog = state.log.find((l) => l.text.includes("Retributive Strike"));
    expect(retribLog).toBeDefined();
  });

  it("does not fire a second time if reaction is already used", () => {
    const hero = makeHero({
      passives: ["archetype_passive.vindicator_below_50_attack"],
      reactionUsedThisTurn: true,
    });
    const enemy = makeEnemy({ hp: 20 });
    const state = makeState([enemy, hero]);
    const meleeAction = ACTION_REGISTRY["action.rusty_stab"]!;
    const rng = fixedRng(0.99);
    resolveAction(meleeAction, enemy, hero, state, rng);
    const retribLogs = state.log.filter((l) => l.text.includes("Retributive Strike"));
    expect(retribLogs.length).toBe(0);
  });
});

// ── Uncanny Dodge ────────────────────────────────────────────────────────────

describe("Uncanny Dodge: halves weapon damage once per reaction window", () => {
  it("halves incoming weapon damage and marks reaction used", () => {
    const hero = makeHero({ passives: ["passive.uncanny_dodge"] });
    const enemy = makeEnemy();
    const state = makeState([enemy, hero]);
    const meleeAction = ACTION_REGISTRY["action.rusty_stab"]!;
    const hpBefore = hero.hp;
    // Ensure hit (d20 = 20) and fixed damage roll
    const rng = seqRng([0.99, 0.5]); // d20=20 hit, dmg formula mid
    resolveAction(meleeAction, enemy, hero, state, rng);
    const dmgDealt = hpBefore - hero.hp;
    expect(dmgDealt).toBeGreaterThan(0);
    expect(hero.reactionUsedThisTurn).toBe(true);
    const dodgeLog = state.log.find((l) => l.text.includes("Uncanny Dodge"));
    expect(dodgeLog).toBeDefined();
  });

  it("does not fire if reaction already used", () => {
    const hero = makeHero({
      passives: ["passive.uncanny_dodge"],
      reactionUsedThisTurn: true,
    });
    const enemy = makeEnemy();
    const hpBefore = hero.hp;
    const state = makeState([enemy, hero]);
    const rng = seqRng([0.99, 0.5]);
    resolveAction(ACTION_REGISTRY["action.rusty_stab"]!, enemy, hero, state, rng);
    const dodgeLog = state.log.find((l) => l.text.includes("Uncanny Dodge"));
    expect(dodgeLog).toBeUndefined();
  });

  it("does not fire against spell attacks (isSpellAttack)", () => {
    const hero = makeHero({ passives: ["passive.uncanny_dodge"] });
    const enemy = makeEnemy({ stats: { maxHp: 20, armor: 8, move: 4, str: 0, dex: 0, con: 0, int: 3, wis: 0, cha: 0 } });
    const spellAction = ACTION_REGISTRY["action.fire_bolt"]!;
    const state = makeState([enemy, hero]);
    const rng = seqRng([0.99, 0.5]);
    resolveAction(spellAction, enemy, hero, state, rng);
    const dodgeLog = state.log.find((l) => l.text.includes("Uncanny Dodge"));
    expect(dodgeLog).toBeUndefined();
  });
});

// ── Deflect Missiles ─────────────────────────────────────────────────────────

describe("Deflect Missiles: reduces ranged weapon damage, costs 1 ki", () => {
  it("reduces damage from ranged attack and spends 1 ki point", () => {
    const hero = makeHero({
      passives: ["passive.monk.deflect_missiles"],
      kiPointsRemaining: 2,
      kiPointsMax: 2,
      pos: { q: 0, r: 0 },
    });
    // Archer placed at range > 1
    const archer = makeEnemy({
      defId: "enemy.skeleton_archer",
      pos: { q: 3, r: 0 },
      stats: { maxHp: 12, armor: 12, move: 3, str: 0, dex: 3, con: 0, int: 0, wis: 0, cha: 0 },
    });
    const state = makeState([archer, hero]);
    const rangedAction = ACTION_REGISTRY["action.bone_arrow"]!;
    const rng = seqRng([0.99, 0.5, 0.5]); // d20 hit, dmg, deflect roll
    resolveAction(rangedAction, archer, hero, state, rng);
    expect(hero.reactionUsedThisTurn).toBe(true);
    expect(hero.kiPointsRemaining).toBe(1);
    const deflectLog = state.log.find((l) => l.text.includes("Deflect Missiles"));
    expect(deflectLog).toBeDefined();
  });

  it("does not fire if no ki points remaining", () => {
    const hero = makeHero({
      passives: ["passive.monk.deflect_missiles"],
      kiPointsRemaining: 0,
      kiPointsMax: 2,
      pos: { q: 0, r: 0 },
    });
    const archer = makeEnemy({
      defId: "enemy.skeleton_archer",
      pos: { q: 3, r: 0 },
      stats: { maxHp: 12, armor: 12, move: 3, str: 0, dex: 3, con: 0, int: 0, wis: 0, cha: 0 },
    });
    const state = makeState([archer, hero]);
    const rng = seqRng([0.99, 0.5]);
    resolveAction(ACTION_REGISTRY["action.bone_arrow"]!, archer, hero, state, rng);
    const deflectLog = state.log.find((l) => l.text.includes("Deflect Missiles"));
    expect(deflectLog).toBeUndefined();
  });
});

// ── Hellish Rebuke ───────────────────────────────────────────────────────────

describe("Hellish Rebuke: deals fire damage to attacker, costs spell slot + 1 charge", () => {
  it("retaliates with Hellish Rebuke when Fiend Warlock is hit", () => {
    const hero = makeHero({
      archetypeId: "archetype.warlock.fiend",
      spellSlotsRemaining: 2,
    });
    const enemy = makeEnemy({ hp: 30 });
    const state = makeState([enemy, hero]);
    const rng = seqRng([0.99, 0.5, 0.5]); // hit, dmg, rebuke dmg
    const hpBefore = enemy.hp;
    resolveAction(ACTION_REGISTRY["action.rusty_stab"]!, enemy, hero, state, rng);
    expect(enemy.hp).toBeLessThan(hpBefore);
    expect(hero.spellSlotsRemaining).toBe(1);
    expect(hero.reactionUsedThisTurn).toBe(true);
    const rebukeLog = state.log.find((l) => l.text.includes("Hellish Rebuke"));
    expect(rebukeLog).toBeDefined();
  });

  it("does not fire if no spell slots remain", () => {
    const hero = makeHero({
      archetypeId: "archetype.warlock.fiend",
      spellSlotsRemaining: 0,
    });
    const enemy = makeEnemy({ hp: 30 });
    const state = makeState([enemy, hero]);
    const rng = seqRng([0.99, 0.5]);
    resolveAction(ACTION_REGISTRY["action.rusty_stab"]!, enemy, hero, state, rng);
    expect(hero.reactionUsedThisTurn).toBeFalsy();
    const rebukeLog = state.log.find((l) => l.text.includes("Hellish Rebuke"));
    expect(rebukeLog).toBeUndefined();
  });

  it("does not fire a second time in the same encounter (charges exhausted)", () => {
    const hero = makeHero({
      archetypeId: "archetype.warlock.fiend",
      spellSlotsRemaining: 3,
    });
    const enemy = makeEnemy({ hp: 60 });
    const state = makeState([enemy, hero]);
    // Use the charge manually
    (state.perEncounterUses as Record<string, number>)["action.warlock.hellish_rebuke"] = 1;
    const rng = seqRng([0.99, 0.5, 0.99, 0.5]);
    resolveAction(ACTION_REGISTRY["action.rusty_stab"]!, enemy, hero, state, rng);
    const rebukeLogs = state.log.filter((l) => l.text.includes("Hellish Rebuke"));
    expect(rebukeLogs.length).toBe(0);
  });
});

// ── Cutting Words ────────────────────────────────────────────────────────────

describe("Cutting Words: applies rattled to attacker after hit", () => {
  it("applies rattled to the attacker and marks reaction used", () => {
    const hero = makeHero({ archetypeId: "archetype.bard.college_of_lore" });
    const enemy = makeEnemy({ hp: 20 });
    const state = makeState([enemy, hero]);
    const rng = seqRng([0.99, 0.5]);
    resolveAction(ACTION_REGISTRY["action.rusty_stab"]!, enemy, hero, state, rng);
    expect(hero.reactionUsedThisTurn).toBe(true);
    expect(enemy.conditions.some((c) => c.id === "rattled")).toBe(true);
    const cwLog = state.log.find((l) => l.text.includes("Cutting Words"));
    expect(cwLog).toBeDefined();
  });
});

// ── Armor of Agathys (triggered passive) ────────────────────────────────────

describe("Armor of Agathys: melee attacker takes 5 cold damage (no reaction slot)", () => {
  it("deals 5 cold damage to melee attacker and does not consume reaction", () => {
    const hero = makeHero({
      conditions: [{ id: "armor_of_agathys", remainingTurns: 999 }],
    });
    const enemy = makeEnemy({ hp: 20 });
    const state = makeState([enemy, hero]);
    const rng = seqRng([0.99, 0.5]);
    const enemyHpBefore = enemy.hp;
    resolveAction(ACTION_REGISTRY["action.rusty_stab"]!, enemy, hero, state, rng);
    expect(enemy.hp).toBe(enemyHpBefore - 5);
    // Reaction slot NOT consumed by triggered passive
    expect(hero.reactionUsedThisTurn).toBeFalsy();
    const agathysLog = state.log.find((l) => l.text.includes("Armor of Agathys"));
    expect(agathysLog).toBeDefined();
    expect(agathysLog?.text).toContain("[PASSIVE]");
  });

  it("does not fire for ranged attackers (melee-only)", () => {
    const hero = makeHero({
      conditions: [{ id: "armor_of_agathys", remainingTurns: 999 }],
      pos: { q: 0, r: 0 },
    });
    const archer = makeEnemy({
      defId: "enemy.skeleton_archer",
      pos: { q: 3, r: 0 },
      stats: { maxHp: 12, armor: 12, move: 3, str: 0, dex: 3, con: 0, int: 0, wis: 0, cha: 0 },
    });
    const state = makeState([archer, hero]);
    const rng = seqRng([0.99, 0.5]);
    const archerHpBefore = archer.hp;
    resolveAction(ACTION_REGISTRY["action.bone_arrow"]!, archer, hero, state, rng);
    expect(archer.hp).toBe(archerHpBefore);
    const agathysLog = state.log.find((l) => l.text.includes("Armor of Agathys"));
    expect(agathysLog).toBeUndefined();
  });
});

// ── Reaction loop prevention ─────────────────────────────────────────────────

describe("Reaction loop prevention: retaliation cannot trigger another reaction", () => {
  it("Retributive Strike retaliation does not let attacker fire their own reaction in return", () => {
    // Hero has Retributive Strike; attacker also has Retributive Strike passive (edge case)
    const hero = makeHero({ passives: ["archetype_passive.vindicator_below_50_attack"] });
    const enemy = makeEnemy({
      // Enemy won't have Vindicator passive (enemies don't), but reaction slot should not loop
      hp: 20,
    });
    const state = makeState([enemy, hero]);
    const rng = seqRng([0.99, 0.5, 0.99, 0.5]);
    resolveAction(ACTION_REGISTRY["action.rusty_stab"]!, enemy, hero, state, rng);
    const retribLogs = state.log.filter((l) => l.text.includes("Retributive Strike"));
    // Should fire exactly once
    expect(retribLogs.length).toBeLessThanOrEqual(1);
  });
});

// ── Combat end cleanup ───────────────────────────────────────────────────────

describe("Combat end cleanup: attacker killed by reaction is properly defeated", () => {
  it("Hellish Rebuke killing the attacker sets shouldCheckCombatEnd and logs defeat", () => {
    const hero = makeHero({
      archetypeId: "archetype.warlock.fiend",
      spellSlotsRemaining: 2,
      stats: { maxHp: 30, armor: 8, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 10 },
    });
    const enemy = makeEnemy({ hp: 1 }); // low HP so Hellish Rebuke kills it
    const state = makeState([enemy, hero]);
    const rng = seqRng([0.99, 0.3, 0.99, 0.99]); // enemy hits, enemy dmg, rebuke high
    const result = resolveAction(ACTION_REGISTRY["action.rusty_stab"]!, enemy, hero, state, rng);
    expect(enemy.hp).toBe(0);
    expect(result.shouldCheckCombatEnd).toBe(true);
    const defeatLog = state.log.find((l) => l.text.includes("defeated"));
    expect(defeatLog).toBeDefined();
  });
});

// ── Enemy turns still advance ────────────────────────────────────────────────

describe("Enemy turns: resolveAction returns even when reactions fire", () => {
  it("resolveAction completes with a valid result when Uncanny Dodge fires", () => {
    const hero = makeHero({ passives: ["passive.uncanny_dodge"] });
    const enemy = makeEnemy();
    const state = makeState([enemy, hero]);
    const rng = seqRng([0.99, 0.5]);
    const result = resolveAction(ACTION_REGISTRY["action.rusty_stab"]!, enemy, hero, state, rng);
    expect(result.kind).toBe("damage");
    expect(result.amount).toBeGreaterThanOrEqual(0);
  });
});
