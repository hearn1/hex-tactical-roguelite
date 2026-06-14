import type { CampaignState, CompletedActSummary } from "../state/CampaignState.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";
import type { RunModifier } from "../state/types.ts";
import { createRunState } from "./PartySetup.ts";
import { syncHitDiceForPartyMember, syncSpellSlotsForPartyMember } from "./Rest.ts";
import { DEFAULT_MAP_TEMPLATE_ID } from "../data/nodes.ts";
import { DEFAULT_CAMPAIGN, getActDefinition, selectActMapTemplate } from "../data/campaigns.ts";
import { snapshotQuestOutcomesForAct } from "./QuestState.ts";

export const CAMPAIGN_TOTAL_ACTS = 4;

/**
 * Returns true for RunModifier kinds that carry forward across act boundaries
 * (campaign-wide boons). One-shot and per-encounter modifiers return false and
 * are dropped when seeding the next act's run.
 *
 * Classification:
 *   - next_combat_blessing  → per-act one-shot; does not cross act boundary
 *   - boss_encounter_modifier → tied to a specific encounter id; irrelevant in future acts
 *   - everything else        → campaign-persistent; carries forward
 */
export function isPersistentModifier(mod: RunModifier): boolean {
  return mod.kind !== "next_combat_blessing" && mod.kind !== "boss_encounter_modifier";
}

/**
 * Completed runs that have already been archived by {@link advanceToNextAct}. Guards
 * against a transition being applied twice for the same act (e.g. a double-clicked
 * "Continue" button firing before the screen re-renders), which would otherwise
 * double-archive the act and skip the next one. Kept module-private and keyed on the
 * run object so {@link CampaignState} stays serializable.
 */
const archivedRuns = new WeakSet<RunState>();

/** True when the current act's boss has been defeated. */
export function isActComplete(run: RunState): boolean {
  return run.mapState.bossDefeated;
}

/** True when this act number is the last configured act in the campaign. */
export function isFinalAct(actNumber: number): boolean {
  return actNumber >= CAMPAIGN_TOTAL_ACTS;
}

/**
 * Applies the between-act long-rest-style reset to every party member:
 * refills HP, restores hit dice and spell slots, clears downed/dead state.
 * Conditions live on UnitInstance (combat only) and reset automatically at
 * the start of each new combat, so no explicit clear is needed here.
 */
export function applyBetweenActReset(party: PartyMember[]): void {
  for (const pm of party) {
    pm.deadForRun = false;
    pm.hp = pm.maxHp;
    syncHitDiceForPartyMember(pm);
    pm.hitDiceRemaining = pm.hitDiceTotal ?? pm.level;
    syncSpellSlotsForPartyMember(pm);
    pm.spellSlotsRemaining = pm.spellSlotsMax ?? 0;
  }
}

function buildActSummary(campaign: CampaignState, run: RunState): CompletedActSummary {
  const log = run.adventureLog ?? [];
  return {
    actId: `act_${campaign.currentActNumber}`,
    actNumber: campaign.currentActNumber,
    nodesCleared: run.mapState.nodesCleared,
    elitesDefeated: run.mapState.elitesDefeated,
    bossDefeated: run.mapState.bossDefeated,
    goldEarned: run.gold,
    heroDownCount: log.filter((e) => e.kind === "hero_downed").length,
    itemsGained: log.filter((e) => e.kind === "loot_gained").length,
    runStatus: "won",
    mapSnapshot: { ...run.mapState },
    questOutcomes: snapshotQuestOutcomesForAct(
      campaign.questProgress,
      campaign.currentActNumber,
    ),
  };
}

/**
 * Selects the map template id for the given 1-indexed act number using the
 * campaign definition. Falls back to DEFAULT_MAP_TEMPLATE_ID for unknown acts.
 * Pass a seeded `rng` to make selection deterministic; defaults to Math.random.
 */
export function templateIdForAct(actNumber: number, rng: () => number = Math.random): string {
  const act = getActDefinition(DEFAULT_CAMPAIGN, actNumber);
  if (!act || act.mapPool.templateIds.length === 0) return DEFAULT_MAP_TEMPLATE_ID;
  return selectActMapTemplate(act, rng);
}

/**
 * Archives the completed act into the campaign, applies the between-act reset,
 * advances the act counter, and returns a fresh RunState for the next act.
 * Gold and run modifiers carry forward; party HP/slots/dice are fully restored.
 * The map template for the next act is resolved generically via templateIdForAct.
 */
export function advanceToNextAct(
  campaign: CampaignState,
  completedRun: RunState,
  rng: () => number = Math.random,
): RunState {
  // Idempotency guard: a second call for the same completed run must not re-archive the
  // act or advance the counter again. Return a fresh run for the already-current act so
  // the caller still gets a usable RunState without corrupting campaign state.
  if (archivedRuns.has(completedRun)) {
    return createRunState(
      campaign.party,
      campaign.difficulty,
      templateIdForAct(campaign.currentActNumber, rng),
    );
  }
  archivedRuns.add(completedRun);

  campaign.completedActs.push(buildActSummary(campaign, completedRun));

  campaign.party = completedRun.party.map((pm) => ({ ...pm }));
  campaign.runModifiers = completedRun.runModifiers.filter(isPersistentModifier);

  applyBetweenActReset(campaign.party);

  campaign.currentActNumber += 1;

  const nextMapTemplateId = templateIdForAct(campaign.currentActNumber, rng);
  const nextRun = createRunState(campaign.party, campaign.difficulty, nextMapTemplateId);
  nextRun.gold = completedRun.gold;
  nextRun.shortRestsSinceLongRest = 0;
  nextRun.eventSelections = { ...campaign.eventSelections };
  nextRun.runModifiers = [...campaign.runModifiers];

  return nextRun;
}

/**
 * Archives the final act and marks the campaign as won.
 * Call this when the Act 4 boss is defeated instead of advanceToNextAct.
 */
export function completeCampaign(campaign: CampaignState, completedRun: RunState): void {
  if (campaign.campaignStatus === "won") return;
  campaign.completedActs.push(buildActSummary(campaign, completedRun));
  campaign.party = completedRun.party.map((pm) => ({ ...pm }));
  campaign.campaignStatus = "won";
}

/**
 * Records the act and node where a campaign run was lost.
 * Call this from the defeat path before transitioning to the summary screen.
 */
export function recordCampaignLoss(campaign: CampaignState, run: RunState): void {
  if (campaign.campaignStatus !== "active") return;
  campaign.campaignStatus = "lost";
  campaign.lossActNumber = campaign.currentActNumber;
  campaign.lossNodeId = run.mapState.currentNodeId ?? undefined;
}
