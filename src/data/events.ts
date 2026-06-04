import type { CheckStat, RunModifier } from "../state/types.ts";

/**
 * Canonical ability-check declaration (F23). Defined here so this module is the single
 * source of truth shared with the F24 event resolver — do not redefine elsewhere.
 */
export interface CheckDef {
  stat: CheckStat;
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
  | { type: "stat_boost"; stat: CheckStat; amount: number }
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

export interface EventDef {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
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
        description: "Choose one hero to gain +1 Spirit.",
        effects: [{ type: "stat_boost", stat: "spirit", amount: 1 }],
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
        description: "Agility check (DC 12). Success: 25 gold. Partial: 10 gold. Failure: a hero takes 6 damage.",
        effects: [
          {
            type: "check",
            check: { stat: "agility", dc: 12, partialWithin: 3 },
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
};

/** Id of the shared pool used by event nodes that do not declare their own `eventPoolId`. */
export const DEFAULT_EVENT_POOL_ID = "pool.default";

/**
 * Named event pools (L2): a node may name a curated pool via `NodeDef.eventPoolId`; nodes
 * without one fall back to {@link DEFAULT_EVENT_POOL_ID}. Selection is seeded and lives in
 * `selectEventForNode` (see `src/run/Events.ts`), never in the screen.
 */
export const EVENT_POOLS: Record<string, string[]> = {
  [DEFAULT_EVENT_POOL_ID]: [
    "event.strange_shrine",
    "event.rogue_trader",
    "event.healing_spring",
    "event.crumbling_bridge",
  ],
};
