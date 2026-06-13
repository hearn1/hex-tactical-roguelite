import { describe, expect, it } from "vitest";
import { createRunState, buildParty, defaultPartySpecs } from "./PartySetup.ts";
import { createCampaignState } from "../state/CampaignState.ts";
import { createInventory } from "./Inventory.ts";
import {
  CAMPAIGN_TOTAL_ACTS,
  isActComplete,
  isFinalAct,
  applyBetweenActReset,
  advanceToNextAct,
  completeCampaign,
} from "./ActTransition.ts";

function freshRun() {
  return createRunState(buildParty(defaultPartySpecs()), "normal", "short");
}

function freshCampaign(actNumber = 1) {
  const party = buildParty(defaultPartySpecs());
  const campaign = createCampaignState("campaign.verdant_dark", 1, "normal", party, createInventory());
  campaign.currentActNumber = actNumber;
  return campaign;
}

// ── #315: Act completion contract ─────────────────────────────────────────────

describe("act completion contract (#315)", () => {
  it("isActComplete returns false before boss is defeated", () => {
    expect(isActComplete(freshRun())).toBe(false);
  });

  it("isActComplete returns true when bossDefeated is set", () => {
    const run = freshRun();
    run.mapState.bossDefeated = true;
    expect(isActComplete(run)).toBe(true);
  });

  it("isFinalAct returns false for acts 1 through 3", () => {
    expect(isFinalAct(1)).toBe(false);
    expect(isFinalAct(2)).toBe(false);
    expect(isFinalAct(3)).toBe(false);
  });

  it(`isFinalAct returns true for act ${CAMPAIGN_TOTAL_ACTS} (final act)`, () => {
    expect(isFinalAct(CAMPAIGN_TOTAL_ACTS)).toBe(true);
  });

  it("act completion and campaign completion are distinct decisions", () => {
    const run = freshRun();
    run.mapState.bossDefeated = true;
    // Act 1 completed → not the campaign end
    expect(isActComplete(run)).toBe(true);
    expect(isFinalAct(1)).toBe(false);
    // Act 4 completed → campaign ends
    expect(isFinalAct(4)).toBe(true);
  });
});

// ── #316: Between-act state reset ─────────────────────────────────────────────

describe("between-act reset (#316)", () => {
  it("refills HP to maxHp for all party members", () => {
    const party = buildParty(defaultPartySpecs());
    for (const pm of party) pm.hp = 1;
    applyBetweenActReset(party);
    for (const pm of party) expect(pm.hp).toBe(pm.maxHp);
  });

  it("clears deadForRun state and restores HP", () => {
    const party = buildParty(defaultPartySpecs());
    party[0].deadForRun = true;
    party[0].hp = 0;
    applyBetweenActReset(party);
    expect(party[0].deadForRun).toBe(false);
    expect(party[0].hp).toBe(party[0].maxHp);
  });

  it("restores spell slots to max", () => {
    const party = buildParty(defaultPartySpecs());
    for (const pm of party) {
      pm.spellSlotsMax = 3;
      pm.spellSlotsRemaining = 0;
    }
    applyBetweenActReset(party);
    for (const pm of party) expect(pm.spellSlotsRemaining).toBe(pm.spellSlotsMax);
  });

  it("restores hit dice to full", () => {
    const party = buildParty(defaultPartySpecs());
    for (const pm of party) {
      pm.hitDiceTotal = 2;
      pm.hitDiceRemaining = 0;
    }
    applyBetweenActReset(party);
    for (const pm of party) expect(pm.hitDiceRemaining).toBe(pm.hitDiceTotal);
  });
});

// ── advanceToNextAct carry-forward rules ──────────────────────────────────────

describe("advanceToNextAct carry-forward (#316)", () => {
  it("increments campaign currentActNumber", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run);
    expect(campaign.currentActNumber).toBe(2);
  });

  it("archives the completed act in campaign.completedActs", () => {
    const campaign = freshCampaign(2);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    run.mapState.nodesCleared = 7;
    advanceToNextAct(campaign, run);
    expect(campaign.completedActs).toHaveLength(1);
    const archived = campaign.completedActs[0];
    expect(archived.actNumber).toBe(2);
    expect(archived.runStatus).toBe("won");
    expect(archived.nodesCleared).toBe(7);
    expect(archived.bossDefeated).toBe(true);
  });

  it("returns a new RunState with party fully healed", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    run.party[0].hp = 1;
    const nextRun = advanceToNextAct(campaign, run);
    expect(nextRun.party[0].hp).toBe(nextRun.party[0].maxHp);
  });

  it("carries forward gold from the completed run", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    run.gold = 175;
    const nextRun = advanceToNextAct(campaign, run);
    expect(nextRun.gold).toBe(175);
  });

  it("carries forward run modifiers into campaign", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    run.runModifiers = [{ kind: "gold_multiplier", value: 1.5 }];
    advanceToNextAct(campaign, run);
    expect(campaign.runModifiers).toEqual([{ kind: "gold_multiplier", value: 1.5 }]);
  });

  it("new run starts with shortRestsSinceLongRest reset to 0", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    run.shortRestsSinceLongRest = 2;
    const nextRun = advanceToNextAct(campaign, run);
    expect(nextRun.shortRestsSinceLongRest).toBe(0);
  });

  it("revives a dead party member for the next act", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    run.party[1].deadForRun = true;
    run.party[1].hp = 0;
    const nextRun = advanceToNextAct(campaign, run);
    expect(nextRun.party[1].deadForRun).toBeFalsy();
    expect(nextRun.party[1].hp).toBeGreaterThan(0);
  });

  it("propagates campaign eventSelections (flags) into next-act RunState (#399)", () => {
    const campaign = freshCampaign(1);
    campaign.eventSelections["flag.sq.act1.goblin_relic.completed"] = "set";
    const run = freshRun();
    run.mapState.bossDefeated = true;
    const nextRun = advanceToNextAct(campaign, run);
    expect(nextRun.eventSelections["flag.sq.act1.goblin_relic.completed"]).toBe("set");
  });

  it("is idempotent — calling twice for the same run does not double-archive or skip an act (#496)", () => {
    const campaign = freshCampaign(1);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    advanceToNextAct(campaign, run);
    advanceToNextAct(campaign, run);
    expect(campaign.completedActs).toHaveLength(1);
    expect(campaign.currentActNumber).toBe(2);
  });
});

// ── #318: Final-act routing ───────────────────────────────────────────────────

describe("completeCampaign (#318)", () => {
  it("marks campaign as won", () => {
    const campaign = freshCampaign(4);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    completeCampaign(campaign, run);
    expect(campaign.campaignStatus).toBe("won");
  });

  it("archives the final act", () => {
    const campaign = freshCampaign(4);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    completeCampaign(campaign, run);
    expect(campaign.completedActs).toHaveLength(1);
    expect(campaign.completedActs[0].actNumber).toBe(4);
    expect(campaign.completedActs[0].runStatus).toBe("won");
  });

  it("does not attempt to load Act 5", () => {
    const campaign = freshCampaign(4);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    completeCampaign(campaign, run);
    expect(campaign.currentActNumber).toBe(4);
  });

  it("is idempotent — calling twice does not double-archive", () => {
    const campaign = freshCampaign(4);
    const run = freshRun();
    run.mapState.bossDefeated = true;
    completeCampaign(campaign, run);
    completeCampaign(campaign, run);
    expect(campaign.completedActs).toHaveLength(1);
  });
});
