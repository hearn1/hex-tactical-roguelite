export type EventEffect =
  | { type: "gold"; amount: number }
  | { type: "hp_damage"; amount: number; target?: "random_hero" }
  | { type: "stat_boost"; stat: "might" | "agility" | "spirit"; amount: number }
  | { type: "potion"; potionId: string }
  | { type: "noop" };

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  effects: EventEffect[];
}

export interface EventDef {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
}

export const EVENT_REGISTRY: Record<string, EventDef> = {
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
};
