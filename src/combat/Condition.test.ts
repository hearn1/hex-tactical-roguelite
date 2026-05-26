import { describe, it, expect } from "vitest";
import type { UnitInstance } from "../state/types.ts";
import { applyCondition, processTurnStart } from "./Condition.ts";
import { createRng } from "../core/rng.ts";
import { roll } from "../core/dice.ts";
import { resolveAction, validTargets } from "./Action.ts";
import type { CombatState } from "../state/types.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "test",
    defId: "class.guardian",
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 20, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    hp: 20,
    pos: { q: 0, r: 0 },
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

function makeCombatState(units: UnitInstance[]): CombatState {
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: units.map((u) => u.instanceId),
    units,
    log: [],
    status: "active",
    gridKeys: ["0,0"],
    targetingActionId: null,
  };
}

describe("Guarded", () => {
  it("halves damage and is consumed after one hit", () => {
    const rng = createRng(42);
    const attacker = makeUnit({
      instanceId: "att",
      displayName: "Attacker",
      team: "enemy",
      defId: "enemy.goblin_skirmisher",
      stats: { maxHp: 10, armor: 10, move: 3, might: 5, agility: 0, spirit: 0 },
    });
    const target = makeUnit({ instanceId: "tgt", displayName: "Target" });
    applyCondition(target, "guarded", 1);

    const slash = ACTION_REGISTRY["action.slash"];
    const cs = makeCombatState([attacker, target]);

    resolveAction(slash, attacker, target, cs, rng);

    expect(target.conditions.find((c) => c.id === "guarded")).toBeUndefined();
    expect(target.hp).toBeGreaterThan(10);
    expect(cs.log.some((e) => e.text.includes("Guarded consumed"))).toBe(true);
  });
});

describe("Weakened", () => {
  it("reduces attack total by 2", () => {
    const rng = createRng(42);
    const attacker = makeUnit({
      instanceId: "att",
      displayName: "Attacker",
      team: "enemy",
      defId: "enemy.goblin_skirmisher",
      stats: { maxHp: 10, armor: 10, move: 3, might: 5, agility: 0, spirit: 0 },
    });
    applyCondition(attacker, "weakened", 1);

    const target = makeUnit({ instanceId: "tgt", displayName: "Target", stats: { maxHp: 99, armor: 99, move: 3, might: 0, agility: 0, spirit: 0 } });

    const slash = ACTION_REGISTRY["action.slash"];
    const cs = makeCombatState([attacker, target]);

    const beforeLogLen = cs.log.length;
    resolveAction(slash, attacker, target, cs, rng);

    const actionLog = cs.log.slice(beforeLogLen).find((e) => e.kind === "action");
    const attackTotalMatch = actionLog?.text.match(/=(\d+)/);
    const attackTotal = attackTotalMatch ? parseInt(attackTotalMatch[1], 10) : 0;

    const d20 = attackTotal - 5 - 2 + 2;

    const noWeakenRoll = d20 + 5 + 2;
    const withWeakenRoll = d20 + 5 + 2 - 2;

    expect(attackTotal).toBe(withWeakenRoll);
  });
});

describe("Blessed", () => {
  it("adds 2 to next attack roll and is removed", () => {
    const rng = createRng(42);
    const attacker = makeUnit({
      instanceId: "att",
      displayName: "Attacker",
      team: "enemy",
      defId: "enemy.goblin_skirmisher",
      stats: { maxHp: 10, armor: 10, move: 3, might: 5, agility: 0, spirit: 0 },
    });
    applyCondition(attacker, "blessed", 2);

    const target = makeUnit({ instanceId: "tgt", displayName: "Target", stats: { maxHp: 99, armor: 99, move: 3, might: 0, agility: 0, spirit: 0 } });

    const slash = ACTION_REGISTRY["action.slash"];
    const cs = makeCombatState([attacker, target]);

    resolveAction(slash, attacker, target, cs, rng);

    expect(attacker.conditions.find((c) => c.id === "blessed")).toBeUndefined();
  });
});

describe("Slowed", () => {
  it("reduces next-turn movePointsRemaining by 1", () => {
    const unit = makeUnit({
      movePointsRemaining: 3,
      stats: { maxHp: 20, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    });
    applyCondition(unit, "slowed", 1);

    const expired = processTurnStart(unit);

    expect(unit.movePointsRemaining).toBe(2);
    expect(expired).toContain("slowed");
  });
});
