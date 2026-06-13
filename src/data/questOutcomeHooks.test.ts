// #497 — Milestone 3 audit: cross-registry integrity for side quest outcome hooks.
//
// Every reference a quest outcome can fire must resolve against the registry that consumes it,
// otherwise applyQuestOutcomeHook silently drops the reward/consequence at runtime. These
// checks guard against content drift (a renamed item, potion, or boss encounter).

import { describe, it, expect } from "vitest";
import { QUEST_OUTCOME_HOOK_REGISTRY } from "./questOutcomeHooks.ts";
import { SIDE_QUEST_REGISTRY } from "./sideQuests.ts";
import { ITEM_REGISTRY } from "./items.ts";
import { POTION_REGISTRY } from "./potions.ts";
import { ENCOUNTER_REGISTRY } from "./encounters.ts";

describe("quest outcome hooks — registry integrity (#497)", () => {
  it("every declared side quest outcomeHookId is registered", () => {
    for (const quest of Object.values(SIDE_QUEST_REGISTRY)) {
      for (const hookId of quest.outcomeHookIds) {
        expect(
          QUEST_OUTCOME_HOOK_REGISTRY[hookId],
          `quest "${quest.id}" references unregistered outcome hook "${hookId}"`,
        ).toBeDefined();
      }
    }
  });

  it("each hook's registry key matches its id", () => {
    for (const [key, hook] of Object.entries(QUEST_OUTCOME_HOOK_REGISTRY)) {
      expect(key).toBe(hook.id);
    }
  });

  it("every reward item/potion resolves and every boss modifier targets a real encounter", () => {
    for (const hook of Object.values(QUEST_OUTCOME_HOOK_REGISTRY)) {
      for (const reward of hook.rewards) {
        if (reward.kind === "item") {
          expect(
            ITEM_REGISTRY[reward.itemId],
            `hook "${hook.id}" rewards unknown item "${reward.itemId}"`,
          ).toBeDefined();
        } else if (reward.kind === "potion") {
          expect(
            POTION_REGISTRY[reward.potionId],
            `hook "${hook.id}" rewards unknown potion "${reward.potionId}"`,
          ).toBeDefined();
        }
      }
      for (const consequence of hook.consequences) {
        if (
          consequence.kind === "run_modifier" &&
          consequence.modifier.kind === "boss_encounter_modifier"
        ) {
          const eid = consequence.modifier.encounterId;
          expect(
            ENCOUNTER_REGISTRY[eid],
            `hook "${hook.id}" boss modifier targets unknown encounter "${eid}"`,
          ).toBeDefined();
        }
      }
    }
  });
});
