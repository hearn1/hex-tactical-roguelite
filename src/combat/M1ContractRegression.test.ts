import { describe, it, expect } from "vitest";
import { resolveAction } from "./Action.ts";
import { applyHazardsForMovementPath } from "./Terrain.ts";
import { getTraitTriggered } from "./Traits.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { ENCOUNTER_REGISTRY } from "../data/encounters.ts";
import type { UnitInstance, CombatState, Hex, TerrainType } from "../state/types.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";

/**
 * Milestone 1 audit (#495): prove the centralized post-damage aftermath contract still holds
 * for content added after M1 (Sorcerer, Monk, Ranger class actions; later boss/encounter data).
 * Every HP-reducing path must route hero downing, enemy defeat, threshold reinforcement, elite
 * rally, telegraph cleanup, and logging through resolvePostDamageAftermath exactly once.
 */

// rng() = 0.99 → d20 = 20 (auto-crit, guaranteed hit) and maxed damage dice. Deterministic.
const CRIT_RNG = () => 0.99;

function makeUnit(overrides: Partial<UnitInstance> & { instanceId: string; pos: Hex }): UnitInstance {
  return {
    defId: "class.guardian",
    displayName: overrides.instanceId,
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 20, armor: 12, move: 3, str: 3, dex: 3, con: 0, int: 3, wis: 0, cha: 3 },
    hp: 20,
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeState(units: UnitInstance[], overrides: Partial<CombatState> = {}): CombatState {
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
    bossTelegraph: null,
    traitState: { actionRotationIndex: {}, triggered: {} },
    ...overrides,
  };
}

describe("M1 contract regression — later-milestone primary_plus_adjacent targeting (#495)", () => {
  it("Monk Flurry of Blows hits adjacent enemies and never friendly-fires adjacent allies", () => {
    // Monk strikes a primary enemy; a second enemy adjacent to the primary must be hit,
    // while an allied hero adjacent to the primary must be untouched.
    const monk = makeUnit({ instanceId: "monk", pos: { q: 0, r: 0 }, defId: "class.monk" });
    const primary = makeUnit({ instanceId: "e1", pos: { q: 1, r: 0 }, team: "enemy", hp: 1, stats: { maxHp: 8, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
    const adjEnemy = makeUnit({ instanceId: "e2", pos: { q: 1, r: -1 }, team: "enemy", hp: 1, stats: { maxHp: 8, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
    const ally = makeUnit({ instanceId: "ally", pos: { q: 0, r: 1 }, team: "hero", hp: 20 });
    const state = makeState([monk, primary, adjEnemy, ally]);

    resolveAction(ACTION_REGISTRY["action.monk.flurry_of_blows"], monk, primary, state, CRIT_RNG);

    expect(primary.hp).toBe(0);
    expect(adjEnemy.hp).toBe(0);
    expect(ally.hp).toBe(20); // ally adjacent to the primary target is NOT hit
    expect(state.log.some((l) => l.text.includes("ally"))).toBe(false);
  });

  it("Sorcerer Chain Lightning arcs from the primary target, not the caster", () => {
    // Caster at range 4. Splash must hit an enemy adjacent to the primary target,
    // and must NOT hit an enemy adjacent to the caster.
    const sorcerer = makeUnit({ instanceId: "sorc", pos: { q: 0, r: 0 }, defId: "class.sorcerer", spellSlotsRemaining: 3, spellSlotsMax: 3 });
    const primary = makeUnit({ instanceId: "primary", pos: { q: 4, r: 0 }, team: "enemy", hp: 1, stats: { maxHp: 8, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
    const nearTarget = makeUnit({ instanceId: "nearTarget", pos: { q: 4, r: -1 }, team: "enemy", hp: 1, stats: { maxHp: 8, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
    const nearCaster = makeUnit({ instanceId: "nearCaster", pos: { q: 1, r: 0 }, team: "enemy", hp: 8, stats: { maxHp: 8, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
    const state = makeState([sorcerer, primary, nearTarget, nearCaster]);

    resolveAction(ACTION_REGISTRY["action.sorcerer.chain_lightning"], sorcerer, primary, state, CRIT_RNG);

    expect(primary.hp).toBe(0);
    expect(nearTarget.hp).toBe(0); // adjacent to the primary target → hit
    expect(nearCaster.hp).toBe(8); // adjacent to the caster only → untouched
  });
});

describe("M1 contract regression — later-milestone AoE aftermath (#495)", () => {
  it("Sorcerer Cone of Cold multi-kill produces exactly one defeat log per enemy", () => {
    const sorcerer = makeUnit({ instanceId: "sorc", pos: { q: 0, r: 0 }, defId: "class.sorcerer", spellSlotsRemaining: 2, spellSlotsMax: 2 });
    const e1 = makeUnit({ instanceId: "e1", pos: { q: 2, r: 0 }, team: "enemy", hp: 1, stats: { maxHp: 1, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
    const e2 = makeUnit({ instanceId: "e2", pos: { q: 2, r: -1 }, team: "enemy", hp: 1, stats: { maxHp: 1, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
    const state = makeState([sorcerer, e1, e2]);

    const result = resolveAction(ACTION_REGISTRY["action.sorcerer.cone_of_cold"], sorcerer, e1, state, CRIT_RNG);

    expect(e1.hp).toBe(0);
    expect(e2.hp).toBe(0);
    expect(state.log.filter((l) => l.kind === "defeat").length).toBe(2);
    expect(result.shouldCheckCombatEnd).toBe(true);
  });
});

describe("M1 contract regression — later-milestone boss reinforcement (#495)", () => {
  it("Ogre Warlord spawns a unique reinforcement exactly once when a class action crosses its threshold", () => {
    const def = ENEMY_REGISTRY["enemy.ogre_warlord"];
    const hero = makeUnit({ instanceId: "sorc", pos: { q: 0, r: 0 }, defId: "class.sorcerer", spellSlotsRemaining: 0, spellSlotsMax: 0 });
    // maxHp 52, reinforcement threshold = floor(52 * 0.5) = 26. Start above it.
    const boss = makeUnit({
      instanceId: "boss",
      pos: { q: 2, r: 0 },
      team: "enemy",
      defId: def.id,
      displayName: def.displayName,
      stats: { ...def.baseStats },
      hp: 40,
    });
    const state = makeState([hero, boss]);

    // Twin Bolt (cantrip, no spell slot) crosses the threshold without killing the boss.
    const first = resolveAction(ACTION_REGISTRY["action.sorcerer.twin_bolt"], hero, boss, state, CRIT_RNG);
    expect(boss.hp).toBeGreaterThan(0);
    expect(boss.hp).toBeLessThanOrEqual(26);
    expect(first.shouldCheckCombatEnd).toBe(false);

    const spawned = state.units.filter((u) => u.instanceId.startsWith("boss_reinforcement_"));
    expect(spawned.length).toBe(1);
    expect(spawned[0].instanceId).toBe("boss_reinforcement_1");
    expect(state.turnQueue).toContain("boss_reinforcement_1");

    // A second hit must not re-spawn from the same threshold.
    resolveAction(ACTION_REGISTRY["action.sorcerer.twin_bolt"], hero, boss, state, CRIT_RNG);
    expect(state.units.filter((u) => u.instanceId.startsWith("boss_reinforcement_")).length).toBe(1);
    expect(getTraitTriggered(state, "boss:boss_reinforcement_at_hp_threshold")).toBe(true);
  });
});

describe("M1 contract regression — later-milestone elite encounter rally (#495)", () => {
  it("first elite death from a class action triggers Rally exactly once", () => {
    const hero = makeUnit({ instanceId: "sorc", pos: { q: 0, r: 0 }, defId: "class.sorcerer" });
    const e1 = makeUnit({ instanceId: "e1", pos: { q: 2, r: 0 }, team: "enemy", hp: 1, stats: { maxHp: 8, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
    const e2 = makeUnit({ instanceId: "e2", pos: { q: -2, r: 0 }, team: "enemy", hp: 20, stats: { maxHp: 20, armor: 1, move: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } });
    const state = makeState([hero, e1, e2], { encounterId: "encounter.long_iron_sergeant_elite" });
    // Confirm we are exercising real later-milestone encounter data.
    expect(ENCOUNTER_REGISTRY[state.encounterId!].traits?.some((t) => t.id === "elite_rally_on_first_death")).toBe(true);

    // Twin Bolt at range 3 on the lone e1 (no adjacent enemies) — clean single kill.
    resolveAction(ACTION_REGISTRY["action.sorcerer.twin_bolt"], hero, e1, state, CRIT_RNG);

    expect(e1.hp).toBe(0);
    expect(e2.conditions.some((c) => c.id === "rallied")).toBe(true);
    expect(getTraitTriggered(state, "encounter:elite_rally_on_first_death")).toBe(true);
    expect(state.log.filter((l) => l.text.includes("Rally")).length).toBe(1);
  });
});

describe("M1 contract regression — later-milestone hazard movement (#495)", () => {
  it("moving through a real encounter's hazard tiles is stepwise and interrupts on down", () => {
    const enc = ENCOUNTER_REGISTRY["encounter.long_mire_crossing"];
    const terrain: Record<string, TerrainType> = {};
    for (const t of enc.terrain ?? []) terrain[hexKey({ q: t.q, r: t.r })] = t.type;
    const hazardHexes = (enc.terrain ?? []).filter((t) => t.type === "hazard");
    expect(hazardHexes.length).toBeGreaterThanOrEqual(2);

    // A 2-HP unit takes HAZARD_DAMAGE (2) on entering the first hazard tile and is downed,
    // so movement must stop there and never reach the second hazard tile.
    const mover = makeUnit({
      instanceId: "mover",
      pos: { q: hazardHexes[0].q - 1, r: hazardHexes[0].r },
      team: "enemy",
      hp: 2,
      stats: { maxHp: 8, armor: 12, move: 4, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    });
    const state = makeState([mover], { terrain });
    const path: Hex[] = [
      { q: hazardHexes[0].q, r: hazardHexes[0].r },
      { q: hazardHexes[1].q, r: hazardHexes[1].r },
    ];

    const result = applyHazardsForMovementPath(mover, state, path);

    expect(result.damageApplied).toBe(true);
    expect(result.stoppedEarly).toBe(true);
    expect(result.shouldStopCaller).toBe(true);
    expect(result.stoppedAtHex).toEqual({ q: hazardHexes[0].q, r: hazardHexes[0].r });
    expect(mover.pos).toEqual({ q: hazardHexes[0].q, r: hazardHexes[0].r });
    expect(mover.hp).toBe(0);
    // Only the first hazard tile was processed — the second was never entered.
    expect(result.postDamageResults.length).toBe(1);
  });
});
