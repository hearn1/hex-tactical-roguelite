export interface PotionDef {
  id: string;
  displayName: string;
  description: string;
}

export const POTION_REGISTRY: Record<string, PotionDef> = {
  "potion.healing": {
    id: "potion.healing",
    displayName: "Healing Potion",
    description: "Heal target hero 8 HP.",
  },
  "potion.focus": {
    id: "potion.focus",
    displayName: "Focus Potion",
    description: "+2 to next attack/heal roll.",
  },
  "potion.fire_flask": {
    id: "potion.fire_flask",
    displayName: "Fire Flask",
    description: "Range 3 consumable, deals 1d6 fire damage.",
  },
};
