import { describe, it, expect } from "vitest";
import { getHeroActionIds, chargesRemaining, isChargeExhausted } from "./ActionBar.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";

function makeScout(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "scout1",
    defId: "class.scout",
    displayName: "Nyx",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 13, armor: 13, move: 4, might: 1, agility: 3, spirit: 0 },
    hp: 13,
    conditions: [],
    movePointsRemaining: 4,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    pos: { q: 0, r: 0 } as Hex,
    ...overrides,
  };
}

function makeArcanist(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "arc1",
    defId: "class.arcanist",
    displayName: "Eldra",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 11, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 },
    hp: 11,
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    pos: { q: 0, r: 0 } as Hex,
    ...overrides,
  };
}

function makeCombatState(perEncounterUses: Record<string, number> = {}): CombatState {
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: [],
    units: [],
    log: [],
    status: "active",
    gridKeys: [],
    targetingActionId: null,
    perEncounterUses,
  };
}

describe("getHeroActionIds (#140)", () => {
  it("scout action bar includes cunning_step alongside its other starter actions", () => {
    const scout = makeScout();
    const ids = getHeroActionIds(scout);
    expect(ids).toContain("action.precise_stab");
    expect(ids).toContain("action.shortbow_shot");
    expect(ids).toContain("action.cunning_step");
  });

  it("all three scout starter actions are present with no duplicates", () => {
    const scout = makeScout();
    const ids = getHeroActionIds(scout);
    const cunning = ids.filter((id) => id === "action.cunning_step");
    expect(cunning).toHaveLength(1);
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });

  it("prepared actions are appended after starter class actions", () => {
    const arcanist = makeArcanist({ preparedActionIds: ["action.fireball"] });
    const ids = getHeroActionIds(arcanist);
    expect(ids).toContain("action.fireball");
    // Starter actions come first.
    const starterEnd = Math.max(
      ids.indexOf("action.fire_bolt"),
      ids.indexOf("action.frost_shard"),
      ids.indexOf("action.arcane_ward"),
    );
    expect(ids.indexOf("action.fireball")).toBeGreaterThan(starterEnd);
  });

  it("deduplicates action IDs granted by multiple sources", () => {
    // prepared list duplicates a starter action.
    const scout = makeScout({ preparedActionIds: ["action.cunning_step"] });
    const ids = getHeroActionIds(scout);
    const cunning = ids.filter((id) => id === "action.cunning_step");
    expect(cunning).toHaveLength(1);
  });

  it("item-granted actions appear in the list", () => {
    const scout = makeScout({ equippedItemIds: { weapon: "item.shortbow", armor: null, trinket: null } });
    const ids = getHeroActionIds(scout);
    // Shortbow grants action.shortbow_shot — already in class list, deduped.
    expect(ids).toContain("action.precise_stab");
  });
});

describe("chargesRemaining (#140)", () => {
  it("returns full charges when the action has never been used", () => {
    expect(chargesRemaining("action.cunning_step", {})).toBe(1);
  });

  it("returns zero when all charges have been used", () => {
    expect(chargesRemaining("action.cunning_step", { "action.cunning_step": 1 })).toBe(0);
  });

  it("returns null for unlimited (non-charged) actions", () => {
    expect(chargesRemaining("action.precise_stab", {})).toBeNull();
  });
});

describe("isChargeExhausted (#140)", () => {
  it("charged action is NOT exhausted before first use", () => {
    const cs = makeCombatState({});
    expect(isChargeExhausted("action.cunning_step", cs)).toBe(false);
  });

  it("charged action IS exhausted after its only charge is used", () => {
    const cs = makeCombatState({ "action.cunning_step": 1 });
    expect(isChargeExhausted("action.cunning_step", cs)).toBe(true);
  });

  it("unlimited action is never exhausted", () => {
    const cs = makeCombatState({ "action.precise_stab": 99 });
    expect(isChargeExhausted("action.precise_stab", cs)).toBe(false);
  });
});
