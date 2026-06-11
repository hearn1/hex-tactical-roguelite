import { describe, expect, it } from "vitest";
import { createRunState, buildParty, defaultPartySpecs } from "./PartySetup.ts";
import { createCampaignState } from "../state/CampaignState.ts";
import { createInventory } from "./Inventory.ts";
import { advanceToNextAct, completeCampaign, recordCampaignLoss } from "./ActTransition.ts";
import { generateCampaignSummary } from "./CampaignSummary.ts";
import { appendAdventureLog } from "./AdventureLog.ts";

function freshRun() {
  return createRunState(buildParty(defaultPartySpecs()), "normal", "short");
}

function freshCampaign(actNumber = 1) {
  const party = buildParty(defaultPartySpecs());
  const campaign = createCampaignState("campaign.verdant_dark", 1, "normal", party, createInventory());
  campaign.currentActNumber = actNumber;
  return campaign;
}

// ── #319: CampaignSummary contract shape ──────────────────────────────────────

describe("generateCampaignSummary — victory (#319)", () => {
  it("reflects won campaignResult after campaign complete", () => {
    const campaign = freshCampaign(4);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    completeCampaign(campaign, run);
    const summary = generateCampaignSummary(campaign);
    expect(summary.campaignResult).toBe("won");
  });

  it("counts actsCompleted from completedActs with runStatus won", () => {
    const campaign = freshCampaign(1);
    const run1 = freshRun();
    run1.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run1);
    const run2 = freshRun();
    run2.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run2);
    const run3 = freshRun();
    run3.mapState.bossDefeated = true;
    completeCampaign(campaign, run3);
    const summary = generateCampaignSummary(campaign);
    expect(summary.actsCompleted).toBe(3);
  });

  it("totals battlesWon across all completed acts", () => {
    const campaign = freshCampaign(1);
    const run1 = freshRun();
    run1.mapState.nodesCleared = 5;
    run1.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run1);
    const run2 = freshRun();
    run2.mapState.nodesCleared = 4;
    run2.mapState.bossDefeated = true;
    completeCampaign(campaign, run2);
    const summary = generateCampaignSummary(campaign);
    expect(summary.battlesWon).toBe(9);
  });

  it("counts bossEncountersCompleted", () => {
    const campaign = freshCampaign(1);
    const run1 = freshRun();
    run1.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run1);
    const run2 = freshRun();
    run2.mapState.bossDefeated = true;
    completeCampaign(campaign, run2);
    const summary = generateCampaignSummary(campaign);
    expect(summary.bossEncountersCompleted).toBe(2);
  });

  it("summary has no lossActNumber on victory", () => {
    const campaign = freshCampaign(4);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    completeCampaign(campaign, run);
    const summary = generateCampaignSummary(campaign);
    expect(summary.lossActNumber).toBeUndefined();
    expect(summary.lossNodeId).toBeUndefined();
  });

  it("includes per-act breakdown entries", () => {
    const campaign = freshCampaign(1);
    const run1 = freshRun();
    run1.mapState.nodesCleared = 3;
    run1.mapState.elitesDefeated = 1;
    run1.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run1);
    const run2 = freshRun();
    run2.mapState.bossDefeated = true;
    completeCampaign(campaign, run2);
    const summary = generateCampaignSummary(campaign);
    expect(summary.actBreakdowns).toHaveLength(2);
    expect(summary.actBreakdowns[0].actNumber).toBe(1);
    expect(summary.actBreakdowns[0].nodesCleared).toBe(3);
  });
});

// ── #320: Loss tracking ────────────────────────────────────────────────────────

describe("generateCampaignSummary — loss (#320)", () => {
  it("reflects lost campaignResult after recordCampaignLoss", () => {
    const campaign = freshCampaign(2);
    const run = freshRun();
    run.runStatus = "lost";
    recordCampaignLoss(campaign, run);
    const summary = generateCampaignSummary(campaign, run);
    expect(summary.campaignResult).toBe("lost");
  });

  it("records lossActNumber from current act", () => {
    const campaign = freshCampaign(2);
    const run = freshRun();
    run.runStatus = "lost";
    recordCampaignLoss(campaign, run);
    const summary = generateCampaignSummary(campaign, run);
    expect(summary.lossActNumber).toBe(2);
  });

  it("records lossNodeId from currentNodeId", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    run.mapState.currentNodeId = "node_4";
    run.runStatus = "lost";
    recordCampaignLoss(campaign, run);
    const summary = generateCampaignSummary(campaign, run);
    expect(summary.lossNodeId).toBe("node_4");
  });

  it("includes in-flight act data in actBreakdowns for losses", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    run.mapState.nodesCleared = 2;
    run.runStatus = "lost";
    recordCampaignLoss(campaign, run);
    const summary = generateCampaignSummary(campaign, run);
    expect(summary.actBreakdowns).toHaveLength(1);
    expect(summary.actBreakdowns[0].runStatus).toBe("lost");
    expect(summary.actBreakdowns[0].nodesCleared).toBe(2);
  });

  it("totals heroDownCount from adventure log for in-flight act", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    appendAdventureLog(run, { kind: "hero_downed", text: "Hero downed.", heroInstanceId: "h1" });
    appendAdventureLog(run, { kind: "hero_downed", text: "Hero downed.", heroInstanceId: "h2" });
    run.runStatus = "lost";
    recordCampaignLoss(campaign, run);
    const summary = generateCampaignSummary(campaign, run);
    expect(summary.heroDownCount).toBe(2);
  });

  it("totals itemsGained from adventure log for in-flight act", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    appendAdventureLog(run, { kind: "loot_gained", text: "Found sword.", itemId: "sword" });
    appendAdventureLog(run, { kind: "loot_gained", text: "Found potion.", itemId: "potion" });
    appendAdventureLog(run, { kind: "loot_gained", text: "Found shield.", itemId: "shield" });
    run.runStatus = "lost";
    recordCampaignLoss(campaign, run);
    const summary = generateCampaignSummary(campaign, run);
    expect(summary.itemsGained).toBe(3);
  });
});

// ── #322: Campaign total aggregation ──────────────────────────────────────────

describe("generateCampaignSummary — aggregation (#322)", () => {
  it("aggregates heroDownCount across multiple completed acts", () => {
    const campaign = freshCampaign(1);

    const run1 = freshRun();
    appendAdventureLog(run1, { kind: "hero_downed", text: "Downed.", heroInstanceId: "h1" });
    run1.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run1);

    const run2 = freshRun();
    appendAdventureLog(run2, { kind: "hero_downed", text: "Downed.", heroInstanceId: "h2" });
    appendAdventureLog(run2, { kind: "hero_downed", text: "Downed.", heroInstanceId: "h3" });
    run2.mapState.bossDefeated = true;
    completeCampaign(campaign, run2);

    const summary = generateCampaignSummary(campaign);
    expect(summary.heroDownCount).toBe(3);
  });

  it("aggregates itemsGained across multiple completed acts", () => {
    const campaign = freshCampaign(1);

    const run1 = freshRun();
    appendAdventureLog(run1, { kind: "loot_gained", text: "Item.", itemId: "sword" });
    appendAdventureLog(run1, { kind: "loot_gained", text: "Item.", itemId: "shield" });
    run1.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run1);

    const run2 = freshRun();
    appendAdventureLog(run2, { kind: "loot_gained", text: "Item.", itemId: "potion" });
    run2.mapState.bossDefeated = true;
    completeCampaign(campaign, run2);

    const summary = generateCampaignSummary(campaign);
    expect(summary.itemsGained).toBe(3);
  });

  it("finalActReached reflects highest act number in breakdowns", () => {
    const campaign = freshCampaign(1);
    const run1 = freshRun();
    run1.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run1);
    const run2 = freshRun();
    run2.mapState.bossDefeated = true;
    completeCampaign(campaign, run2);
    const summary = generateCampaignSummary(campaign);
    expect(summary.finalActReached).toBe(2);
  });

  it("summary generation is independent of story outcome text", () => {
    const campaign = freshCampaign(4);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    completeCampaign(campaign, run);
    const summary = generateCampaignSummary(campaign);
    // outcomeTextKey is intentionally absent — owned by #164
    expect(summary.outcomeTextKey).toBeUndefined();
  });

  it("actBreakdowns are in chronological order", () => {
    const campaign = freshCampaign(1);
    const run1 = freshRun();
    run1.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run1);
    const run2 = freshRun();
    run2.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run2);
    const run3 = freshRun();
    run3.mapState.bossDefeated = true;
    completeCampaign(campaign, run3);
    const summary = generateCampaignSummary(campaign);
    const actNums = summary.actBreakdowns.map((a) => a.actNumber);
    expect(actNums).toEqual([1, 2, 3]);
  });
});
