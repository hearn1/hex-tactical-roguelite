import type { ConditionId } from "../state/types.ts";

export type PotionEffect =
  | { kind: "heal"; amount: number }
  | { kind: "cleanse"; conditionIds: ConditionId[]; healAmount?: number }
  | { kind: "damage"; formula: string; range: number }
  | { kind: "buff"; conditionId: ConditionId; duration: number };

export interface PotionDef {
  id: string;
  displayName: string;
  description: string;
  effect: PotionEffect;
}

export const POTION_REGISTRY: Record<string, PotionDef> = {
  "potion.healing": {
    id: "potion.healing",
    displayName: "Healing Potion",
    description: "Heal target hero 8 HP.",
    effect: { kind: "heal", amount: 8 },
  },
  "potion.focus": {
    id: "potion.focus",
    displayName: "Focus Potion",
    description: "+2 to next attack/heal roll.",
    effect: { kind: "buff", conditionId: "blessed", duration: 1 },
  },
  "potion.fire_flask": {
    id: "potion.fire_flask",
    displayName: "Fire Flask",
    description: "Range 3 consumable, deals 1d6 fire damage.",
    effect: { kind: "damage", formula: "1d6", range: 3 },
  },
  "potion.bottled_dawn": {
    id: "potion.bottled_dawn",
    displayName: "Bottled Dawn",
    description: "Heal one hero for 8 HP and remove Slowed/Weakened if present.",
    effect: { kind: "cleanse", conditionIds: ["slowed", "weakened"], healAmount: 8 },
  },
};
