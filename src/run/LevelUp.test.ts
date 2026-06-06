import { describe, it, expect } from "vitest";
import type { PartyMember, PendingLevelUp } from "../state/RunState.ts";
import {
  getLevelUpOptions,
  findLevelUpOption,
  isChoiceLevel,
  applyLevelUpChoice,
  enqueuePendingLevelUps,
  applyDefaultLevelUpChoices,
} from "./LevelUp.ts";
import type { LevelUpOption } from "../data/levelups.ts";
import {
  LEVELUP_PASSIVE_START_COMBAT_GUARDED,
  LEVELUP_PASSIVE_FIRST_HEAL_BONUS,
} from "../data/levelups.ts";

function makePm(overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    instanceId: "hero_001",
    classId: "class.guardian",
    displayName: "Mara",
    level: 1,
    xp: 0,
    hp: 18,
    maxHp: 18,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    ...overrides,
  };
}

const STAT_OPTION: LevelUpOption = {
  id: "test.stat",
  name: "Test Stat",
  description: "+2 maxHp, +1 armor",
  upgrade: { kind: "stat", stats: { maxHp: 2, armor: 1 } },
};
const ACTION_OPTION: LevelUpOption = {
  id: "test.action",
  name: "Test Action",
  description: "+1 dmg",
  upgrade: { kind: "action", actionIds: ["action.slash", "action.shield_bash"], damageBonus: 1 },
};
const PASSIVE_OPTION: LevelUpOption = {
  id: "test.passive",
  name: "Test Passive",
  description: "guarded",
  upgrade: { kind: "passive", passiveId: LEVELUP_PASSIVE_START_COMBAT_GUARDED },
};

describe("isChoiceLevel / getLevelUpOptions", () => {
  it("levels 2,3,4,5 are choice levels; 1 and 6 are not", () => {
    expect(isChoiceLevel(1)).toBe(false);
    expect(isChoiceLevel(2)).toBe(true);
    expect(isChoiceLevel(3)).toBe(true);
    expect(isChoiceLevel(4)).toBe(true);
    expect(isChoiceLevel(5)).toBe(true);
    expect(isChoiceLevel(6)).toBe(false);
  });

  it("each class offers 2 options at levels 2 and 3, falls to shared at 4-5", () => {
    for (const classId of ["class.guardian", "class.acolyte", "class.arcanist"]) {
      expect(getLevelUpOptions(classId, 2)).toHaveLength(2);
      expect(getLevelUpOptions(classId, 3)).toHaveLength(2);
      expect(getLevelUpOptions(classId, 4)).toHaveLength(2);
      expect(getLevelUpOptions(classId, 5)).toHaveLength(2);
    }
  });

  it("an unknown class falls back to the shared list within range", () => {
    const options = getLevelUpOptions("class.unknown", 2);
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options[0].id.startsWith("shared.")).toBe(true);
  });

  it("levels outside the band offer no choice", () => {
    expect(getLevelUpOptions("class.guardian", 1)).toHaveLength(0);
    expect(getLevelUpOptions("class.guardian", 6)).toHaveLength(0);
  });

  it("findLevelUpOption resolves a known option id", () => {
    const opt = findLevelUpOption("class.guardian", 2, "guardian.iron_stance");
    expect(opt?.name).toBe("Iron Stance");
    expect(findLevelUpOption("class.guardian", 2, "nope")).toBeUndefined();
  });
});

describe("applyLevelUpChoice — each reward type", () => {
  it("stat upgrade folds into bonusStats and raises max/current HP", () => {
    const pm = makePm({ hp: 10, maxHp: 18 });
    applyLevelUpChoice(pm, STAT_OPTION);
    expect(pm.bonusStats.maxHp).toBe(2);
    expect(pm.bonusStats.armor).toBe(1);
    expect(pm.maxHp).toBe(20);
    expect(pm.hp).toBe(12);
    expect(pm.levelUpChoiceIds).toEqual(["test.stat"]);
  });

  it("action upgrade accumulates per-action bonuses for each listed action", () => {
    const pm = makePm();
    applyLevelUpChoice(pm, ACTION_OPTION);
    expect(pm.actionUpgrades?.["action.slash"]?.damageBonus).toBe(1);
    expect(pm.actionUpgrades?.["action.shield_bash"]?.damageBonus).toBe(1);
    // Applying again stacks.
    applyLevelUpChoice(pm, ACTION_OPTION);
    expect(pm.actionUpgrades?.["action.slash"]?.damageBonus).toBe(2);
  });

  it("passive upgrade records the flag once", () => {
    const pm = makePm();
    applyLevelUpChoice(pm, PASSIVE_OPTION);
    applyLevelUpChoice(pm, PASSIVE_OPTION);
    expect(pm.passives).toEqual([LEVELUP_PASSIVE_START_COMBAT_GUARDED]);
  });

  it("maxHp-only stat upgrade still bumps current HP", () => {
    const pm = makePm({ hp: 14, maxHp: 14 });
    applyLevelUpChoice(pm, {
      id: "t.hp",
      name: "HP",
      description: "+1 maxHp",
      upgrade: { kind: "stat", stats: { spirit: 1, maxHp: 1 } },
    });
    expect(pm.bonusStats.spirit).toBe(1);
    expect(pm.maxHp).toBe(15);
    expect(pm.hp).toBe(15);
  });
});

describe("enqueuePendingLevelUps", () => {
  it("only enqueues levels inside the choice band", () => {
    const queue: PendingLevelUp[] = [];
    // 1 → 5 crosses levels [2,3,4,5]; all in range now.
    enqueuePendingLevelUps(queue, "hero_001", "class.guardian", [2, 3, 4, 5]);
    expect(queue.map((q) => q.newLevel)).toEqual([2, 3, 4, 5]);
    expect(queue[0]).toMatchObject({ instanceId: "hero_001", classId: "class.guardian", newLevel: 2 });
  });

  it("preserves order across a single multi-threshold grant", () => {
    const queue: PendingLevelUp[] = [];
    enqueuePendingLevelUps(queue, "hero_001", "class.acolyte", [2, 3]);
    expect(queue.map((q) => q.newLevel)).toEqual([2, 3]);
  });
});

describe("applyDefaultLevelUpChoices (pre-run/meta)", () => {
  it("auto-applies the first option for each in-range level, no UI", () => {
    const pm = makePm({ classId: "class.guardian" });
    applyDefaultLevelUpChoices(pm, "class.guardian", [2, 3]);
    // Guardian L2 default = Iron Stance (+2 maxHp, +1 armor); L3 default = Shieldbearer (archetype).
    expect(pm.levelUpChoiceIds).toEqual(["guardian.iron_stance", "guardian.archetype.shieldbearer"]);
    expect(pm.bonusStats.maxHp).toBe(2);
    expect(pm.passives).toContain("archetype_passive.shieldbearer_adjacency_armor");
  });

  it("ignores levels outside the band", () => {
    const pm = makePm();
    applyDefaultLevelUpChoices(pm, "class.guardian", [6, 7]);
    expect(pm.levelUpChoiceIds ?? []).toEqual([]);
  });
});

describe("Archetype choices exist for L3", () => {
  it("acolyte L3 offers Beacon and Cloistered archetypes", () => {
    const opt1 = findLevelUpOption("class.acolyte", 3, "acolyte.archetype.beacon");
    expect(opt1?.upgrade.kind).toBe("archetype");
    if (opt1?.upgrade.kind === "archetype") {
      expect(opt1.upgrade.archetypeId).toBe("archetype.acolyte.beacon");
    }
    const opt2 = findLevelUpOption("class.acolyte", 3, "acolyte.archetype.cloistered");
    expect(opt2?.upgrade.kind).toBe("archetype");
    if (opt2?.upgrade.kind === "archetype") {
      expect(opt2.upgrade.archetypeId).toBe("archetype.acolyte.cloistered");
    }
  });
});
