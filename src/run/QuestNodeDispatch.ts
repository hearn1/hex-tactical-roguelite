// #366 — Connect side quest map nodes to quest state changes

import type { NodeDef } from "../data/nodes.ts";
import { getSideQuestById } from "../data/sideQuests.ts";
import type { QuestProgressMap } from "./QuestState.ts";
import { startQuest, advanceQuest, completeQuest, failQuest, getQuestState } from "./QuestState.ts";

/**
 * Applies the quest state transition declared on a map node when that node is resolved.
 *
 * Idempotency guarantees:
 * - "start"    — safe to call repeatedly; startQuest is idempotent if the quest is already active.
 * - "advance"  — skipped silently if the quest is not currently active.
 * - "complete" — safe to call repeatedly; completeQuest is idempotent if already completed.
 * - "fail"     — safe to call repeatedly; failQuest is idempotent if already failed.
 *
 * Nodes without questId/questNodeRole are silently ignored.
 * Nodes referencing an unknown questId are silently ignored (the registry is the authority).
 */
export function resolveQuestNode(
  node: NodeDef,
  progress: QuestProgressMap,
  actNumber: number,
): void {
  const { questId, questNodeRole, questOutcomeHookId } = node;
  if (!questId || !questNodeRole) return;

  const def = getSideQuestById(questId);
  if (!def) return;

  switch (questNodeRole) {
    case "start":
      startQuest(progress, questId, actNumber);
      break;
    case "advance": {
      const state = getQuestState(progress, questId);
      if (state?.status === "active") {
        advanceQuest(progress, questId, def);
      }
      break;
    }
    case "complete":
      completeQuest(
        progress,
        questId,
        questOutcomeHookId ?? def.outcomeHookIds[0],
        actNumber,
      );
      break;
    case "fail":
      failQuest(progress, questId, actNumber);
      break;
  }
}
