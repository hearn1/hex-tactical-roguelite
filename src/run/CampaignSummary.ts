import type { CampaignState } from "../state/CampaignState.ts";
import type { RunState } from "../state/RunState.ts";
import { aggregateQuestCounts } from "./QuestState.ts";

/** Per-act breakdown entry in a campaign summary. */
export interface ActSummaryEntry {
  actId: string;
  actNumber: number;
  nodesCleared: number;
  elitesDefeated: number;
  bossDefeated: boolean;
  goldEarned: number;
  heroDownCount: number;
  itemsGained: number;
  runStatus: "won" | "lost";
}

/**
 * Aggregated campaign win/loss summary. Generated from CampaignState before
 * rendering so the data is independently testable.
 *
 * Story outcome text is intentionally excluded — owned by #164.
 * Leave outcomeTextKey as a hook for that system to fill in.
 */
export interface CampaignSummary {
  campaignResult: "won" | "lost" | "active";
  /** Number of acts the party successfully completed (boss defeated). */
  actsCompleted: number;
  /** Highest act number the party reached (completed or in-progress). */
  finalActReached: number;
  /** Total node combats won across all acts. */
  battlesWon: number;
  /** Total hero-down events across all acts. */
  heroDownCount: number;
  /** Total gold across all acts. */
  goldEarned: number;
  /** Total items/rewards gained across all acts. */
  itemsGained: number;
  /** Total boss encounters completed. */
  bossEncountersCompleted: number;
  /** Act number where the campaign was lost (undefined for victory). */
  lossActNumber?: number;
  /** Node id where the campaign was lost (undefined for victory). */
  lossNodeId?: string;
  /** Per-act breakdown in chronological order. */
  actBreakdowns: ActSummaryEntry[];
  /** Hook for #164 story system to attach outcome copy. */
  outcomeTextKey?: string;
  /** Number of side quests completed across the entire campaign. */
  questsCompleted: number;
  /** Number of side quests failed across the entire campaign. */
  questsFailed: number;
  /** Number of side quests skipped across the entire campaign. */
  questsSkipped: number;
}

/**
 * Builds a CampaignSummary from archived act data plus an optional in-flight
 * run for the current (possibly incomplete) act.
 *
 * Pass `currentRun` when the campaign ended mid-act (loss) so the partial
 * act stats are reflected in the summary totals and loss location.
 */
export function generateCampaignSummary(
  campaign: CampaignState,
  currentRun?: RunState,
): CampaignSummary {
  const actBreakdowns: ActSummaryEntry[] = campaign.completedActs.map((a) => ({
    actId: a.actId,
    actNumber: a.actNumber,
    nodesCleared: a.nodesCleared,
    elitesDefeated: a.elitesDefeated,
    bossDefeated: a.bossDefeated,
    goldEarned: a.goldEarned,
    heroDownCount: a.heroDownCount ?? 0,
    itemsGained: a.itemsGained ?? 0,
    runStatus: a.runStatus,
  }));

  // Include in-flight act data for loss summaries.
  if (currentRun && campaign.campaignStatus !== "won") {
    const inFlightLog = currentRun.adventureLog ?? [];
    actBreakdowns.push({
      actId: `act_${campaign.currentActNumber}`,
      actNumber: campaign.currentActNumber,
      nodesCleared: currentRun.mapState.nodesCleared,
      elitesDefeated: currentRun.mapState.elitesDefeated,
      bossDefeated: currentRun.mapState.bossDefeated,
      goldEarned: currentRun.gold,
      heroDownCount: inFlightLog.filter((e) => e.kind === "hero_downed").length,
      itemsGained: inFlightLog.filter((e) => e.kind === "loot_gained").length,
      runStatus: currentRun.runStatus === "won" ? "won" : "lost",
    });
  }

  const actsCompleted = actBreakdowns.filter((a) => a.runStatus === "won").length;
  const finalActReached =
    actBreakdowns.length > 0
      ? actBreakdowns[actBreakdowns.length - 1].actNumber
      : campaign.currentActNumber;

  const battlesWon = actBreakdowns.reduce((sum, a) => sum + a.nodesCleared, 0);
  const heroDownCount = actBreakdowns.reduce((sum, a) => sum + a.heroDownCount, 0);
  const goldEarned = actBreakdowns.reduce(
    (max, a) => Math.max(max, a.goldEarned),
    currentRun?.gold ?? 0,
  );
  const itemsGained = actBreakdowns.reduce((sum, a) => sum + a.itemsGained, 0);
  const bossEncountersCompleted = actBreakdowns.filter((a) => a.bossDefeated).length;

  const questCounts = aggregateQuestCounts(campaign.questProgress ?? {});

  return {
    campaignResult: campaign.campaignStatus,
    actsCompleted,
    finalActReached,
    battlesWon,
    heroDownCount,
    goldEarned,
    itemsGained,
    bossEncountersCompleted,
    lossActNumber: campaign.lossActNumber,
    lossNodeId: campaign.lossNodeId,
    actBreakdowns,
    questsCompleted: questCounts.completed,
    questsFailed: questCounts.failed,
    questsSkipped: questCounts.skipped,
  };
}
