export type EventEffect =
  | { type: "gold"; amount: number }
  | { type: "gold_cost"; amount: number }
  | { type: "hp_damage"; amount: number; target?: "random_hero" }
  | { type: "stat_boost"; stat: "might" | "agility" | "spirit"; amount: number }
  | { type: "potion"; potionId: string }
  | { type: "item"; itemId: string }
  | { type: "heal_party"; percent: number }
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
};
