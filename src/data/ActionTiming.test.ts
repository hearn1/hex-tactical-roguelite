import { describe, it, expect } from "vitest";
import { ACTION_REGISTRY, VALID_ACTION_TIMINGS } from "./actions.ts";
import { DataRepository } from "./DataRepository.ts";

describe("ActionTiming (#503)", () => {
  it("omitted timing implies 'action' bucket (undefined defaults to standard)", () => {
    const slash = ACTION_REGISTRY["action.slash"];
    expect(slash).toBeDefined();
    expect(slash.timing).toBeUndefined();
  });

  it("explicit timing is stored and readable", () => {
    const cunning = ACTION_REGISTRY["action.cunning_step"];
    expect(cunning.timing).toBe("bonus_action");
  });

  it("healing word is tagged as bonus_action", () => {
    const hw = ACTION_REGISTRY["action.cleric.healing_word"];
    expect(hw.timing).toBe("bonus_action");
  });

  it("VALID_ACTION_TIMINGS contains all expected buckets", () => {
    for (const t of ["action", "bonus_action", "reaction", "free", "passive", "triggered_passive", "attack_action_modifier", "monster_special"] as const) {
      expect(VALID_ACTION_TIMINGS.has(t)).toBe(true);
    }
  });

  it("DataRepository validation passes with valid timing values", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const report = repo.validate();
    const timingErrors = report.errors.filter((e) => e.includes("timing"));
    expect(timingErrors).toHaveLength(0);
  });
});

describe("B1: Low-risk bonus action reclassification (#508)", () => {
  it("Second Wind is a bonus action (self heal)", () => {
    expect(ACTION_REGISTRY["action.second_wind"].timing).toBe("bonus_action");
  });

  it("Hunter's Mark is a bonus action (mark/debuff)", () => {
    expect(ACTION_REGISTRY["action.ranger.hunters_mark"].timing).toBe("bonus_action");
  });

  it("Bardic Inspiration is a bonus action (ally buff)", () => {
    expect(ACTION_REGISTRY["action.bard.inspiration"].timing).toBe("bonus_action");
  });

  it("Hex is a bonus action (mark/debuff)", () => {
    expect(ACTION_REGISTRY["action.warlock.hex"].timing).toBe("bonus_action");
  });

  it("Rage is a bonus action", () => {
    expect(ACTION_REGISTRY["action.barbarian.rage"].timing).toBe("bonus_action");
  });

  it("Vow of Enmity is a bonus action", () => {
    expect(ACTION_REGISTRY["action.paladin.vow_of_enmity"].timing).toBe("bonus_action");
  });

  it("Zephyr Strike is a bonus action", () => {
    expect(ACTION_REGISTRY["action.ranger.zephyr_strike"].timing).toBe("bonus_action");
  });

  it("Disengage & Dash is a bonus action (mobility)", () => {
    expect(ACTION_REGISTRY["action.rogue.disengage_dash"].timing).toBe("bonus_action");
  });

  it("bonus action does not block standard action in same turn", () => {
    // All reclassified actions use bonus_action timing — confirm payActionCosts for one
    // does not set actionUsed (tested via ActionEconomy; this asserts timing contract at data layer)
    const rage = ACTION_REGISTRY["action.barbarian.rage"];
    const slash = ACTION_REGISTRY["action.slash"];
    expect(rage.timing).toBe("bonus_action");
    expect(slash.timing).toBeUndefined(); // defaults to "action"
  });
});
