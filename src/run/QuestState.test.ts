// #363 — Quest state regression tests

import { describe, expect, it } from "vitest";
import {
  initQuestProgress,
  startQuest,
  advanceQuest,
  completeQuest,
  failQuest,
  skipQuest,
  getQuestState,
  aggregateQuestCounts,
  snapshotQuestOutcomesForAct,
} from "./QuestState.ts";
import type { SideQuestDefinition } from "../data/sideQuests.ts";
import { createCampaignState } from "../state/CampaignState.ts";
import { buildParty, defaultPartySpecs, createRunState } from "./PartySetup.ts";
import { createInventory } from "./Inventory.ts";
import { advanceToNextAct, completeCampaign } from "./ActTransition.ts";
import { generateCampaignSummary } from "./CampaignSummary.ts";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const TWO_STAGE_QUEST: SideQuestDefinition = {
  id: "sq.test.two_stage",
  displayName: "Test Quest",
  actId: "act_1",
  campaignId: "campaign.verdant_dark",
  outcomeHookIds: ["outcome.sq.test.two_stage.completed", "outcome.sq.test.two_stage.failed"],
  stages: [
    {
      id: "sq.test.two_stage.stage_1",
      description: "Stage 1",
      steps: [
        { id: "sq.test.two_stage.stage_1.step_1", description: "Step 1" },
        { id: "sq.test.two_stage.stage_1.step_2", description: "Step 2" },
      ],
    },
    {
      id: "sq.test.two_stage.stage_2",
      description: "Stage 2",
      steps: [{ id: "sq.test.two_stage.stage_2.step_1", description: "Step 1" }],
    },
  ],
};

const ONE_STAGE_QUEST: SideQuestDefinition = {
  id: "sq.test.one_stage",
  displayName: "One Stage Quest",
  actId: "act_2",
  campaignId: "campaign.verdant_dark",
  outcomeHookIds: ["outcome.sq.test.one_stage.completed"],
  stages: [
    {
      id: "sq.test.one_stage.stage_1",
      description: "Stage 1",
      steps: [{ id: "sq.test.one_stage.stage_1.step_1", description: "Only step" }],
    },
  ],
};

function freshCampaign() {
  const party = buildParty(defaultPartySpecs());
  return createCampaignState("campaign.verdant_dark", 1, "normal", party, createInventory());
}

function freshRun() {
  return createRunState(buildParty(defaultPartySpecs()), "normal", "short");
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe("initQuestProgress (#361)", () => {
  it("returns an empty record", () => {
    expect(initQuestProgress()).toEqual({});
  });

  it("new campaign has empty questProgress", () => {
    const campaign = freshCampaign();
    expect(campaign.questProgress).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// startQuest
// ---------------------------------------------------------------------------

describe("startQuest (#361)", () => {
  it("creates active quest state for a new quest id", () => {
    const p = initQuestProgress();
    const result = startQuest(p, "sq.test.two_stage", 1);
    expect(result.ok).toBe(true);
    const state = getQuestState(p, "sq.test.two_stage");
    expect(state?.status).toBe("active");
    expect(state?.currentStageIndex).toBe(0);
    expect(state?.currentStepIndex).toBe(0);
    expect(state?.startedAtActNumber).toBe(1);
  });

  it("is idempotent when called twice for an already-active quest", () => {
    const p = initQuestProgress();
    startQuest(p, "sq.test.two_stage", 1);
    const result = startQuest(p, "sq.test.two_stage", 1);
    expect(result.ok).toBe(true);
    expect(Object.keys(p)).toHaveLength(1);
  });

  it("errors when quest is already completed", () => {
    const p = initQuestProgress();
    startQuest(p, "sq.test.two_stage", 1);
    completeQuest(p, "sq.test.two_stage", "outcome.done", 1);
    const result = startQuest(p, "sq.test.two_stage", 2);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/terminal/);
  });

  it("errors when quest is already failed", () => {
    const p = initQuestProgress();
    startQuest(p, "sq.test.two_stage", 1);
    failQuest(p, "sq.test.two_stage", 1);
    const result = startQuest(p, "sq.test.two_stage", 2);
    expect(result.ok).toBe(false);
  });

  it("errors when quest is already skipped", () => {
    const p = initQuestProgress();
    startQuest(p, "sq.test.two_stage", 1);
    skipQuest(p, "sq.test.two_stage", 1);
    const result = startQuest(p, "sq.test.two_stage", 2);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// advanceQuest
// ---------------------------------------------------------------------------

describe("advanceQuest (#361)", () => {
  it("advances to the next step within the same stage", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    const result = advanceQuest(p, TWO_STAGE_QUEST.id, TWO_STAGE_QUEST);
    expect(result.ok).toBe(true);
    const state = getQuestState(p, TWO_STAGE_QUEST.id)!;
    expect(state.currentStageIndex).toBe(0);
    expect(state.currentStepIndex).toBe(1);
  });

  it("advances to the next stage when current stage is exhausted", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    advanceQuest(p, TWO_STAGE_QUEST.id, TWO_STAGE_QUEST); // step 0→1 (stage 0 has 2 steps)
    const result = advanceQuest(p, TWO_STAGE_QUEST.id, TWO_STAGE_QUEST); // step exhausted → stage 0→1
    expect(result.ok).toBe(true);
    const state = getQuestState(p, TWO_STAGE_QUEST.id)!;
    expect(state.currentStageIndex).toBe(1);
    expect(state.currentStepIndex).toBe(0);
  });

  it("errors when already at final stage and step", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    advanceQuest(p, TWO_STAGE_QUEST.id, TWO_STAGE_QUEST); // stage0 step0→1
    advanceQuest(p, TWO_STAGE_QUEST.id, TWO_STAGE_QUEST); // stage0→stage1, step=0
    const result = advanceQuest(p, TWO_STAGE_QUEST.id, TWO_STAGE_QUEST); // stage1 has 1 step
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/final/);
  });

  it("errors when quest has not been started", () => {
    const p = initQuestProgress();
    const result = advanceQuest(p, "sq.unknown", TWO_STAGE_QUEST);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not been started/);
  });

  it("errors when quest is not active", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    completeQuest(p, TWO_STAGE_QUEST.id, "outcome.done", 1);
    const result = advanceQuest(p, TWO_STAGE_QUEST.id, TWO_STAGE_QUEST);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not active/);
  });
});

// ---------------------------------------------------------------------------
// completeQuest
// ---------------------------------------------------------------------------

describe("completeQuest (#361)", () => {
  it("stores completion state and outcome hook id", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    const result = completeQuest(p, TWO_STAGE_QUEST.id, "outcome.sq.test.two_stage.completed", 1);
    expect(result.ok).toBe(true);
    const state = getQuestState(p, TWO_STAGE_QUEST.id)!;
    expect(state.status).toBe("completed");
    expect(state.resolvedOutcomeHookId).toBe("outcome.sq.test.two_stage.completed");
    expect(state.resolvedAtActNumber).toBe(1);
  });

  it("is idempotent when called twice", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    completeQuest(p, TWO_STAGE_QUEST.id, "outcome.sq.test.two_stage.completed", 1);
    const result = completeQuest(p, TWO_STAGE_QUEST.id, "outcome.sq.test.two_stage.completed", 2);
    expect(result.ok).toBe(true);
    expect(getQuestState(p, TWO_STAGE_QUEST.id)?.resolvedAtActNumber).toBe(1);
  });

  it("errors when quest has not been started", () => {
    const p = initQuestProgress();
    const result = completeQuest(p, "sq.unknown", "outcome.done", 1);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not been started/);
  });

  it("errors when quest is already failed", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    failQuest(p, TWO_STAGE_QUEST.id, 1);
    const result = completeQuest(p, TWO_STAGE_QUEST.id, "outcome.done", 1);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/terminal/);
  });
});

// ---------------------------------------------------------------------------
// failQuest
// ---------------------------------------------------------------------------

describe("failQuest (#361)", () => {
  it("stores failed state", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    const result = failQuest(p, TWO_STAGE_QUEST.id, 1);
    expect(result.ok).toBe(true);
    const state = getQuestState(p, TWO_STAGE_QUEST.id)!;
    expect(state.status).toBe("failed");
    expect(state.resolvedAtActNumber).toBe(1);
  });

  it("is idempotent when called twice", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    failQuest(p, TWO_STAGE_QUEST.id, 1);
    const result = failQuest(p, TWO_STAGE_QUEST.id, 2);
    expect(result.ok).toBe(true);
    expect(getQuestState(p, TWO_STAGE_QUEST.id)?.resolvedAtActNumber).toBe(1);
  });

  it("does not override a completed quest", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    completeQuest(p, TWO_STAGE_QUEST.id, "outcome.done", 1);
    const result = failQuest(p, TWO_STAGE_QUEST.id, 1);
    expect(result.ok).toBe(false);
    expect(getQuestState(p, TWO_STAGE_QUEST.id)?.status).toBe("completed");
  });

  it("errors when quest has not been started", () => {
    const p = initQuestProgress();
    const result = failQuest(p, "sq.unknown", 1);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// skipQuest
// ---------------------------------------------------------------------------

describe("skipQuest (#361)", () => {
  it("stores skipped state", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    const result = skipQuest(p, TWO_STAGE_QUEST.id, 1);
    expect(result.ok).toBe(true);
    expect(getQuestState(p, TWO_STAGE_QUEST.id)?.status).toBe("skipped");
  });

  it("is idempotent when called twice", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    skipQuest(p, TWO_STAGE_QUEST.id, 1);
    const result = skipQuest(p, TWO_STAGE_QUEST.id, 2);
    expect(result.ok).toBe(true);
  });

  it("errors when quest is completed", () => {
    const p = initQuestProgress();
    startQuest(p, TWO_STAGE_QUEST.id, 1);
    completeQuest(p, TWO_STAGE_QUEST.id, "outcome.done", 1);
    const result = skipQuest(p, TWO_STAGE_QUEST.id, 1);
    expect(result.ok).toBe(false);
  });

  it("errors when quest has not been started", () => {
    const p = initQuestProgress();
    const result = skipQuest(p, "sq.unknown", 1);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// aggregateQuestCounts
// ---------------------------------------------------------------------------

describe("aggregateQuestCounts (#361)", () => {
  it("returns all zeros for empty progress", () => {
    expect(aggregateQuestCounts({})).toEqual({
      completed: 0,
      failed: 0,
      skipped: 0,
      active: 0,
    });
  });

  it("counts each status correctly", () => {
    const p = initQuestProgress();
    startQuest(p, "q1", 1);
    completeQuest(p, "q1", "hook1", 1);
    startQuest(p, "q2", 1);
    failQuest(p, "q2", 1);
    startQuest(p, "q3", 1);
    skipQuest(p, "q3", 1);
    startQuest(p, "q4", 1);
    // q4 remains active
    const counts = aggregateQuestCounts(p);
    expect(counts.completed).toBe(1);
    expect(counts.failed).toBe(1);
    expect(counts.skipped).toBe(1);
    expect(counts.active).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// snapshotQuestOutcomesForAct
// ---------------------------------------------------------------------------

describe("snapshotQuestOutcomesForAct (#362)", () => {
  it("returns only quests resolved in the given act", () => {
    const p = initQuestProgress();
    startQuest(p, "q1", 1);
    completeQuest(p, "q1", "hook1", 1);
    startQuest(p, "q2", 1);
    failQuest(p, "q2", 2);
    const snapshot = snapshotQuestOutcomesForAct(p, 1);
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].questId).toBe("q1");
    expect(snapshot[0].status).toBe("completed");
    expect(snapshot[0].resolvedOutcomeHookId).toBe("hook1");
  });

  it("returns empty array when no quests resolved in the act", () => {
    const p = initQuestProgress();
    startQuest(p, "q1", 1);
    expect(snapshotQuestOutcomesForAct(p, 1)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Act transition carry-forward (#362)
// ---------------------------------------------------------------------------

describe("quest state survives act transition (#362)", () => {
  it("active quest persists after advanceToNextAct", () => {
    const campaign = freshCampaign();
    startQuest(campaign.questProgress, TWO_STAGE_QUEST.id, 1);

    const run = freshRun();
    run.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run);

    const state = getQuestState(campaign.questProgress, TWO_STAGE_QUEST.id);
    expect(state?.status).toBe("active");
  });

  it("completed quest persists after advanceToNextAct", () => {
    const campaign = freshCampaign();
    startQuest(campaign.questProgress, TWO_STAGE_QUEST.id, 1);
    completeQuest(campaign.questProgress, TWO_STAGE_QUEST.id, "outcome.done", 1);

    const run = freshRun();
    run.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run);

    const state = getQuestState(campaign.questProgress, TWO_STAGE_QUEST.id);
    expect(state?.status).toBe("completed");
  });

  it("failed quest persists after advanceToNextAct", () => {
    const campaign = freshCampaign();
    startQuest(campaign.questProgress, TWO_STAGE_QUEST.id, 1);
    failQuest(campaign.questProgress, TWO_STAGE_QUEST.id, 1);

    const run = freshRun();
    run.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run);

    const state = getQuestState(campaign.questProgress, TWO_STAGE_QUEST.id);
    expect(state?.status).toBe("failed");
  });

  it("quest outcomes are archived in CompletedActSummary", () => {
    const campaign = freshCampaign();
    startQuest(campaign.questProgress, TWO_STAGE_QUEST.id, 1);
    completeQuest(campaign.questProgress, TWO_STAGE_QUEST.id, "outcome.done", 1);

    const run = freshRun();
    run.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run);

    expect(campaign.completedActs[0].questOutcomes).toHaveLength(1);
    expect(campaign.completedActs[0].questOutcomes[0].questId).toBe(TWO_STAGE_QUEST.id);
    expect(campaign.completedActs[0].questOutcomes[0].status).toBe("completed");
  });

  it("quest progress survives two act transitions", () => {
    const campaign = freshCampaign();
    startQuest(campaign.questProgress, TWO_STAGE_QUEST.id, 1);

    const run1 = freshRun();
    run1.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run1);

    completeQuest(campaign.questProgress, TWO_STAGE_QUEST.id, "outcome.done", 2);

    const run2 = freshRun();
    run2.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run2);

    expect(getQuestState(campaign.questProgress, TWO_STAGE_QUEST.id)?.status).toBe("completed");
    expect(getQuestState(campaign.questProgress, TWO_STAGE_QUEST.id)?.resolvedAtActNumber).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Campaign summary quest hooks (#362)
// ---------------------------------------------------------------------------

describe("campaign summary quest counts (#362)", () => {
  it("questsCompleted reflects completed quests", () => {
    const campaign = freshCampaign();
    startQuest(campaign.questProgress, TWO_STAGE_QUEST.id, 1);
    completeQuest(campaign.questProgress, TWO_STAGE_QUEST.id, "outcome.done", 1);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    completeCampaign(campaign, run);
    const summary = generateCampaignSummary(campaign);
    expect(summary.questsCompleted).toBe(1);
    expect(summary.questsFailed).toBe(0);
    expect(summary.questsSkipped).toBe(0);
  });

  it("questsFailed reflects failed quests", () => {
    const campaign = freshCampaign();
    startQuest(campaign.questProgress, TWO_STAGE_QUEST.id, 1);
    failQuest(campaign.questProgress, TWO_STAGE_QUEST.id, 1);
    startQuest(campaign.questProgress, ONE_STAGE_QUEST.id, 1);
    skipQuest(campaign.questProgress, ONE_STAGE_QUEST.id, 1);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    completeCampaign(campaign, run);
    const summary = generateCampaignSummary(campaign);
    expect(summary.questsFailed).toBe(1);
    expect(summary.questsSkipped).toBe(1);
  });

  it("returns zeros when no quests tracked", () => {
    const campaign = freshCampaign();
    const run = freshRun();
    run.mapState.bossDefeated = true;
    completeCampaign(campaign, run);
    const summary = generateCampaignSummary(campaign);
    expect(summary.questsCompleted).toBe(0);
    expect(summary.questsFailed).toBe(0);
    expect(summary.questsSkipped).toBe(0);
  });
});
