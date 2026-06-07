import type { UnitStats } from "../state/types.ts";

export interface ClassDef {
  id: string;
  displayName: string;
  baseStats: UnitStats;
  hitDieSize: number;
  actionIds: string[];
  startingItems: string[];
  /**
   * Spell slots this class refreshes each Long Rest (#118). Spell-slot actions consume these;
   * cantrips and martial actions remain unlimited. Non-casters omit this (treated as 0).
   */
  spellSlotsMax?: number;
  /**
   * Background assigned to this class on the Quick Start path so a one-click party is still
   * complete and flavored (maintainer decision, #53). Custom setup defaults to this too but
   * the player may change it or pick "none".
   */
  defaultBackgroundId: string;
}

export const CLASS_REGISTRY: Record<string, ClassDef> = {
  "class.guardian": {
    id: "class.guardian",
    displayName: "Guardian",
    baseStats: { maxHp: 18, armor: 14, move: 3, might: 3, agility: 1, spirit: 0 },
    hitDieSize: 10,
    actionIds: ["action.slash", "action.shield_bash", "action.guard"],
    startingItems: ["item.iron_sword", "item.wooden_shield"],
    defaultBackgroundId: "background.caravan_guard",
  },
  "class.acolyte": {
    id: "class.acolyte",
    displayName: "Acolyte",
    baseStats: { maxHp: 14, armor: 12, move: 3, might: 1, agility: 1, spirit: 3 },
    hitDieSize: 8,
    actionIds: ["action.mace_strike", "action.mend_wounds", "action.bless"],
    startingItems: ["item.padded_armor"],
    spellSlotsMax: 2,
    defaultBackgroundId: "background.field_medic",
  },
  "class.arcanist": {
    id: "class.arcanist",
    displayName: "Arcanist",
    baseStats: { maxHp: 11, armor: 11, move: 3, might: 0, agility: 1, spirit: 4 },
    hitDieSize: 6,
    actionIds: ["action.fire_bolt", "action.frost_shard", "action.arcane_ward"],
    startingItems: ["item.apprentice_wand"],
    spellSlotsMax: 2,
    defaultBackgroundId: "background.hedge_scholar",
  },
  "class.scout": {
    id: "class.scout",
    displayName: "Scout",
    // Agility-based skirmisher (#119): squishier than the Guardian but the most mobile hero.
    baseStats: { maxHp: 13, armor: 13, move: 4, might: 1, agility: 3, spirit: 0 },
    hitDieSize: 8,
    actionIds: ["action.precise_stab", "action.shortbow_shot", "action.cunning_step"],
    startingItems: ["item.fine_dagger"],
    defaultBackgroundId: "background.cutpurse",
  },
};

export const HERO_DEFAULT_NAMES: Record<string, string> = {
  "class.guardian": "Mara",
  "class.acolyte": "Sable",
  "class.arcanist": "Eldra",
  "class.scout": "Nyx",
};
