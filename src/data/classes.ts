import type { UnitStats } from "../state/types.ts";

export interface ClassDef {
  id: string;
  displayName: string;
  baseStats: UnitStats;
  actionIds: string[];
  startingItems: string[];
}

export const CLASS_REGISTRY: Record<string, ClassDef> = {
  "class.guardian": {
    id: "class.guardian",
    displayName: "Guardian",
    baseStats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    actionIds: ["action.slash", "action.shield_bash", "action.guard"],
    startingItems: ["item.iron_sword", "item.wooden_shield"],
  },
  "class.acolyte": {
    id: "class.acolyte",
    displayName: "Acolyte",
    baseStats: { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 3 },
    actionIds: ["action.mace_strike", "action.mend_wounds", "action.bless"],
    startingItems: ["item.padded_armor"],
  },
  "class.arcanist": {
    id: "class.arcanist",
    displayName: "Arcanist",
    baseStats: { maxHp: 11, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 },
    actionIds: ["action.fire_bolt", "action.frost_shard", "action.arcane_ward"],
    startingItems: ["item.apprentice_wand"],
  },
};

export const HERO_DEFAULT_NAMES: Record<string, string> = {
  "class.guardian": "Mara",
  "class.acolyte": "Sable",
  "class.arcanist": "Eldra",
};
