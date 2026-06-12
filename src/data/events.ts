import type { RunModifier } from "../state/types.ts";
import type { AbilityKey } from "./abilities.ts";

/**
 * Canonical ability-check declaration (F23). Defined here so this module is the single
 * source of truth shared with the F24 event resolver — do not redefine elsewhere.
 */
export interface CheckDef {
  stat: AbilityKey;
  dc: number;
  /** Optional partial-success band: a miss within N of the DC reads as "partial". */
  partialWithin?: number;
  /** When true the engine may auto-pick the best living hero instead of prompting. */
  autoPickBestStat?: boolean;
}

export type EventEffect =
  | { type: "gold"; amount: number }
  | { type: "gold_cost"; amount: number }
  | { type: "hp_damage"; amount: number; target?: "random_hero" }
  | { type: "stat_boost"; stat: AbilityKey; amount: number }
  | { type: "potion"; potionId: string }
  | { type: "item"; itemId: string }
  | { type: "heal_party"; percent: number }
  | { type: "xp"; amount: number; target: "party" | "random_hero" | "picked_hero" }
  | { type: "buff"; modifier: RunModifier }
  | { type: "noop" }
  | CheckEffect;

/**
 * Declarative gate on an event choice. Evaluated by `evaluateRequirements` (pure); an unmet
 * requirement disables the choice and shows its reason — choices are never hidden (UI Rule).
 */
export type ChoiceRequirement =
  | { type: "minGold"; amount: number }
  | { type: "hasItem"; itemId: string }
  | { type: "livingHero" }
  | { type: "partySizeAtLeast"; n: number };

/**
 * An ability-check branch effect. The chosen hero's check resolves, then the matching
 * outcome's effect list is applied. `onPartial` is optional; if absent, a partial result
 * falls back to `onFailure`.
 */
export interface CheckEffect {
  type: "check";
  check: CheckDef;
  onSuccess: EventEffect[];
  onFailure: EventEffect[];
  onPartial?: EventEffect[];
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  effects: EventEffect[];
  /** Optional gates; when any is unmet the choice renders disabled with the reason shown. */
  requirements?: ChoiceRequirement[];
}

/**
 * Curation vocabulary for events. Tags are inert metadata in this pack — map-gen (F26) will
 * consume them to bias placement (e.g. weight a `heal` event after a hard fight). Keep this
 * list in sync with the validator's allowed-tag set in `DataRepository.validate`.
 */
export type EventTag = "risk" | "social" | "treasure" | "heal" | "train" | "moral";

export interface EventDef {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
  /** Optional placement/curation hints for future map-gen. No runtime behavior in this pack. */
  tags?: EventTag[];
  /** When true the event may be re-selected within a run; defaults to false (no repeats). */
  repeatable?: boolean;
}

export const EVENT_REGISTRY: Record<string, EventDef> = {
  "event.rogue_trader": {
    id: "event.rogue_trader",
    title: "Rogue Trader",
    description: "A shady figure offers unusual wares.",
    choices: [
      {
        id: "event.rogue_trader.buy",
        label: "Buy Lucky Charm",
        description: "Pay 20 gold for a Lucky Charm.",
        effects: [
          { type: "gold_cost", amount: 20 },
          { type: "item", itemId: "item.lucky_charm" },
        ],
      },
      {
        id: "event.rogue_trader.haggle",
        label: "Haggle",
        description: "Charisma check (DC 12). Success: buy the Lucky Charm for 10 gold. Failure: the trader won't budge.",
        effects: [
          {
            type: "check",
            check: { stat: "cha", dc: 12 },
            onSuccess: [
              { type: "gold_cost", amount: 10 },
              { type: "item", itemId: "item.lucky_charm" },
            ],
            onFailure: [{ type: "noop" }],
          },
        ],
      },
      {
        id: "event.rogue_trader.decline",
        label: "Decline",
        description: "Politely refuse the offer.",
        effects: [{ type: "noop" }],
      },
    ],
  },
  "event.healing_spring": {
    id: "event.healing_spring",
    title: "Healing Spring",
    description: "You find a natural hot spring.",
    choices: [
      {
        id: "event.healing_spring.rest",
        label: "Rest",
        description: "Heal all party members for 50% max HP.",
        effects: [{ type: "heal_party", percent: 50 }],
      },
      {
        id: "event.healing_spring.fill",
        label: "Fill Waterskins",
        description: "Gain 2 Healing Potions.",
        effects: [
          { type: "potion", potionId: "potion.healing" },
          { type: "potion", potionId: "potion.healing" },
        ],
      },
    ],
  },
  "event.strange_shrine": {
    id: "event.strange_shrine",
    title: "Strange Shrine",
    description: "A weathered shrine hums with faint power.",
    choices: [
      {
        id: "event.strange_shrine.pray",
        label: "Pray",
        description: "Choose one hero to gain +1 Wisdom.",
        effects: [{ type: "stat_boost", stat: "wis", amount: 1 }],
      },
      {
        id: "event.strange_shrine.loot",
        label: "Loot the offerings",
        description: "A random hero takes 5 damage (min 1 HP). Party gains 15 gold.",
        effects: [
          { type: "hp_damage", amount: 5, target: "random_hero" },
          { type: "gold", amount: 15 },
        ],
      },
    ],
  },
  "event.crumbling_bridge": {
    id: "event.crumbling_bridge",
    title: "Crumbling Bridge",
    description: "A frayed rope bridge sways over a deep ravine. A nimble crossing could grab the gear left behind — or end in a fall.",
    choices: [
      {
        id: "event.crumbling_bridge.cross",
        label: "Leap across",
        description: "Dexterity check (DC 12). Success: 25 gold. Partial: 10 gold. Failure: a hero takes 6 damage.",
        effects: [
          {
            type: "check",
            check: { stat: "dex", dc: 12, partialWithin: 3 },
            onSuccess: [{ type: "gold", amount: 25 }],
            onPartial: [{ type: "gold", amount: 10 }],
            onFailure: [{ type: "hp_damage", amount: 6, target: "random_hero" }],
          },
        ],
      },
      {
        id: "event.crumbling_bridge.detour",
        label: "Take the long way",
        description: "Avoid the risk entirely.",
        effects: [{ type: "noop" }],
      },
    ],
  },

  // ── Event content pack (F25 / #56) — 10 original authored scenes ─────────────────────────
  // Reuses only existing effects/requirements/checks. Names and prose are original; DCs sit in
  // the 11–14 "fair-to-risky" band tuned to early hero modifiers (≈ +0..+4).

  "event.sunken_toll_chest": {
    id: "event.sunken_toll_chest",
    title: "Sunken Toll Chest",
    description: "A waterlogged strongbox is wedged beneath a collapsed footbridge.",
    tags: ["risk", "treasure"],
    choices: [
      {
        id: "event.sunken_toll_chest.force",
        label: "Force the Lid",
        description: "Strength check (DC 12). Success: gold and an item. Partial: a little coin. Failure: a hero is hurt but grabs some coin.",
        effects: [
          {
            type: "check",
            check: { stat: "str", dc: 12, partialWithin: 3 },
            onSuccess: [
              { type: "gold", amount: 30 },
              { type: "item", itemId: "item.owl_feather" },
            ],
            onPartial: [{ type: "gold", amount: 15 }],
            onFailure: [
              { type: "hp_damage", amount: 6, target: "random_hero" },
              { type: "gold", amount: 8 },
            ],
          },
        ],
      },
      {
        id: "event.sunken_toll_chest.mark",
        label: "Mark the Site",
        description: "Note it for later and pocket the loose coin on top.",
        effects: [{ type: "gold", amount: 12 }],
      },
    ],
  },

  "event.lanterns_in_the_fog": {
    id: "event.lanterns_in_the_fog",
    title: "Lanterns in the Fog",
    description: "Pale lights drift between the trees, just off the path.",
    tags: ["risk", "social", "heal"],
    choices: [
      {
        id: "event.lanterns_in_the_fog.follow",
        label: "Follow the Lights",
        description: "Wisdom check (DC 12). Success: an uncommon find. Partial: some gold. Failure: a hero takes damage.",
        effects: [
          {
            type: "check",
            check: { stat: "wis", dc: 12, partialWithin: 3 },
            onSuccess: [{ type: "item", itemId: "item.runed_robe" }],
            onPartial: [{ type: "gold", amount: 14 }],
            onFailure: [{ type: "hp_damage", amount: 6, target: "random_hero" }],
          },
        ],
      },
      {
        id: "event.lanterns_in_the_fog.formation",
        label: "Keep Formation",
        description: "Hold together and tend small wounds as you press on.",
        effects: [{ type: "heal_party", percent: 25 }],
      },
    ],
  },

  "event.rain_washed_cairn": {
    id: "event.rain_washed_cairn",
    title: "Rain-Washed Cairn",
    description: "A mossy stone marker leans over a long-quiet grave.",
    tags: ["heal", "train"],
    choices: [
      {
        id: "event.rain_washed_cairn.rest",
        label: "Rest Beside It",
        description: "Let the living recover in the calm.",
        effects: [{ type: "heal_party", percent: 35 }],
      },
      {
        id: "event.rain_washed_cairn.read",
        label: "Read the Old Marks",
        description: "Intelligence check (DC 11). Success: the reader gains insight (XP). Failure: nothing comes of it.",
        effects: [
          {
            type: "check",
            check: { stat: "int", dc: 11 },
            onSuccess: [{ type: "xp", amount: 15, target: "picked_hero" }],
            onFailure: [{ type: "noop" }],
          },
        ],
      },
    ],
  },

  "event.glassroot_thicket": {
    id: "event.glassroot_thicket",
    title: "Glassroot Thicket",
    description: "Brittle, crystalline roots glitter with usable sap.",
    tags: ["risk", "treasure"],
    choices: [
      {
        id: "event.glassroot_thicket.harvest",
        label: "Harvest Carefully",
        description: "Dexterity check (DC 12). Success: 2 potions. Partial: 1 potion. Failure: a hero takes minor damage.",
        effects: [
          {
            type: "check",
            check: { stat: "dex", dc: 12, partialWithin: 3 },
            onSuccess: [
              { type: "potion", potionId: "potion.healing" },
              { type: "potion", potionId: "potion.healing" },
            ],
            onPartial: [{ type: "potion", potionId: "potion.healing" }],
            onFailure: [{ type: "hp_damage", amount: 4, target: "random_hero" }],
          },
        ],
      },
      {
        id: "event.glassroot_thicket.cut",
        label: "Cut Quickly",
        description: "Grab one potion fast; a careless hand takes a small cut.",
        effects: [
          { type: "potion", potionId: "potion.healing" },
          { type: "hp_damage", amount: 3, target: "random_hero" },
        ],
      },
    ],
  },

  "event.old_drill_ring": {
    id: "event.old_drill_ring",
    title: "Old Drill Ring",
    description: "A worn training circle still scuffed with sparring lines.",
    tags: ["train"],
    choices: [
      {
        id: "event.old_drill_ring.train_one",
        label: "Train One Hero",
        description: "One chosen hero drills hard and gains solid XP.",
        effects: [{ type: "xp", amount: 18, target: "picked_hero" }],
      },
      {
        id: "event.old_drill_ring.drill_together",
        label: "Drill Together",
        description: "The whole party runs lighter drills for shared XP.",
        effects: [{ type: "xp", amount: 7, target: "party" }],
      },
    ],
  },

  "event.hearth_wardens_remains": {
    id: "event.hearth_wardens_remains",
    title: "Hearth-Warden's Remains",
    description: "A fallen sentinel still clutches a faintly warm charm.",
    tags: ["moral", "treasure"],
    choices: [
      {
        id: "event.hearth_wardens_remains.take",
        label: "Take the Charm",
        description: "Claim the charm — disturbing the rest costs a hero some blood.",
        effects: [
          { type: "item", itemId: "item.lucky_charm" },
          { type: "hp_damage", amount: 5, target: "random_hero" },
        ],
      },
      {
        id: "event.hearth_wardens_remains.respects",
        label: "Pay Respects",
        description: "Honor the warden; one chosen hero leaves steadied (+1 Wisdom for the run).",
        effects: [{ type: "stat_boost", stat: "wis", amount: 1 }],
      },
    ],
  },

  "event.whispering_milestone": {
    id: "event.whispering_milestone",
    title: "Whispering Milestone",
    description: "An old roadstone murmurs when the wind turns.",
    tags: ["social", "risk"],
    choices: [
      {
        id: "event.whispering_milestone.listen",
        label: "Let One Hero Listen",
        description: "Wisdom check (DC 13). Success: that hero gains +1 Wisdom for the run. Failure: nothing.",
        effects: [
          {
            type: "check",
            check: { stat: "wis", dc: 13 },
            onSuccess: [{ type: "stat_boost", stat: "wis", amount: 1 }],
            onFailure: [{ type: "noop" }],
          },
        ],
      },
      {
        id: "event.whispering_milestone.chart",
        label: "Chart the Safer Road",
        description: "Trust the marker and find a small coin cache along the way.",
        effects: [{ type: "gold", amount: 16 }],
      },
    ],
  },

  "event.ashen_star_shrine": {
    id: "event.ashen_star_shrine",
    title: "Ashen Star Shrine",
    description: "A cold shrine ringed by burnt-out candles hums with old power.",
    tags: ["moral", "risk"],
    choices: [
      {
        id: "event.ashen_star_shrine.offer_might",
        label: "Offer Coin for Strength",
        description: "Spend 20 gold; one chosen hero gains +1 Strength for the run.",
        effects: [
          { type: "gold_cost", amount: 20 },
          { type: "stat_boost", stat: "str", amount: 1 },
        ],
        requirements: [{ type: "minGold", amount: 20 }],
      },
      {
        id: "event.ashen_star_shrine.offer_agility",
        label: "Offer Coin for Dexterity",
        description: "Spend 20 gold; one chosen hero gains +1 Dexterity for the run.",
        effects: [
          { type: "gold_cost", amount: 20 },
          { type: "stat_boost", stat: "dex", amount: 1 },
        ],
        requirements: [{ type: "minGold", amount: 20 }],
      },
      {
        id: "event.ashen_star_shrine.offer_spirit",
        label: "Offer Coin for Wisdom",
        description: "Spend 20 gold; one chosen hero gains +1 Wisdom for the run.",
        effects: [
          { type: "gold_cost", amount: 20 },
          { type: "stat_boost", stat: "wis", amount: 1 },
        ],
        requirements: [{ type: "minGold", amount: 20 }],
      },
      {
        id: "event.ashen_star_shrine.seize",
        label: "Seize the Ember",
        description: "High-risk Wisdom check (DC 14). Success: a relic and gold. Partial: some gold. Failure: a hero is badly burned.",
        effects: [
          {
            type: "check",
            check: { stat: "wis", dc: 14, partialWithin: 2 },
            onSuccess: [
              { type: "item", itemId: "item.bloodstone" },
              { type: "gold", amount: 25 },
            ],
            onPartial: [{ type: "gold", amount: 10 }],
            onFailure: [{ type: "hp_damage", amount: 9, target: "random_hero" }],
          },
        ],
      },
    ],
  },

  "event.tidewrack_cache": {
    id: "event.tidewrack_cache",
    title: "Tidewrack Cache",
    description: "A smuggler's stash washed up among the reeds — gear or coin, not both.",
    tags: ["treasure", "moral"],
    choices: [
      {
        id: "event.tidewrack_cache.goods",
        label: "Take the Goods",
        description: "Pocket the smuggled staff.",
        effects: [{ type: "item", itemId: "item.ember_staff" }],
      },
      {
        id: "event.tidewrack_cache.coin",
        label: "Take the Coin",
        description: "Leave the gear; the coin is simpler to carry.",
        effects: [{ type: "gold", amount: 22 }],
      },
    ],
  },

  "event.quiet_hollow": {
    id: "event.quiet_hollow",
    title: "Quiet Hollow",
    description: "A sheltered dell, warm and out of the wind.",
    tags: ["heal"],
    choices: [
      {
        id: "event.quiet_hollow.camp",
        label: "Make Camp",
        description: "Rest and bind wounds across the party.",
        effects: [{ type: "heal_party", percent: 40 }],
      },
      {
        id: "event.quiet_hollow.brew",
        label: "Brew Restoratives",
        description: "Boil herbs into a draught: bank a potion and ease light wounds.",
        effects: [
          { type: "potion", potionId: "potion.healing" },
          { type: "heal_party", percent: 15 },
        ],
      },
    ],
  },

  // ── Side quest puzzle events (Epic #171) ──────────────────────────────────

  "event.sq.goblin_relic.inscription_puzzle": {
    id: "event.sq.goblin_relic.inscription_puzzle",
    title: "Carved Inscription",
    description: "A stone slab near the relic bears carved runes. Deciphering them might reveal something useful.",
    tags: ["train"],
    choices: [
      {
        id: "event.sq.goblin_relic.inscription_puzzle.study",
        label: "Study the runes",
        description: "Intelligence check (DC 13). Success: gold and XP. Partial: some XP. Failure: nothing.",
        effects: [
          {
            type: "check",
            check: { stat: "int", dc: 13, partialWithin: 3 },
            onSuccess: [
              { type: "gold", amount: 20 },
              { type: "xp", amount: 15, target: "picked_hero" },
            ],
            onPartial: [{ type: "xp", amount: 10, target: "picked_hero" }],
            onFailure: [{ type: "noop" }],
          },
        ],
      },
      {
        id: "event.sq.goblin_relic.inscription_puzzle.ignore",
        label: "Ignore it",
        description: "Move on without engaging the runes.",
        effects: [{ type: "noop" }],
      },
    ],
  },

  "event.sq.deserter_cache.locked_chest": {
    id: "event.sq.deserter_cache.locked_chest",
    title: "Locked Supply Cache",
    description: "A heavy iron lock secures a chest left behind in the deserters' camp.",
    tags: ["treasure", "risk"],
    choices: [
      {
        id: "event.sq.deserter_cache.locked_chest.pick",
        label: "Pick the lock",
        description: "Dexterity check (DC 12). Success: gold and a potion. Partial: some gold. Failure: trap triggers, a hero is hurt.",
        effects: [
          {
            type: "check",
            check: { stat: "dex", dc: 12, partialWithin: 2 },
            onSuccess: [
              { type: "gold", amount: 30 },
              { type: "potion", potionId: "potion.healing" },
            ],
            onPartial: [{ type: "gold", amount: 15 }],
            onFailure: [{ type: "hp_damage", amount: 4, target: "random_hero" }],
          },
        ],
      },
      {
        id: "event.sq.deserter_cache.locked_chest.leave",
        label: "Leave it",
        description: "Don't risk the trap.",
        effects: [{ type: "noop" }],
      },
    ],
  },

  "event.sq.prisoner_rescue.guard_patrol": {
    id: "event.sq.prisoner_rescue.guard_patrol",
    title: "Patrol Pattern",
    description: "Guards move in irregular loops around the prison block. Reading their rhythm could save your party from a confrontation.",
    tags: ["risk"],
    choices: [
      {
        id: "event.sq.prisoner_rescue.guard_patrol.watch",
        label: "Watch and plan",
        description: "Wisdom check (DC 11). Success: first strike bonus damage. Failure: nothing.",
        effects: [
          {
            type: "check",
            check: { stat: "wis", dc: 11 },
            onSuccess: [{ type: "buff", modifier: { kind: "first_hit_bonus_damage", amount: 3 } }],
            onFailure: [{ type: "noop" }],
          },
        ],
      },
      {
        id: "event.sq.prisoner_rescue.guard_patrol.move_in",
        label: "Move in now",
        description: "Skip the observation and press forward immediately.",
        effects: [{ type: "noop" }],
      },
    ],
  },
};

/** Id of the shared pool used by event nodes that do not declare their own `eventPoolId`. */
export const DEFAULT_EVENT_POOL_ID = "pool.default";

/** The 10 authored events introduced by the F25 content pack (#56). */
export const EVENT_PACK_IDS = [
  "event.sunken_toll_chest",
  "event.lanterns_in_the_fog",
  "event.rain_washed_cairn",
  "event.glassroot_thicket",
  "event.old_drill_ring",
  "event.hearth_wardens_remains",
  "event.whispering_milestone",
  "event.ashen_star_shrine",
  "event.tidewrack_cache",
  "event.quiet_hollow",
] as const;

/**
 * Named event pools (L2): a node may name a curated pool via `NodeDef.eventPoolId`; nodes
 * without one fall back to {@link DEFAULT_EVENT_POOL_ID}. Selection is seeded and lives in
 * `selectEventForNode` (see `src/run/Events.ts`), never in the screen.
 *
 * The default pool carries the full event-pack plus the original four scenes so a run draws
 * varied, non-repeating events from a deep shared pool.
 */
export const EVENT_POOLS: Record<string, string[]> = {
  [DEFAULT_EVENT_POOL_ID]: [
    ...EVENT_PACK_IDS,
    "event.strange_shrine",
    "event.rogue_trader",
    "event.healing_spring",
    "event.crumbling_bridge",
  ],
};
