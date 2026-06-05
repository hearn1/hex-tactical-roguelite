import { describe, expect, it } from "vitest";
import { applyCondition } from "../combat/Condition.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";
import type { CombatState, UnitInstance } from "../state/types.ts";
import { createInventory } from "./Inventory.ts";
import { consumePotion } from "./Consumable.ts";

function makePartyMember(overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    instanceId: "hero_001",
    classId: "class.guardian",
    displayName: "Mara",
    level: 1,
    xp: 0,
    hp: 10,
    maxHp: 18,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    ...overrides,
  };
}

function makeRun(party: PartyMember[] = [makePartyMember()]): RunState {
  return {
    seed: 0,
    gold: 0,
    party,
    inventory: createInventory(),
    mapState: {
      currentNodeId: "node.start",
      visitedNodeIds: ["node.start"],
      nodesCleared: 0,
      elitesDefeated: 0,
      bossDefeated: false,
    },
    runStatus: "active",
    shopStates: {},
    campStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty: "normal",
    eventSelections: {},
  };
}

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "unit",
    defId: "class.guardian",
    displayName: "Unit",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 18, armor: 12, move: 3, might: 1, agility: 1, spirit: 1 },
    hp: 10,
    pos: { q: 0, r: 0 },
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeCombat(units: UnitInstance[]): CombatState {
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: units.map((u) => u.instanceId),
    units,
    log: [],
    status: "active",
    gridKeys: ["0,0", "1,0", "2,0", "3,0", "4,0"],
    targetingActionId: null,
    targetingPotionId: null,
  };
}

describe("consumePotion", () => {
  it("heals a map hero, clamps HP, and decrements exactly one matching potion id", () => {
    const hero = makePartyMember({ hp: 15 });
    const run = makeRun([hero]);
    run.inventory.potions.push("potion.focus", "potion.healing", "potion.healing");

    const result = consumePotion("potion.healing", hero.instanceId, { run, rng: () => 0 });

    expect(result.ok).toBe(true);
    expect(hero.hp).toBe(18);
    expect(result.amount).toBe(3);
    expect(run.inventory.potions).toEqual(["potion.focus", "potion.healing"]);
  });

  it("cleanses combat conditions and applies its heal amount", () => {
    const hero = makeUnit({ instanceId: "hero_001", displayName: "Mara", hp: 4 });
    applyCondition(hero, "slowed", 1);
    applyCondition(hero, "weakened", 1);
    applyCondition(hero, "guarded", 1);
    const run = makeRun();
    run.inventory.potions.push("potion.bottled_dawn");
    const combat = makeCombat([hero]);

    const result = consumePotion("potion.bottled_dawn", hero.instanceId, {
      run,
      combat,
      actorId: hero.instanceId,
      rng: () => 0,
    });

    expect(result.ok).toBe(true);
    expect(hero.hp).toBe(12);
    expect(hero.conditions.map((c) => c.id)).toEqual(["guarded"]);
    expect(result.removedConditionIds).toEqual(["slowed", "weakened"]);
    expect(run.inventory.potions).toEqual([]);
  });

  it("rolls damage with the supplied RNG, range-checks, and logs defeat", () => {
    const actor = makeUnit({ instanceId: "hero_001", displayName: "Mara", pos: { q: 0, r: 0 } });
    const enemy = makeUnit({
      instanceId: "enemy_001",
      displayName: "Target",
      team: "enemy",
      hp: 4,
      pos: { q: 3, r: 0 },
    });
    const run = makeRun();
    run.inventory.potions.push("potion.fire_flask");
    const combat = makeCombat([actor, enemy]);

    const result = consumePotion("potion.fire_flask", enemy.instanceId, {
      run,
      combat,
      actorId: actor.instanceId,
      rng: () => 0.5,
    });

    expect(result.ok).toBe(true);
    expect(result.amount).toBe(4);
    expect(enemy.hp).toBe(0);
    expect(run.inventory.potions).toEqual([]);
    expect(combat.log.some((entry) => entry.kind === "defeat" && entry.text.includes("Target"))).toBe(true);
  });

  it("rejects out-of-range damage without decrementing", () => {
    const actor = makeUnit({ instanceId: "hero_001", pos: { q: 0, r: 0 } });
    const enemy = makeUnit({ instanceId: "enemy_001", team: "enemy", pos: { q: 4, r: 0 } });
    const run = makeRun();
    run.inventory.potions.push("potion.fire_flask");
    const combat = makeCombat([actor, enemy]);

    const result = consumePotion("potion.fire_flask", enemy.instanceId, {
      run,
      combat,
      actorId: actor.instanceId,
      rng: () => 0,
    });

    expect(result.ok).toBe(false);
    expect(run.inventory.potions).toEqual(["potion.fire_flask"]);
    expect(enemy.hp).toBe(10);
  });

  it("applies Focus as blessed in combat and keeps buff potions combat-only", () => {
    const hero = makeUnit({ instanceId: "hero_001" });
    const run = makeRun();
    run.inventory.potions.push("potion.focus", "potion.focus");
    const combat = makeCombat([hero]);

    const combatResult = consumePotion("potion.focus", hero.instanceId, {
      run,
      combat,
      actorId: hero.instanceId,
      rng: () => 0,
    });
    const mapResult = consumePotion("potion.focus", run.party[0].instanceId, { run, rng: () => 0 });

    expect(combatResult.ok).toBe(true);
    expect(hero.conditions).toContainEqual({ id: "blessed", remainingTurns: 1 });
    expect(mapResult.ok).toBe(false);
    expect(run.inventory.potions).toEqual(["potion.focus"]);
  });

  it("does not mutate state when the potion id is not present", () => {
    const hero = makePartyMember({ hp: 1 });
    const run = makeRun([hero]);

    const result = consumePotion("potion.healing", hero.instanceId, { run, rng: () => 0 });

    expect(result.ok).toBe(false);
    expect(hero.hp).toBe(1);
    expect(run.inventory.potions).toEqual([]);
  });
});
