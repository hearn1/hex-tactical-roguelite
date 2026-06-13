// #368 — Apply side quest rewards through existing reward systems
// #369 — Apply side quest consequences and outcome hooks

import type { CampaignState } from "../state/CampaignState.ts";
import type { InventoryState } from "./Inventory.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";
import type { QuestConsequenceDef, QuestRewardDef } from "../data/questOutcomeHooks.ts";
import { getQuestOutcomeHook } from "../data/questOutcomeHooks.ts";

// ---------------------------------------------------------------------------
// Idempotency query
// ---------------------------------------------------------------------------

/**
 * Returns true if the given outcome hook has already been applied to this
 * campaign run. Use before calling applyQuestOutcomeHook to check without
 * triggering a no-op application.
 */
export function hasQuestOutcomeHookApplied(
  hookId: string,
  campaign: Pick<CampaignState, "appliedQuestOutcomeHookIds">,
): boolean {
  return campaign.appliedQuestOutcomeHookIds.includes(hookId);
}

// ---------------------------------------------------------------------------
// Internal: reward application
// ---------------------------------------------------------------------------

function applyReward(
  reward: QuestRewardDef,
  inventory: InventoryState,
  party: PartyMember[],
): void {
  switch (reward.kind) {
    case "gold":
      inventory.gold += reward.amount;
      break;
    case "xp":
      for (const member of party) {
        member.xp += reward.amountPerHero;
      }
      break;
    case "item":
      inventory.items.push(reward.itemId);
      break;
    case "potion":
      inventory.potions.push(reward.potionId);
      break;
  }
}

// ---------------------------------------------------------------------------
// Internal: consequence application
// ---------------------------------------------------------------------------

function applyConsequence(
  consequence: QuestConsequenceDef,
  campaign: CampaignState,
  run?: Pick<RunState, "runModifiers">,
): void {
  switch (consequence.kind) {
    case "run_modifier":
      // Run modifiers (boss/enemy combat effects) must land on the live run, since combat
      // reads run.runModifiers (createCombatFromRun). campaign.runModifiers is only a
      // carry-forward snapshot rebuilt at act transitions, so writing there would never
      // reach the boss/encounter the quest is meant to modify. Fall back to the campaign
      // only when no run is supplied (pure-campaign callers/tests).
      (run ?? campaign).runModifiers.push(consequence.modifier);
      break;
    case "campaign_flag":
      campaign.eventSelections[consequence.flagId] = "set";
      break;
    case "log_entry": {
      const index = campaign.adventureLog.length;
      campaign.adventureLog.push({
        id: `${index}:quest_outcome:${index}`,
        index,
        kind: "quest_outcome",
        text: consequence.message,
        sourceKey: `quest_outcome:${consequence.message}`,
      });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface ApplyQuestOutcomeResult {
  applied: boolean;
  /**
   * "ok"              — rewards and consequences were applied.
   * "already_applied" — idempotency guard fired; nothing changed.
   * "no_hook"         — hookId is not in the registry; nothing changed.
   */
  reason: "ok" | "already_applied" | "no_hook";
}

/**
 * Applies the rewards and consequences for a quest outcome hook to the campaign
 * state. Safe to call multiple times for the same hookId — the second call is a
 * no-op and returns `{ applied: false, reason: "already_applied" }`.
 *
 * The hook must be registered in QUEST_OUTCOME_HOOK_REGISTRY (questOutcomeHooks.ts).
 * Unknown hook ids are silently ignored and return `{ applied: false, reason: "no_hook" }`.
 *
 * Pass the live `run` so `run_modifier` consequences (boss/enemy combat effects) reach the
 * run modifiers combat actually reads. Omitting it routes them to campaign.runModifiers,
 * which is only kept for backward-compatible pure-campaign callers/tests.
 */
export function applyQuestOutcomeHook(
  hookId: string,
  campaign: CampaignState,
  run?: Pick<RunState, "runModifiers">,
): ApplyQuestOutcomeResult {
  if (hasQuestOutcomeHookApplied(hookId, campaign)) {
    return { applied: false, reason: "already_applied" };
  }

  const hookDef = getQuestOutcomeHook(hookId);
  if (!hookDef) {
    return { applied: false, reason: "no_hook" };
  }

  for (const reward of hookDef.rewards) {
    applyReward(reward, campaign.inventory, campaign.party);
  }
  for (const consequence of hookDef.consequences) {
    applyConsequence(consequence, campaign, run);
  }

  campaign.appliedQuestOutcomeHookIds.push(hookId);
  return { applied: true, reason: "ok" };
}
