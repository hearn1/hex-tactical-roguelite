/**
 * Story hook display text layer, separate from the ActStoryBeat design-note registry in
 * campaigns.ts. Provides placeholder D&D fantasy copy for campaign and act beats, a
 * flag/condition metadata slot for future run-choice variants, and a safe fallback for
 * any hook ID that has no registered text.
 */

export interface StoryHook {
  id: string;
  /** Display text shown to the player. */
  text: string;
  /**
   * Optional flag/condition metadata for future branching variants.
   * Keys are flag names; values describe the condition under which this hook fires.
   * Unused during placeholder phase — present so the shape is stable for future writers.
   */
  flags?: Record<string, string>;
}

/**
 * Fallback text returned when a hook ID has no registered entry.
 * Mirrors the spec: "Missing text for story hook <hookId>".
 */
export function missingStoryText(hookId: string): string {
  return `Missing text for story hook ${hookId}`;
}

/**
 * Looks up display text for the given hook ID.
 * Returns the fallback string when the hook is absent from the registry.
 */
export function lookupStoryText(hookId: string): string {
  return STORY_TEXT_REGISTRY[hookId]?.text ?? missingStoryText(hookId);
}

/** Returns the canonical campaign-start hook ID for the given campaign. */
export function getCampaignStartHookId(campaignId: string): string {
  return `${campaignId}.start`;
}

/** Returns the canonical campaign-end hook ID for the given campaign. */
export function getCampaignEndHookId(campaignId: string): string {
  return `${campaignId}.end`;
}

/** Returns the canonical act-intro hook ID for the given act number (1-indexed). */
export function getActIntroHookId(actNumber: number): string {
  return `act_${actNumber}.intro`;
}

/** Returns the canonical act-outro hook ID for the given act number (1-indexed). */
export function getActOutroHookId(actNumber: number): string {
  return `act_${actNumber}.outro`;
}

/** Returns the canonical boss-intro hook ID for the given act number (1-indexed). */
export function getBossIntroHookId(actNumber: number): string {
  return `act_${actNumber}.boss_intro`;
}

/** Returns the canonical boss-outro hook ID for the given act number (1-indexed). */
export function getBossOutroHookId(actNumber: number): string {
  return `act_${actNumber}.boss_outro`;
}

// ---------------------------------------------------------------------------
// Placeholder story copy — Acts 1–4, campaign start/end
// All text uses D&D fantasy tone. Replace later with final prose.
// ---------------------------------------------------------------------------

export const STORY_TEXT_REGISTRY: Record<string, StoryHook> = {
  // --- Campaign level ---
  "campaign.verdant_dark.start": {
    id: "campaign.verdant_dark.start",
    text:
      "The realm's frontier trembles under the shadow of an ancient rising darkness. " +
      "Goblin warbands raid the outer settlements, and whispers speak of a deeper threat yet to come. " +
      "You and your companions answer the call — the road stretches before you, and the verdant threat awaits its reckoning.",
  },
  "campaign.verdant_dark.end": {
    id: "campaign.verdant_dark.end",
    text:
      "The Ascending Dark is shattered. The draconid arcane lord's sanctum crumbles, his ritual broken and his power dissolved. " +
      "Across the realm, the shadow retreats — from goblin-haunted forests to the iron pass to the cult's ashen shrines. " +
      "You have walked every step of that road. The realm breathes again, and your names are written in its history.",
  },

  // --- Act 1: The Verdant Threat — nature / goblins ---
  "act_1.intro": {
    id: "act_1.intro",
    text:
      "The frontier settlements lie in ruin. Goblin warbands, bolder than any in living memory, push deep into the realm's borders. " +
      "Something is driving them — a primal force that turns instinct into siege. Your company rides out to meet them in the verdant wilds.",
  },
  "act_1.outro": {
    id: "act_1.outro",
    text:
      "The frontier is quiet now. The goblin tide has broken, and the primal heart that drove it is still. " +
      "But the road ahead is longer than any of you expected.",
  },
  "act_1.boss_intro": {
    id: "act_1.boss_intro",
    text:
      "A great tremor shakes the earth as the goblin shaman takes the field. " +
      "Behind the crude war-drums and painted masks, something older moves — " +
      "a primal force wearing the shape of mortal aggression.",
  },
  "act_1.boss_outro": {
    id: "act_1.boss_outro",
    text:
      "The primal force shatters. The shaman falls, and with him the warband loses its terrible unity. " +
      "The frontier breathes again, but the act of its liberation has drawn attention from darker places.",
  },

  // --- Act 2: The Iron Wall — goblins / ogres / skeletons ---
  "act_2.intro": {
    id: "act_2.intro",
    text:
      "The Iron Pass — a fortified choke-point held by an unlikely alliance: goblin remnants, ogre mercenaries, and the risen dead under a necromancer's hand. " +
      "If the warlord holds this road, the realm's interior lies open.",
  },
  "act_2.outro": {
    id: "act_2.outro",
    text:
      "The Iron Wall has fallen. The warlord's alliance fractures without its generals, and the undead tide freezes in place. " +
      "The pass is yours.",
  },
  "act_2.boss_intro": {
    id: "act_2.boss_intro",
    text:
      "The ogre warlord steps forward, flanked by the pale necromancer who has raised his fallen soldiers in service. " +
      "Two minds, one brutal campaign — and both now face you.",
  },
  "act_2.boss_outro": {
    id: "act_2.boss_outro",
    text:
      "The warlord collapses. The necromancer's animating will unravels with him. " +
      "The risen soldiers still, and the pass falls silent but for the wind.",
  },

  // --- Act 3: The Ashen Choir — skeletons / cultists ---
  "act_3.intro": {
    id: "act_3.intro",
    text:
      "The Ashen Choir spreads its cells across scarred lowlands and ruined temple-towns. " +
      "The cult seeks something buried in the ruins — an arcane patron they have been feeding with ritual and sacrifice. " +
      "Three commanders stand between you and the sanctum.",
  },
  "act_3.outro": {
    id: "act_3.outro",
    text:
      "The sanctum doors are sealed from within. Beyond them, the cult's ritual has reached its peak. " +
      "If the high priest completes the summoning, what follows will be beyond the realm's ability to fight.",
  },
  "act_3.boss_intro": {
    id: "act_3.boss_intro",
    text:
      "The sanctum's inner chamber blazes with profane light as the high priest ascends the altar. " +
      "He expected you. He has been expecting you for a long time.",
  },
  "act_3.boss_outro": {
    id: "act_3.boss_outro",
    text:
      "The ritual breaks. The high priest falls. The arcane patron, half-glimpsed beyond the collapsing portal, withdraws — but does not disappear. " +
      "You have stopped the summoning. You have not killed the patron.",
  },

  // --- Act 4: The Ascending Dark — cultists / arcane / draconid finale ---
  "act_4.intro": {
    id: "act_4.intro",
    text:
      "The Ascending Dark is the patron made flesh — the draconid arcane lord who bound the cult, directed the ogre warlords, and loosed the goblins as distraction. " +
      "His sanctum rises at the realm's northern edge, a spire of stolen arcane power. This is the final road.",
  },
  "act_4.outro": {
    id: "act_4.outro",
    text:
      "The sanctum's spire collapses in slow cascades of arcane light. The draconid lord is dead. " +
      "The darkness that followed your entire campaign from forest to fortress to sanctum has no master now.",
  },
  "act_4.boss_intro": {
    id: "act_4.boss_intro",
    text:
      'The arcane lord does not need minions to make his entrance. He descends from his throne and regards you the way a storm regards a campfire. ' +
      '"You were useful," he says. "In your own small way."',
  },
  "act_4.boss_outro": {
    id: "act_4.boss_outro",
    text:
      "He is wrong. The lord's final arcane blast scorches the stone, but misses. " +
      "He does not understand, even at the end, that small things brought low every great darkness before his. He falls.",
  },
};

/**
 * The set of hook IDs that must be populated for the default campaign.
 * Used by validation tests to ensure no required hooks go missing.
 */
export const DEFAULT_CAMPAIGN_REQUIRED_HOOKS: string[] = [
  "campaign.verdant_dark.start",
  "campaign.verdant_dark.end",
  ...([1, 2, 3, 4].flatMap((n) => [
    `act_${n}.intro`,
    `act_${n}.outro`,
    `act_${n}.boss_intro`,
    `act_${n}.boss_outro`,
  ])),
];
