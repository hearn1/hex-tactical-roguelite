// #361 — Quest runtime state model and lifecycle helpers
// #362 — Wired into campaign act transitions and summaries

import type { SideQuestDefinition } from "../data/sideQuests.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuestStatus =
  | "unavailable"
  | "available"
  | "active"
  | "completed"
  | "failed"
  | "skipped";

export interface QuestRuntimeState {
  questId: string;
  status: QuestStatus;
  /** 0-indexed into the quest definition's stages array. */
  currentStageIndex: number;
  /** 0-indexed into the current stage's steps array. */
  currentStepIndex: number;
  /** Outcome hook id fired on resolution (complete/fail/skip). */
  resolvedOutcomeHookId?: string;
  /** Act number when the quest was started. */
  startedAtActNumber?: number;
  /** Act number when the quest reached a terminal state. */
  resolvedAtActNumber?: number;
}

/** Lightweight record stored in CompletedActSummary for archival. */
export interface QuestOutcomeRecord {
  questId: string;
  status: QuestStatus;
  resolvedOutcomeHookId?: string;
}

export type QuestProgressMap = Record<string, QuestRuntimeState>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function initQuestProgress(): QuestProgressMap {
  return {};
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export function getQuestState(
  progress: QuestProgressMap,
  questId: string,
): QuestRuntimeState | undefined {
  return progress[questId];
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Marks a quest as active. Idempotent if already active.
 * Errors if the quest is already in a terminal state.
 */
export function startQuest(
  progress: QuestProgressMap,
  questId: string,
  actNumber: number,
): { ok: boolean; error?: string } {
  const existing = progress[questId];
  if (existing) {
    if (existing.status === "active") return { ok: true };
    if (
      existing.status === "completed" ||
      existing.status === "failed" ||
      existing.status === "skipped"
    ) {
      return {
        ok: false,
        error: `Quest "${questId}" is already in terminal state "${existing.status}".`,
      };
    }
  }
  progress[questId] = {
    questId,
    status: "active",
    currentStageIndex: 0,
    currentStepIndex: 0,
    startedAtActNumber: actNumber,
  };
  return { ok: true };
}

/**
 * Advances an active quest to the next step, or next stage when the current
 * stage is exhausted. Errors if the quest is not active, not found, or already
 * at the final stage and step (use completeQuest to resolve it).
 */
export function advanceQuest(
  progress: QuestProgressMap,
  questId: string,
  definition: SideQuestDefinition,
): { ok: boolean; error?: string } {
  const state = progress[questId];
  if (!state) {
    return { ok: false, error: `Quest "${questId}" has not been started.` };
  }
  if (state.status !== "active") {
    return {
      ok: false,
      error: `Quest "${questId}" is not active (status: "${state.status}").`,
    };
  }

  const stage = definition.stages[state.currentStageIndex];
  if (!stage) {
    return {
      ok: false,
      error: `Quest "${questId}" has no stage at index ${state.currentStageIndex}.`,
    };
  }

  const nextStepIndex = state.currentStepIndex + 1;
  if (nextStepIndex < stage.steps.length) {
    state.currentStepIndex = nextStepIndex;
    return { ok: true };
  }

  const nextStageIndex = state.currentStageIndex + 1;
  if (nextStageIndex < definition.stages.length) {
    state.currentStageIndex = nextStageIndex;
    state.currentStepIndex = 0;
    return { ok: true };
  }

  return {
    ok: false,
    error: `Quest "${questId}" is already at the final stage and step. Use completeQuest to resolve it.`,
  };
}

/**
 * Marks a quest as completed. Idempotent if already completed.
 * Errors if the quest is in a different terminal state or not started.
 */
export function completeQuest(
  progress: QuestProgressMap,
  questId: string,
  outcomeHookId: string,
  actNumber: number,
): { ok: boolean; error?: string } {
  const state = progress[questId];
  if (!state) {
    return { ok: false, error: `Quest "${questId}" has not been started.` };
  }
  if (state.status === "completed") return { ok: true };
  if (state.status === "failed" || state.status === "skipped") {
    return {
      ok: false,
      error: `Quest "${questId}" is already in terminal state "${state.status}".`,
    };
  }
  state.status = "completed";
  state.resolvedOutcomeHookId = outcomeHookId;
  state.resolvedAtActNumber = actNumber;
  return { ok: true };
}

/**
 * Marks a quest as failed. Idempotent if already failed.
 * Errors if the quest is completed, skipped, or not started.
 */
export function failQuest(
  progress: QuestProgressMap,
  questId: string,
  actNumber: number,
  outcomeHookId?: string,
): { ok: boolean; error?: string } {
  const state = progress[questId];
  if (!state) {
    return { ok: false, error: `Quest "${questId}" has not been started.` };
  }
  if (state.status === "failed") return { ok: true };
  if (state.status === "completed") {
    return { ok: false, error: `Quest "${questId}" is already completed.` };
  }
  if (state.status === "skipped") {
    return { ok: false, error: `Quest "${questId}" is already skipped.` };
  }
  state.status = "failed";
  state.resolvedAtActNumber = actNumber;
  if (outcomeHookId) state.resolvedOutcomeHookId = outcomeHookId;
  return { ok: true };
}

/**
 * Marks a quest as skipped. Idempotent if already skipped.
 * Errors if the quest is completed, failed, or not started.
 */
export function skipQuest(
  progress: QuestProgressMap,
  questId: string,
  actNumber: number,
  outcomeHookId?: string,
): { ok: boolean; error?: string } {
  const state = progress[questId];
  if (!state) {
    return { ok: false, error: `Quest "${questId}" has not been started.` };
  }
  if (state.status === "skipped") return { ok: true };
  if (state.status === "completed" || state.status === "failed") {
    return {
      ok: false,
      error: `Quest "${questId}" is already in terminal state "${state.status}".`,
    };
  }
  state.status = "skipped";
  state.resolvedAtActNumber = actNumber;
  if (outcomeHookId) state.resolvedOutcomeHookId = outcomeHookId;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** Returns counts per status across all tracked quests. */
export function aggregateQuestCounts(progress: QuestProgressMap): {
  completed: number;
  failed: number;
  skipped: number;
  active: number;
} {
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let active = 0;
  for (const state of Object.values(progress)) {
    if (state.status === "completed") completed++;
    else if (state.status === "failed") failed++;
    else if (state.status === "skipped") skipped++;
    else if (state.status === "active") active++;
  }
  return { completed, failed, skipped, active };
}

/**
 * Extracts a lightweight snapshot of quests resolved in the given act number.
 * Used when archiving a CompletedActSummary.
 */
export function snapshotQuestOutcomesForAct(
  progress: QuestProgressMap,
  actNumber: number,
): QuestOutcomeRecord[] {
  return Object.values(progress)
    .filter((s) => s.resolvedAtActNumber === actNumber)
    .map((s) => ({
      questId: s.questId,
      status: s.status,
      resolvedOutcomeHookId: s.resolvedOutcomeHookId,
    }));
}
