// #360 — Side quest data validation tests

import { describe, it, expect } from "vitest";
import {
  SIDE_QUEST_REGISTRY,
  getSideQuestById,
  getSideQuestsByAct,
  validateSideQuestRegistry,
  type SideQuestDefinition,
} from "./sideQuests.ts";
import { DEFAULT_CAMPAIGN } from "./campaigns.ts";

const KNOWN_CAMPAIGN_IDS = new Set(["campaign.verdant_dark"]);
const KNOWN_ACT_IDS = new Set(DEFAULT_CAMPAIGN.acts.map((a) => a.id));

// ---------------------------------------------------------------------------
// Registry shape
// ---------------------------------------------------------------------------

describe("SIDE_QUEST_REGISTRY — shape", () => {
  it("is non-empty", () => {
    expect(Object.keys(SIDE_QUEST_REGISTRY).length).toBeGreaterThan(0);
  });

  it("every registry key matches its quest id", () => {
    for (const [key, quest] of Object.entries(SIDE_QUEST_REGISTRY)) {
      expect(key).toBe(quest.id);
    }
  });

  it("all quest IDs are unique", () => {
    const ids = Object.values(SIDE_QUEST_REGISTRY).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------

describe("SIDE_QUEST_REGISTRY — required fields", () => {
  it("every quest has a non-empty displayName", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      expect(quest.displayName.length, `quest "${quest.id}" has empty displayName`).toBeGreaterThan(0);
    }
  });

  it("every quest references a known campaignId", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      expect(
        KNOWN_CAMPAIGN_IDS.has(quest.campaignId),
        `quest "${quest.id}" has unknown campaignId "${quest.campaignId}"`,
      ).toBe(true);
    }
  });

  it("every quest references a known actId", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      expect(
        KNOWN_ACT_IDS.has(quest.actId),
        `quest "${quest.id}" has unknown actId "${quest.actId}"`,
      ).toBe(true);
    }
  });

  it("every quest has at least one stage", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      expect(quest.stages.length, `quest "${quest.id}" has no stages`).toBeGreaterThan(0);
    }
  });

  it("every quest has at least one outcomeHookId", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      expect(
        quest.outcomeHookIds.length,
        `quest "${quest.id}" has no outcomeHookIds`,
      ).toBeGreaterThan(0);
    }
  });

  it("every outcomeHookId is a non-empty string", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      for (const hookId of quest.outcomeHookIds) {
        expect(hookId.length, `quest "${quest.id}" has empty outcomeHookId`).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Stage and step uniqueness
// ---------------------------------------------------------------------------

describe("SIDE_QUEST_REGISTRY — stage and step id uniqueness", () => {
  it("stage ids are unique within each quest", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      const stageIds = quest.stages.map((s) => s.id);
      expect(new Set(stageIds).size, `quest "${quest.id}" has duplicate stage ids`).toBe(
        stageIds.length,
      );
    }
  });

  it("step ids are unique within each quest (across all stages)", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      const stepIds = quest.stages.flatMap((s) => s.steps.map((st) => st.id));
      expect(new Set(stepIds).size, `quest "${quest.id}" has duplicate step ids`).toBe(
        stepIds.length,
      );
    }
  });

  it("stage ids are non-empty", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      for (const stage of quest.stages) {
        expect(stage.id.length, `quest "${quest.id}" has a stage with empty id`).toBeGreaterThan(0);
      }
    }
  });

  it("step ids are non-empty", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      for (const stage of quest.stages) {
        for (const step of stage.steps) {
          expect(
            step.id.length,
            `quest "${quest.id}" stage "${stage.id}" has a step with empty id`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Prerequisite integrity
// ---------------------------------------------------------------------------

describe("SIDE_QUEST_REGISTRY — prerequisite integrity", () => {
  it("all prerequisiteQuestIds point to known quest IDs", () => {
    const allIds = new Set(Object.keys(SIDE_QUEST_REGISTRY));
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      for (const prereqId of quest.prerequisiteQuestIds ?? []) {
        expect(
          allIds.has(prereqId),
          `quest "${quest.id}" has unknown prerequisite "${prereqId}"`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

describe("getSideQuestById", () => {
  it("returns the correct quest for a known id", () => {
    const quest = getSideQuestById("sq.act1.goblin_relic");
    expect(quest).toBeDefined();
    expect(quest?.id).toBe("sq.act1.goblin_relic");
  });

  it("returns undefined for an unknown id", () => {
    expect(getSideQuestById("sq.does_not_exist")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(getSideQuestById("")).toBeUndefined();
  });
});

describe("getSideQuestsByAct", () => {
  it("returns quests for act_1", () => {
    const quests = getSideQuestsByAct("act_1");
    expect(quests.length).toBeGreaterThan(0);
    for (const q of quests) {
      expect(q.actId).toBe("act_1");
    }
  });

  it("returns an empty array for an unknown actId", () => {
    expect(getSideQuestsByAct("act_99")).toHaveLength(0);
  });

  it("covers all four acts", () => {
    for (const actId of ["act_1", "act_2", "act_3", "act_4"]) {
      expect(
        getSideQuestsByAct(actId).length,
        `No side quests defined for ${actId}`,
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// validateSideQuestRegistry — positive (default registry passes)
// ---------------------------------------------------------------------------

describe("validateSideQuestRegistry — default registry", () => {
  it("default registry passes validation", () => {
    const report = validateSideQuestRegistry(
      SIDE_QUEST_REGISTRY,
      KNOWN_CAMPAIGN_IDS,
      KNOWN_ACT_IDS,
    );
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateSideQuestRegistry — negative (broken data fails)
// ---------------------------------------------------------------------------

function makeMinimalQuest(overrides: Partial<SideQuestDefinition> = {}): SideQuestDefinition {
  return {
    id: "sq.test.minimal",
    displayName: "Minimal Quest",
    actId: "act_1",
    campaignId: "campaign.verdant_dark",
    stages: [
      {
        id: "sq.test.minimal.stage_1",
        description: "Test stage.",
        steps: [{ id: "sq.test.minimal.stage_1.step_1", description: "Test step." }],
      },
    ],
    outcomeHookIds: ["outcome.sq.test.minimal.completed"],
    ...overrides,
  };
}

describe("validateSideQuestRegistry — invalid data fails", () => {
  it("detects duplicate quest ids", () => {
    const dup = makeMinimalQuest();
    const registry = { [dup.id]: dup, "sq.test.other": { ...dup, id: dup.id } };
    const report = validateSideQuestRegistry(registry, KNOWN_CAMPAIGN_IDS, KNOWN_ACT_IDS);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("Duplicate"))).toBe(true);
  });

  it("detects mismatched registry key and quest id", () => {
    const quest = makeMinimalQuest({ id: "sq.test.real_id" });
    const registry = { "sq.test.wrong_key": quest };
    const report = validateSideQuestRegistry(registry, KNOWN_CAMPAIGN_IDS, KNOWN_ACT_IDS);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("does not match"))).toBe(true);
  });

  it("detects empty displayName", () => {
    const quest = makeMinimalQuest({ displayName: "" });
    const report = validateSideQuestRegistry(
      { [quest.id]: quest },
      KNOWN_CAMPAIGN_IDS,
      KNOWN_ACT_IDS,
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("displayName"))).toBe(true);
  });

  it("detects unknown campaignId", () => {
    const quest = makeMinimalQuest({ campaignId: "campaign.unknown" });
    const report = validateSideQuestRegistry(
      { [quest.id]: quest },
      KNOWN_CAMPAIGN_IDS,
      KNOWN_ACT_IDS,
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("campaignId"))).toBe(true);
  });

  it("detects unknown actId", () => {
    const quest = makeMinimalQuest({ actId: "act_99" });
    const report = validateSideQuestRegistry(
      { [quest.id]: quest },
      KNOWN_CAMPAIGN_IDS,
      KNOWN_ACT_IDS,
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("actId"))).toBe(true);
  });

  it("detects quest with no stages", () => {
    const quest = makeMinimalQuest({ stages: [] });
    const report = validateSideQuestRegistry(
      { [quest.id]: quest },
      KNOWN_CAMPAIGN_IDS,
      KNOWN_ACT_IDS,
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("no stages"))).toBe(true);
  });

  it("detects duplicate stage id within a quest", () => {
    const stage = { id: "sq.test.minimal.stage_1", description: "Dup stage.", steps: [] };
    const quest = makeMinimalQuest({ stages: [stage, stage] });
    const report = validateSideQuestRegistry(
      { [quest.id]: quest },
      KNOWN_CAMPAIGN_IDS,
      KNOWN_ACT_IDS,
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("duplicate stage id"))).toBe(true);
  });

  it("detects duplicate step id within a quest", () => {
    const step = { id: "sq.test.minimal.stage_1.step_1", description: "Dup step." };
    const quest = makeMinimalQuest({
      stages: [
        { id: "sq.test.minimal.stage_1", description: "S1.", steps: [step] },
        { id: "sq.test.minimal.stage_2", description: "S2.", steps: [step] },
      ],
    });
    const report = validateSideQuestRegistry(
      { [quest.id]: quest },
      KNOWN_CAMPAIGN_IDS,
      KNOWN_ACT_IDS,
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("duplicate step id"))).toBe(true);
  });

  it("detects quest with no outcomeHookIds", () => {
    const quest = makeMinimalQuest({ outcomeHookIds: [] });
    const report = validateSideQuestRegistry(
      { [quest.id]: quest },
      KNOWN_CAMPAIGN_IDS,
      KNOWN_ACT_IDS,
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("no outcomeHookIds"))).toBe(true);
  });

  it("detects unknown prerequisiteQuestId", () => {
    const quest = makeMinimalQuest({ prerequisiteQuestIds: ["sq.nonexistent.quest"] });
    const report = validateSideQuestRegistry(
      { [quest.id]: quest },
      KNOWN_CAMPAIGN_IDS,
      KNOWN_ACT_IDS,
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("prerequisite"))).toBe(true);
  });
});
