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
