export interface UpgradeDef {
  id: string;
  displayName: string;
  description: string;
  costRenownPerRank: number[];
  maxRank: number;
  effect: {
    type: "startingGoldBonus" | "startingXpBonus" | "startingPotion" | "statBonus" | "startingItem";
    amountPerRank?: number;
    stat?: string;
    classId?: string;
    itemId?: string;
  };
}

export const UPGRADE_REGISTRY: Record<string, UpgradeDef> = {
  "upgrade.starting_gold": {
    id: "upgrade.starting_gold",
    displayName: "Coin Purse",
    description: "+5 starting gold per rank.",
    costRenownPerRank: [5, 8, 11, 14, 17],
    maxRank: 5,
    effect: { type: "startingGoldBonus", amountPerRank: 5 },
  },
  "upgrade.starting_xp": {
    id: "upgrade.starting_xp",
    displayName: "Training Manual",
    description: "Starting party gains +10 XP per rank.",
    costRenownPerRank: [8, 12, 16, 20, 24],
    maxRank: 5,
    effect: { type: "startingXpBonus", amountPerRank: 10 },
  },
  "upgrade.potion_belt": {
    id: "upgrade.potion_belt",
    displayName: "Potion Belt",
    description: "Start with +1 Healing Potion per rank.",
    costRenownPerRank: [8, 14],
    maxRank: 2,
    effect: { type: "startingPotion", amountPerRank: 1 },
  },
  "upgrade.veteran_guardian": {
    id: "upgrade.veteran_guardian",
    displayName: "Veteran Guardian",
    description: "Guardian starts with +1 Might.",
    costRenownPerRank: [12],
    maxRank: 1,
    effect: { type: "statBonus", stat: "might", classId: "class.guardian", amountPerRank: 1 },
  },
  "upgrade.apprentice_kit": {
    id: "upgrade.apprentice_kit",
    displayName: "Apprentice Kit",
    description: "Arcanist may start with Apprentice Wand.",
    costRenownPerRank: [12],
    maxRank: 1,
    effect: { type: "startingItem", itemId: "item.apprentice_wand", classId: "class.arcanist" },
  },
};

export const ALL_UPGRADES: UpgradeDef[] = Object.values(UPGRADE_REGISTRY);
