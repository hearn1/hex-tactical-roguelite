import type { CheckStat } from "../state/types.ts";
import { POTION_REGISTRY } from "./potions.ts";

/**
 * A background's mechanical effect. All effects are minor and readable (one stat point,
 * a little gold, or a single starter potion) and reuse existing run primitives so no new
 * combat code is needed:
 * - `statBonus` folds into `PartyMember.bonusStats`, so it flows into combat
 *   (`computeStats`) AND F23 non-combat checks (`checkModifierFor`) via the one shared
 *   `CheckStat`/`bonusStats` path.
 * - `gold` adds to `run.gold` at run start.
 * - `potion` pushes starter potions into the run inventory.
 * - `eventModifier` is a declared seam consumed by F24/F25 events; applying a background
 *   does nothing for this type today (no event-side wiring is built here).
 */
export type BackgroundEffect =
  | { type: "statBonus"; stat: CheckStat; amount: number }
  | { type: "gold"; amount: number }
  | { type: "potion"; potionId: string; count: number }
  | { type: "eventModifier"; tag: string };

export interface BackgroundDef {
  id: string;
  displayName: string;
  /** Short original flavor text shown in setup and hero panels. */
  flavor: string;
  effect: BackgroundEffect;
}

/**
 * Five original backgrounds, one minor effect each (maintainer-confirmed set, #53).
 * Covers the three check stats plus a gold and a potion lever. Any background can be
 * assigned to any class — they are flavor/utility, not class-locked.
 */
export const BACKGROUND_REGISTRY: Record<string, BackgroundDef> = {
  "background.hedge_scholar": {
    id: "background.hedge_scholar",
    displayName: "Hedge Scholar",
    flavor: "Self-taught from borrowed books and long nights by the candle.",
    effect: { type: "statBonus", stat: "spirit", amount: 1 },
  },
  "background.caravan_guard": {
    id: "background.caravan_guard",
    displayName: "Caravan Guard",
    flavor: "Years spent shielding wagons taught a steady arm and a hard stare.",
    effect: { type: "statBonus", stat: "might", amount: 1 },
  },
  "background.cutpurse": {
    id: "background.cutpurse",
    displayName: "Cutpurse",
    flavor: "Quick fingers and quicker feet, honed in crowded market lanes.",
    effect: { type: "statBonus", stat: "agility", amount: 1 },
  },
  "background.merchants_heir": {
    id: "background.merchants_heir",
    displayName: "Merchant's Heir",
    flavor: "Left the family ledgers behind, but not the family coin.",
    effect: { type: "gold", amount: 10 },
  },
  "background.field_medic": {
    id: "background.field_medic",
    displayName: "Field Medic",
    flavor: "Patched soldiers on the line and never travels without a remedy.",
    effect: { type: "potion", potionId: "potion.healing", count: 1 },
  },
};

/** Convenience accessor mirroring the other registries' lookup pattern. */
export function getBackground(id: string): BackgroundDef | undefined {
  return BACKGROUND_REGISTRY[id];
}

/** Short human-readable summary of a background's mechanical effect, for setup + hero panels. */
export function describeBackgroundEffect(def: BackgroundDef): string {
  const e = def.effect;
  switch (e.type) {
    case "statBonus":
      return `+${e.amount} ${e.stat.charAt(0).toUpperCase()}${e.stat.slice(1)} (checks)`;
    case "gold":
      return `+${e.amount} starting gold`;
    case "potion": {
      const name = POTION_REGISTRY[e.potionId]?.displayName ?? e.potionId;
      return `Start with ${e.count}× ${name}`;
    }
    case "eventModifier":
      return `Event affinity: ${e.tag}`;
  }
}
