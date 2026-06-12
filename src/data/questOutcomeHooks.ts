// #367 — Side quest reward and consequence contract

import type { RunModifier } from "../state/types.ts";

// ---------------------------------------------------------------------------
// Reward types
// ---------------------------------------------------------------------------

export interface QuestGoldReward {
  kind: "gold";
  amount: number;
}

export interface QuestXpReward {
  kind: "xp";
  amountPerHero: number;
}

export interface QuestItemReward {
  kind: "item";
  itemId: string;
}

export interface QuestPotionReward {
  kind: "potion";
  potionId: string;
}

export type QuestRewardDef =
  | QuestGoldReward
  | QuestXpReward
  | QuestItemReward
  | QuestPotionReward;

// ---------------------------------------------------------------------------
// Consequence types
// ---------------------------------------------------------------------------

export interface QuestRunModifierConsequence {
  kind: "run_modifier";
  modifier: RunModifier;
}

/** Records a persistent campaign flag in eventSelections for future system queries. */
export interface QuestCampaignFlagConsequence {
  kind: "campaign_flag";
  flagId: string;
}

/** Appends a narrative entry to the campaign adventure log. */
export interface QuestLogConsequence {
  kind: "log_entry";
  message: string;
}

export type QuestConsequenceDef =
  | QuestRunModifierConsequence
  | QuestCampaignFlagConsequence
  | QuestLogConsequence;

// ---------------------------------------------------------------------------
// Hook definition
// ---------------------------------------------------------------------------

/**
 * Describes the effects that fire when a specific quest outcome hook is applied.
 * Hooks are identified by the outcomeHookId stored in QuestRuntimeState.resolvedOutcomeHookId.
 * Application is once-only; the applicator guards against duplicate calls.
 */
export interface QuestOutcomeHookDef {
  id: string;
  /** Human-readable label for logs and debug output. */
  label: string;
  /** Rewards applied to inventory/party when this hook fires. */
  rewards: QuestRewardDef[];
  /** Non-reward campaign effects applied when this hook fires. */
  consequences: QuestConsequenceDef[];
}

// ---------------------------------------------------------------------------
// Registry — one entry per outcomeHookId declared in sideQuests.ts
// ---------------------------------------------------------------------------

const HOOK_REGISTRY: Record<string, QuestOutcomeHookDef> = {
  "outcome.sq.act1.goblin_relic.completed": {
    id: "outcome.sq.act1.goblin_relic.completed",
    label: "Shattered Relic — Completed",
    rewards: [
      { kind: "gold", amount: 30 },
      { kind: "xp", amountPerHero: 20 },
      { kind: "item", itemId: "item.hearthstone_charm" },
    ],
    consequences: [
      { kind: "campaign_flag", flagId: "flag.sq.act1.goblin_relic.completed" },
      {
        kind: "run_modifier",
        modifier: { kind: "boss_encounter_modifier", encounterId: "encounter.boss_ogre_hexbreaker", hpMultiplier: 0.80 },
      },
      {
        kind: "log_entry",
        message:
          "The Shattered Relic was recovered. The primal fragment radiates with newfound purpose.",
      },
    ],
  },

  "outcome.sq.act1.goblin_relic.abandoned": {
    id: "outcome.sq.act1.goblin_relic.abandoned",
    label: "Shattered Relic — Abandoned",
    rewards: [],
    consequences: [
      { kind: "campaign_flag", flagId: "flag.sq.act1.goblin_relic.abandoned" },
      { kind: "log_entry", message: "The Shattered Relic quest was left unresolved." },
    ],
  },

  "outcome.sq.act2.deserter_cache.cache_secured": {
    id: "outcome.sq.act2.deserter_cache.cache_secured",
    label: "Deserter's Cache — Secured",
    rewards: [
      { kind: "gold", amount: 40 },
      { kind: "xp", amountPerHero: 20 },
      { kind: "potion", potionId: "potion.healing" },
    ],
    consequences: [
      { kind: "campaign_flag", flagId: "flag.sq.act2.deserter_cache.secured" },
      {
        kind: "run_modifier",
        modifier: { kind: "boss_encounter_modifier", encounterId: "encounter.boss_ogre_warlord", damageBonus: -2 },
      },
      {
        kind: "log_entry",
        message: "The deserter's cache was secured. Warlord supply lines are disrupted.",
      },
    ],
  },

  "outcome.sq.act2.deserter_cache.cache_destroyed": {
    id: "outcome.sq.act2.deserter_cache.cache_destroyed",
    label: "Deserter's Cache — Destroyed",
    rewards: [{ kind: "xp", amountPerHero: 15 }],
    consequences: [
      { kind: "campaign_flag", flagId: "flag.sq.act2.deserter_cache.destroyed" },
      { kind: "run_modifier", modifier: { kind: "enemy_hp_multiplier", value: 0.9 } },
      {
        kind: "log_entry",
        message:
          "The cache was destroyed before the warlord could reclaim it. Enemy forces are weakened.",
      },
    ],
  },

  "outcome.sq.act2.deserter_cache.failed": {
    id: "outcome.sq.act2.deserter_cache.failed",
    label: "Deserter's Cache — Failed",
    rewards: [],
    consequences: [
      { kind: "campaign_flag", flagId: "flag.sq.act2.deserter_cache.failed" },
      {
        kind: "log_entry",
        message:
          "The deserter's cache was never recovered. The warlord's forces remain well-supplied.",
      },
    ],
  },

  "outcome.sq.act3.prisoner_rescue.rescued": {
    id: "outcome.sq.act3.prisoner_rescue.rescued",
    label: "Ashen Captive — Rescued",
    rewards: [
      { kind: "gold", amount: 25 },
      { kind: "xp", amountPerHero: 25 },
      { kind: "potion", potionId: "potion.focus" },
    ],
    consequences: [
      { kind: "campaign_flag", flagId: "flag.sq.act3.prisoner_rescue.rescued" },
      {
        kind: "run_modifier",
        modifier: { kind: "boss_encounter_modifier", encounterId: "encounter.boss_high_priest", hpMultiplier: 0.85 },
      },
      {
        kind: "log_entry",
        message: "The captive was freed. Their knowledge may aid the final confrontation.",
      },
    ],
  },

  "outcome.sq.act3.prisoner_rescue.failed": {
    id: "outcome.sq.act3.prisoner_rescue.failed",
    label: "Ashen Captive — Failed",
    rewards: [],
    consequences: [
      { kind: "campaign_flag", flagId: "flag.sq.act3.prisoner_rescue.failed" },
      { kind: "run_modifier", modifier: { kind: "enemy_damage_bonus", value: 2 } },
      { kind: "log_entry", message: "The captive was not rescued. The cult ritual proceeds unchecked." },
    ],
  },

  "outcome.sq.act4.planar_echo.ward_broken": {
    id: "outcome.sq.act4.planar_echo.ward_broken",
    label: "Echo of the Bound Anchor — Ward Broken",
    rewards: [
      { kind: "xp", amountPerHero: 30 },
      { kind: "item", itemId: "item.bloodstone" },
    ],
    consequences: [
      { kind: "campaign_flag", flagId: "flag.sq.act4.planar_echo.ward_broken" },
      { kind: "run_modifier", modifier: { kind: "enemy_hp_multiplier", value: 0.85 } },
      {
        kind: "run_modifier",
        modifier: { kind: "boss_encounter_modifier", encounterId: "encounter.boss_arcane_lord", hpMultiplier: 0.85, damageBonus: -1 },
      },
      {
        kind: "log_entry",
        message:
          "The arcane lord's outer ward was shattered. The final confrontation begins with the enemy weakened.",
      },
    ],
  },

  "outcome.sq.act4.planar_echo.failed": {
    id: "outcome.sq.act4.planar_echo.failed",
    label: "Echo of the Bound Anchor — Failed",
    rewards: [],
    consequences: [
      { kind: "campaign_flag", flagId: "flag.sq.act4.planar_echo.failed" },
      { kind: "log_entry", message: "The arcane ward held. The bound anchor remains fully defended." },
    ],
  },
};

export const QUEST_OUTCOME_HOOK_REGISTRY: Readonly<Record<string, QuestOutcomeHookDef>> =
  HOOK_REGISTRY;

/**
 * Returns the hook definition for the given outcome hook id, or `undefined` if
 * not registered. Callers must handle `undefined` gracefully — never throws.
 */
export function getQuestOutcomeHook(hookId: string): QuestOutcomeHookDef | undefined {
  return HOOK_REGISTRY[hookId];
}
