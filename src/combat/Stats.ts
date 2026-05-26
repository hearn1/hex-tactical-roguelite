import type { UnitInstance, UnitStats } from "../state/types.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";

export function computeStats(unit: UnitInstance): UnitStats {
  const baseDef = CLASS_REGISTRY[unit.defId];
  const base = baseDef ? baseDef.baseStats : unit.stats;

  const bonuses: UnitStats = { maxHp: 0, armor: 0, move: 0, might: 0, agility: 0, spirit: 0 };

  for (const slot of ["weapon", "armor", "trinket"] as const) {
    const itemId = unit.equippedItemIds[slot];
    if (!itemId) continue;
    const item = ITEM_REGISTRY[itemId];
    if (!item?.statBonuses) continue;
    for (const key of Object.keys(item.statBonuses) as (keyof UnitStats)[]) {
      const val = item.statBonuses[key];
      if (val !== undefined) bonuses[key] += val;
    }
  }

  if (unit.bonusStats) {
    for (const key of Object.keys(unit.bonusStats) as (keyof UnitStats)[]) {
      const val = unit.bonusStats[key];
      if (val !== undefined) bonuses[key] += val;
    }
  }

  return {
    maxHp: base.maxHp + bonuses.maxHp,
    armor: base.armor + bonuses.armor,
    move: base.move + bonuses.move,
    might: base.might + bonuses.might,
    agility: base.agility + bonuses.agility,
    spirit: base.spirit + bonuses.spirit,
  };
}
