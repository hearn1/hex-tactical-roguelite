export interface ActionDef {
  id: string;
  displayName: string;
  description: string;
  source: "class" | "item" | "enemy";
  targetType: "enemy" | "ally" | "self";
  range: number;
  accuracyStat?: "might" | "agility" | "spirit";
  effect:
    | { type: "damage"; formula: string }
    | { type: "heal"; formula: string };
}

export const ACTION_REGISTRY: Record<string, ActionDef> = {
  "action.slash": {
    id: "action.slash",
    displayName: "Slash",
    description: "A sweeping melee attack.",
    source: "class",
    targetType: "enemy",
    range: 1,
    accuracyStat: "might",
    effect: { type: "damage", formula: "1d6 + might" },
  },
  "action.mend_wounds": {
    id: "action.mend_wounds",
    displayName: "Mend Wounds",
    description: "Heals an ally's wounds.",
    source: "class",
    targetType: "ally",
    range: 3,
    accuracyStat: "spirit",
    effect: { type: "heal", formula: "1d6 + spirit" },
  },
  "action.fire_bolt": {
    id: "action.fire_bolt",
    displayName: "Fire Bolt",
    description: "A bolt of searing flame.",
    source: "class",
    targetType: "enemy",
    range: 4,
    accuracyStat: "spirit",
    effect: { type: "damage", formula: "1d8 + spirit" },
  },
  "action.rusty_stab": {
    id: "action.rusty_stab",
    displayName: "Rusty Stab",
    description: "A crude goblin stab.",
    source: "enemy",
    targetType: "enemy",
    range: 1,
    accuracyStat: "might",
    effect: { type: "damage", formula: "1d4 + might" },
  },
  "action.bite": {
    id: "action.bite",
    displayName: "Bite",
    description: "Ferocious biting attack.",
    source: "enemy",
    targetType: "enemy",
    range: 1,
    accuracyStat: "might",
    effect: { type: "damage", formula: "1d6 + might" },
  },
  "action.bone_arrow": {
    id: "action.bone_arrow",
    displayName: "Bone Arrow",
    description: "A shot from a bone bow.",
    source: "enemy",
    targetType: "enemy",
    range: 5,
    accuracyStat: "agility",
    effect: { type: "damage", formula: "1d6 + agility" },
  },
  "action.heavy_club": {
    id: "action.heavy_club",
    displayName: "Heavy Club",
    description: "A crushing blow.",
    source: "enemy",
    targetType: "enemy",
    range: 1,
    accuracyStat: "might",
    effect: { type: "damage", formula: "1d8 + might" },
  },
  "action.dark_bolt": {
    id: "action.dark_bolt",
    displayName: "Dark Bolt",
    description: "A bolt of shadow energy.",
    source: "enemy",
    targetType: "enemy",
    range: 4,
    accuracyStat: "spirit",
    effect: { type: "damage", formula: "1d6 + spirit" },
  },
  "action.minor_heal": {
    id: "action.minor_heal",
    displayName: "Minor Heal",
    description: "Heals an ally for a small amount.",
    source: "enemy",
    targetType: "ally",
    range: 3,
    accuracyStat: "spirit",
    effect: { type: "heal", formula: "1d4 + spirit" },
  },
};
