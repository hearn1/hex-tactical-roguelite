import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { levelForXp, nextThresholdXp, applyXp, applyXpToPartyMember, MAX_LEVEL, XP_THRESHOLDS } from "./Leveling.ts";
import type { UnitInstance } from "../state/types.ts";
import type { PartyMember } from "../state/RunState.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";
import type { ClassProgressionTable } from "../data/progressionTables.ts";

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "test",
    defId: "class.guardian",
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
    hp: 18,
    pos: { q: 0, r: 0 },
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

describe("levelForXp", () => {
  it("levelForXp(0) === 1", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("levelForXp(19) === 1", () => {
    expect(levelForXp(19)).toBe(1);
  });

  it("levelForXp(20) === 2", () => {
    expect(levelForXp(20)).toBe(2);
  });

  it("levelForXp(140) === 5", () => {
    expect(levelForXp(140)).toBe(5);
  });

  it("levelForXp(999) === 5", () => {
    expect(levelForXp(999)).toBe(5);
  });
});

describe("nextThresholdXp", () => {
  it("level 1 returns 20", () => {
    expect(nextThresholdXp(1)).toBe(20);
  });

  it("level 5 returns null", () => {
    expect(nextThresholdXp(5)).toBeNull();
  });
});

describe("applyXp", () => {
  it("Guardian crossing 19 -> 20 gains maxHp=2, might=1", () => {
    const unit = makeUnit({
      defId: "class.guardian",
      xp: 19,
      level: 1,
      stats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 10,
    });
    const result = applyXp(unit, 1);
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(result.gains.maxHp).toBe(2);
    expect(result.gains.str).toBe(1);
  });

  it("applyXp on level-1 Arcanist with 200 XP reaches level 5", () => {
    const unit = makeUnit({
      defId: "class.arcanist",
      xp: 0,
      level: 1,
      stats: { maxHp: 11, armor: 11, move: 3, str: 0, dex: 1, con: 0, int: 4, wis: 0, cha: 0 },
      hp: 11,
    });
    const result = applyXp(unit, 200);
    expect(result.leveledUp).toBe(true);
    expect(unit.level).toBe(5);
    expect(result.gains.maxHp).toBe(4);
    expect(result.gains.int).toBe(4);
  });

  it("reports each level reached in order (multi-threshold grant)", () => {
    const unit = makeUnit({
      defId: "class.arcanist",
      xp: 0,
      level: 1,
      stats: { maxHp: 11, armor: 11, move: 3, str: 0, dex: 1, con: 0, int: 4, wis: 0, cha: 0 },
      hp: 11,
    });
    const result = applyXp(unit, 200);
    expect(result.levelsGained).toEqual([2, 3, 4, 5]);
  });

  it("a no-op grant reports no levels gained", () => {
    const unit = makeUnit({ defId: "class.guardian", xp: 0, level: 1 });
    const result = applyXp(unit, 5);
    expect(result.leveledUp).toBe(false);
    expect(result.levelsGained).toEqual([]);
  });

  it("current HP increases by maxHp delta, not refilled", () => {
    const unit = makeUnit({
      defId: "class.guardian",
      xp: 19,
      level: 1,
      stats: { maxHp: 18, armor: 14, move: 3, str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      hp: 10,
    });
    applyXp(unit, 1);
    expect(unit.hp).toBe(12);
    expect(unit.stats.maxHp).toBe(20);
  });
});

function makePm(overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    instanceId: "hero_001",
    classId: "class.guardian",
    displayName: "Test",
    level: 1,
    xp: 0,
    hp: 18,
    maxHp: 18,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    ...overrides,
  };
}

describe("featuresGranted auto-apply (applyXpToPartyMember)", () => {
  let savedTable: ClassProgressionTable;

  beforeEach(() => {
    savedTable = CLASS_REGISTRY["class.guardian"].progressionTable;
  });

  afterEach(() => {
    CLASS_REGISTRY["class.guardian"].progressionTable = savedTable;
  });

  it("appends featuresGranted passives to PartyMember.passives on level-up", () => {
    CLASS_REGISTRY["class.guardian"].progressionTable = [
      { level: 1, proficiencyBonus: 2 },
      { level: 2, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 }, featuresGranted: ["passive.test_feature"] },
      { level: 3, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
      { level: 4, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
      { level: 5, proficiencyBonus: 3, statGain: { maxHp: 2, str: 1 } },
    ];
    const pm = makePm({ xp: 19 });
    const result = applyXpToPartyMember(pm, 1);
    expect(result.leveledUp).toBe(true);
    expect(pm.passives).toContain("passive.test_feature");
    expect(result.featuresGranted).toEqual(["passive.test_feature"]);
  });

  it("deduplicates featuresGranted when the same passive is listed in multiple levels", () => {
    CLASS_REGISTRY["class.guardian"].progressionTable = [
      { level: 1, proficiencyBonus: 2 },
      { level: 2, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 }, featuresGranted: ["passive.shared"] },
      { level: 3, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 }, featuresGranted: ["passive.shared"] },
      { level: 4, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
      { level: 5, proficiencyBonus: 3, statGain: { maxHp: 2, str: 1 } },
    ];
    const pm = makePm({ xp: 0 });
    applyXpToPartyMember(pm, 200);
    expect(pm.passives?.filter((p) => p === "passive.shared")).toHaveLength(1);
  });

  it("does not add featuresGranted to result when no features are in the crossed levels", () => {
    const pm = makePm({ xp: 19 });
    const result = applyXpToPartyMember(pm, 1);
    expect(result.featuresGranted).toBeUndefined();
  });

  it("does not duplicate an existing passive already on PartyMember", () => {
    CLASS_REGISTRY["class.guardian"].progressionTable = [
      { level: 1, proficiencyBonus: 2 },
      { level: 2, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 }, featuresGranted: ["passive.already_has"] },
      { level: 3, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
      { level: 4, proficiencyBonus: 2, statGain: { maxHp: 2, str: 1 } },
      { level: 5, proficiencyBonus: 3, statGain: { maxHp: 2, str: 1 } },
    ];
    const pm = makePm({ xp: 19, passives: ["passive.already_has"] });
    applyXpToPartyMember(pm, 1);
    expect(pm.passives?.filter((p) => p === "passive.already_has")).toHaveLength(1);
  });
});
