// #497 — Milestone 3 audit: deterministic side quest + cross-act consequence smoke path.
//
// Covers the runtime flow end to end:
//   1. start an Act 1 side quest and complete it;
//   2. verify the reward applies once (gold/item/flag);
//   3. verify the boss_encounter_modifier reaches the live run and actually scales the boss
//      in combat (the bug this issue fixes — modifiers were written to campaign.runModifiers,
//      which combat never reads);
//   4. transition to the next act and verify the campaign flag carries forward;
//   5. verify the flag drives a cross-act conditional encounter and gates a cross-act event;
//   6. verify skipping the quest leaves the main path valid and the cross-act content hidden.

import { describe, it, expect } from "vitest";
import { createRng } from "../../src/core/rng.ts";
import { createCampaignState } from "../../src/state/CampaignState.ts";
import { createInventory } from "../../src/run/Inventory.ts";
import { createRunState, buildParty, defaultPartySpecs } from "../../src/run/PartySetup.ts";
import { createCombatFromRun } from "../../src/state/GameState.ts";
import { advanceToNextAct } from "../../src/run/ActTransition.ts";
import { startQuest, completeQuest, skipQuest } from "../../src/run/QuestState.ts";
import { applyQuestOutcomeHook } from "../../src/run/QuestOutcomeApplicator.ts";
import { evaluateRequirements } from "../../src/run/Events.ts";
import { NODE_REGISTRY, resolveNodeEncounterId } from "../../src/data/nodes.ts";
import { EVENT_REGISTRY } from "../../src/data/events.ts";

const GOBLIN_RELIC = "sq.act1.goblin_relic";
const GOBLIN_RELIC_COMPLETED = "outcome.sq.act1.goblin_relic.completed";
const GOBLIN_RELIC_FLAG = "flag.sq.act1.goblin_relic.completed";
const BOSS_ENCOUNTER = "encounter.boss_ogre_hexbreaker";

function freshCampaign() {
  const party = buildParty(defaultPartySpecs());
  return createCampaignState("campaign.verdant_dark", 1, "normal", party, createInventory());
}

describe("side quest smoke path — Act 1 completion → reward → boss modifier (#497)", () => {
  it("completing the quest grants the reward once and the boss modifier reaches combat", () => {
    const campaign = freshCampaign();
    const run = createRunState(campaign.party, "normal");

    startQuest(campaign.questProgress, GOBLIN_RELIC, 1);
    completeQuest(campaign.questProgress, GOBLIN_RELIC, GOBLIN_RELIC_COMPLETED, 1);
    const result = applyQuestOutcomeHook(GOBLIN_RELIC_COMPLETED, campaign, run);

    // Reward applied once to the shared inventory.
    expect(result.applied).toBe(true);
    expect(campaign.inventory.gold).toBe(30);
    expect(campaign.inventory.items).toContain("item.hearthstone_charm");
    // Flag persisted to the campaign so later acts/events can react.
    expect(campaign.eventSelections[GOBLIN_RELIC_FLAG]).toBe("set");
    // Boss modifier landed on the live run (what combat reads), not the dead-end campaign list.
    expect(run.runModifiers.some((m) => m.kind === "boss_encounter_modifier")).toBe(true);

    // End to end: the modifier actually scales the boss when combat is built. Base 42 HP * 0.80.
    const combat = createCombatFromRun(run, BOSS_ENCOUNTER, createRng(1));
    const boss = combat.units.find((u) => u.defId === "enemy.ogre_hexbreaker");
    expect(boss).toBeDefined();
    expect(boss!.stats.maxHp).toBe(Math.round(42 * 0.8));
  });

  it("re-applying the same outcome is a no-op (rewards and modifiers not duplicated)", () => {
    const campaign = freshCampaign();
    const run = createRunState(campaign.party, "normal");

    startQuest(campaign.questProgress, GOBLIN_RELIC, 1);
    completeQuest(campaign.questProgress, GOBLIN_RELIC, GOBLIN_RELIC_COMPLETED, 1);
    applyQuestOutcomeHook(GOBLIN_RELIC_COMPLETED, campaign, run);
    const second = applyQuestOutcomeHook(GOBLIN_RELIC_COMPLETED, campaign, run);

    expect(second.applied).toBe(false);
    expect(second.reason).toBe("already_applied");
    expect(campaign.inventory.gold).toBe(30);
    expect(run.runModifiers.filter((m) => m.kind === "boss_encounter_modifier")).toHaveLength(1);
  });
});

describe("side quest smoke path — cross-act carry-forward (#497)", () => {
  it("carries the Act 1 flag into the next act and drives the conditional encounter + event", () => {
    const campaign = freshCampaign();
    const run = createRunState(campaign.party, "normal");

    startQuest(campaign.questProgress, GOBLIN_RELIC, 1);
    completeQuest(campaign.questProgress, GOBLIN_RELIC, GOBLIN_RELIC_COMPLETED, 1);
    applyQuestOutcomeHook(GOBLIN_RELIC_COMPLETED, campaign, run);

    run.mapState.bossDefeated = true;
    const nextRun = advanceToNextAct(campaign, run);

    // Flag survives the transition into the next act's run.
    expect(nextRun.eventSelections[GOBLIN_RELIC_FLAG]).toBe("set");

    // Cross-act conditional encounter resolves to the weakened variant when the flag is set.
    const node = NODE_REGISTRY["node.act2_side1_combat"];
    expect(node).toBeDefined();
    expect(resolveNodeEncounterId(node, createRng(1), nextRun.eventSelections)).toBe(
      "encounter.sq.deserter_cache.weakened_patrol",
    );

    // Cross-act event "claim" choice is unlocked only when the flag is present.
    const echo = EVENT_REGISTRY["event.sq.act1.goblin_relic.echo"];
    const claim = echo.choices.find((c) => c.id === "event.sq.act1.goblin_relic.echo.claim")!;
    expect(evaluateRequirements(claim, nextRun).ok).toBe(true);
  });

  it("skipping the quest leaves the main path valid and hides the cross-act content", () => {
    const campaign = freshCampaign();
    const run = createRunState(campaign.party, "normal");

    startQuest(campaign.questProgress, GOBLIN_RELIC, 1);
    const skip = skipQuest(campaign.questProgress, GOBLIN_RELIC, 1);
    expect(skip.ok).toBe(true);
    // Skipping fires no outcome hook, so no flag is set.
    expect(campaign.eventSelections[GOBLIN_RELIC_FLAG]).toBeUndefined();

    run.mapState.bossDefeated = true;
    const nextRun = advanceToNextAct(campaign, run);

    // Conditional encounter falls back to the normal pick (not the weakened variant).
    const node = NODE_REGISTRY["node.act2_side1_combat"];
    const resolved = resolveNodeEncounterId(node, createRng(1), nextRun.eventSelections);
    expect(resolved).not.toBe("encounter.sq.deserter_cache.weakened_patrol");

    // Cross-act "claim" choice stays gated.
    const echo = EVENT_REGISTRY["event.sq.act1.goblin_relic.echo"];
    const claim = echo.choices.find((c) => c.id === "event.sq.act1.goblin_relic.echo.claim")!;
    expect(evaluateRequirements(claim, nextRun).ok).toBe(false);
  });
});
