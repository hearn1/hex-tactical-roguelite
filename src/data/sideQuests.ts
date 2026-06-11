// #358 — Define side quest data contracts and registry
// #359 — Add placeholder side quest definitions for Acts 1–4

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export interface SideQuestStepDefinition {
  /** Stable step id, e.g. "sq.act1.goblin_relic.stage_1.step_1". */
  id: string;
  /** Design notes — not surfaced in-game. */
  description: string;
}

export interface SideQuestStageDefinition {
  /** Stable stage id, e.g. "sq.act1.goblin_relic.stage_1". */
  id: string;
  /** Design notes — not surfaced in-game. */
  description: string;
  /** Ordered steps within this stage. */
  steps: SideQuestStepDefinition[];
}

export interface SideQuestDefinition {
  /** Stable quest id, e.g. "sq.act1.goblin_relic". */
  id: string;
  displayName: string;
  /** Act this quest is associated with; matches ActDefinition.id. */
  actId: string;
  /** Campaign this quest belongs to; matches CampaignDefinition.id. */
  campaignId: string;
  /** Ordered stages representing the quest's progression arc. */
  stages: SideQuestStageDefinition[];
  /**
   * Optional prerequisite side quest IDs. All listed quests must be completed
   * before this quest becomes eligible. Resolved at runtime by #168.
   */
  prerequisiteQuestIds?: string[];
  /**
   * Whether the quest is shown to the player before being triggered.
   * Defaults to false (hidden until unlocked).
   */
  visibleByDefault?: boolean;
  /**
   * Stable hook IDs fired on quest outcome (completion, failure, etc.).
   * Wired to reward/consequence systems by #168 and #169.
   * Must be non-empty; each id must be a non-empty string.
   */
  outcomeHookIds: string[];
}

// ---------------------------------------------------------------------------
// Validation helper (used by tests and future runtime guards)
// ---------------------------------------------------------------------------

export interface SideQuestValidationReport {
  valid: boolean;
  errors: string[];
}

export function validateSideQuestRegistry(
  registry: Record<string, SideQuestDefinition>,
  knownCampaignIds: Set<string>,
  knownActIds: Set<string>,
): SideQuestValidationReport {
  const errors: string[] = [];
  const allQuestIds = Object.keys(registry);

  // Unique quest IDs (registry key must match definition id)
  for (const [key, quest] of Object.entries(registry)) {
    if (key !== quest.id) {
      errors.push(`Registry key "${key}" does not match quest.id "${quest.id}".`);
    }
  }

  // No duplicate keys (Record already enforces this structurally, but validate id uniqueness)
  const idSet = new Set<string>();
  for (const quest of Object.values(registry)) {
    if (idSet.has(quest.id)) {
      errors.push(`Duplicate quest id "${quest.id}".`);
    }
    idSet.add(quest.id);
  }

  for (const quest of Object.values(registry)) {
    // Required string fields
    if (!quest.displayName) {
      errors.push(`Quest "${quest.id}" has empty displayName.`);
    }

    // Valid campaign reference
    if (!knownCampaignIds.has(quest.campaignId)) {
      errors.push(`Quest "${quest.id}" references unknown campaignId "${quest.campaignId}".`);
    }

    // Valid act reference
    if (!knownActIds.has(quest.actId)) {
      errors.push(`Quest "${quest.id}" references unknown actId "${quest.actId}".`);
    }

    // Stages
    if (quest.stages.length === 0) {
      errors.push(`Quest "${quest.id}" has no stages.`);
    }

    const stageIds = new Set<string>();
    const stepIds = new Set<string>();
    for (const stage of quest.stages) {
      if (!stage.id) {
        errors.push(`Quest "${quest.id}" has a stage with empty id.`);
      }
      if (stageIds.has(stage.id)) {
        errors.push(`Quest "${quest.id}" has duplicate stage id "${stage.id}".`);
      }
      stageIds.add(stage.id);

      for (const step of stage.steps) {
        if (!step.id) {
          errors.push(`Quest "${quest.id}" stage "${stage.id}" has a step with empty id.`);
        }
        if (stepIds.has(step.id)) {
          errors.push(`Quest "${quest.id}" has duplicate step id "${step.id}".`);
        }
        stepIds.add(step.id);
      }
    }

    // Outcome hooks
    if (quest.outcomeHookIds.length === 0) {
      errors.push(`Quest "${quest.id}" has no outcomeHookIds.`);
    }
    for (const hookId of quest.outcomeHookIds) {
      if (!hookId) {
        errors.push(`Quest "${quest.id}" has an empty outcomeHookId.`);
      }
    }

    // Prerequisites must point to known quest IDs or be documented placeholders
    for (const prereqId of quest.prerequisiteQuestIds ?? []) {
      if (!allQuestIds.includes(prereqId)) {
        errors.push(
          `Quest "${quest.id}" prerequisite "${prereqId}" is not a known quest id in this registry.`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Returns the side quest definition for the given id, or `undefined` if not
 * found. Callers must handle `undefined` gracefully — never throws.
 */
export function getSideQuestById(id: string): SideQuestDefinition | undefined {
  return SIDE_QUEST_REGISTRY[id];
}

/**
 * Returns all side quest definitions associated with the given act id.
 * Returns an empty array when the act has no registered side quests.
 */
export function getSideQuestsByAct(actId: string): SideQuestDefinition[] {
  return Object.values(SIDE_QUEST_REGISTRY).filter((q) => q.actId === actId);
}

// ---------------------------------------------------------------------------
// Placeholder definitions — Act 1–4 (#359)
// ---------------------------------------------------------------------------

const SQ_ACT1_GOBLIN_RELIC: SideQuestDefinition = {
  id: "sq.act1.goblin_relic",
  displayName: "The Shattered Relic",
  actId: "act_1",
  campaignId: "campaign.verdant_dark",
  visibleByDefault: true,
  stages: [
    {
      id: "sq.act1.goblin_relic.stage_1",
      description: "Locate the goblin shaman camp rumoured to hold a fragment of the primal heart.",
      steps: [
        {
          id: "sq.act1.goblin_relic.stage_1.step_1",
          description: "Follow the primal resonance trail through the frontier wilderness.",
        },
        {
          id: "sq.act1.goblin_relic.stage_1.step_2",
          description: "Defeat the shaman guardian and recover the relic fragment.",
        },
      ],
    },
    {
      id: "sq.act1.goblin_relic.stage_2",
      description: "Decide what to do with the fragment before confronting the primal force.",
      steps: [
        {
          id: "sq.act1.goblin_relic.stage_2.step_1",
          description: "Consult the fragment's resonance to learn its true nature.",
        },
      ],
    },
  ],
  outcomeHookIds: [
    "outcome.sq.act1.goblin_relic.completed",
    "outcome.sq.act1.goblin_relic.abandoned",
  ],
};

const SQ_ACT2_DESERTER_CACHE: SideQuestDefinition = {
  id: "sq.act2.deserter_cache",
  displayName: "The Deserter's Cache",
  actId: "act_2",
  campaignId: "campaign.verdant_dark",
  visibleByDefault: false,
  stages: [
    {
      id: "sq.act2.deserter_cache.stage_1",
      description: "Track down the warlord's deserters hiding in the pass lowlands.",
      steps: [
        {
          id: "sq.act2.deserter_cache.stage_1.step_1",
          description: "Intercept the deserter scouts before they warn the warlord.",
        },
        {
          id: "sq.act2.deserter_cache.stage_1.step_2",
          description: "Find the hidden supply cache the deserters are guarding.",
        },
      ],
    },
    {
      id: "sq.act2.deserter_cache.stage_2",
      description: "Secure or destroy the cache to deny the warlord's resupply.",
      steps: [
        {
          id: "sq.act2.deserter_cache.stage_2.step_1",
          description: "Neutralize the remaining undead honour-guard over the cache.",
        },
      ],
    },
  ],
  outcomeHookIds: [
    "outcome.sq.act2.deserter_cache.cache_secured",
    "outcome.sq.act2.deserter_cache.cache_destroyed",
    "outcome.sq.act2.deserter_cache.failed",
  ],
};

const SQ_ACT3_PRISONER_RESCUE: SideQuestDefinition = {
  id: "sq.act3.prisoner_rescue",
  displayName: "The Ashen Captive",
  actId: "act_3",
  campaignId: "campaign.verdant_dark",
  visibleByDefault: false,
  stages: [
    {
      id: "sq.act3.prisoner_rescue.stage_1",
      description: "Locate the cult's hidden holding cell before the ritual sacrifice.",
      steps: [
        {
          id: "sq.act3.prisoner_rescue.stage_1.step_1",
          description: "Infiltrate the outer cult encampment to find the cell location.",
        },
        {
          id: "sq.act3.prisoner_rescue.stage_1.step_2",
          description: "Eliminate the skeleton wardens guarding the prisoner.",
        },
      ],
    },
    {
      id: "sq.act3.prisoner_rescue.stage_2",
      description: "Escort the captive to safety before the high priest is alerted.",
      steps: [
        {
          id: "sq.act3.prisoner_rescue.stage_2.step_1",
          description: "Clear the escape route through the cult patrol line.",
        },
      ],
    },
  ],
  outcomeHookIds: [
    "outcome.sq.act3.prisoner_rescue.rescued",
    "outcome.sq.act3.prisoner_rescue.failed",
  ],
};

/**
 * Act 4 has no standalone side quest — its optional content is delivered through
 * consequences from Act 1–3 side quests (sq.act1.goblin_relic, sq.act2.deserter_cache,
 * sq.act3.prisoner_rescue) feeding into the planar anchor alternate layout. The
 * outcome hooks from earlier quests are resolved by #168/#169 during the Act 4 run.
 * A dedicated Act 4 side quest may be added when #167/#168 chains are in place.
 */
const SQ_ACT4_PLANAR_ECHO: SideQuestDefinition = {
  id: "sq.act4.planar_echo",
  displayName: "Echo of the Bound Anchor",
  actId: "act_4",
  campaignId: "campaign.verdant_dark",
  visibleByDefault: false,
  prerequisiteQuestIds: ["sq.act1.goblin_relic"],
  stages: [
    {
      id: "sq.act4.planar_echo.stage_1",
      description:
        "The relic fragment from Act 1 resonates near the planar anchor, revealing a hidden approach vector.",
      steps: [
        {
          id: "sq.act4.planar_echo.stage_1.step_1",
          description: "Channel the relic to destabilise the arcane lord's outer ward.",
        },
      ],
    },
  ],
  outcomeHookIds: [
    "outcome.sq.act4.planar_echo.ward_broken",
    "outcome.sq.act4.planar_echo.failed",
  ],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SIDE_QUEST_REGISTRY: Record<string, SideQuestDefinition> = {
  [SQ_ACT1_GOBLIN_RELIC.id]: SQ_ACT1_GOBLIN_RELIC,
  [SQ_ACT2_DESERTER_CACHE.id]: SQ_ACT2_DESERTER_CACHE,
  [SQ_ACT3_PRISONER_RESCUE.id]: SQ_ACT3_PRISONER_RESCUE,
  [SQ_ACT4_PLANAR_ECHO.id]: SQ_ACT4_PLANAR_ECHO,
};
