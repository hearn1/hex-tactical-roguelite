import type { UnitInstance, UnitStats } from "../state/types.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";
import { abilityMod } from "../data/abilities.ts";

export function computeStats(unit: UnitInstance): UnitStats {
  const baseDef = CLASS_REGISTRY[unit.defId];
  const base = baseDef ? baseDef.baseStats : unit.stats;

  const bonuses: UnitStats = { maxHp: 0, armor: 0, move: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

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

  if (unit.abilityScores) {
    const scores = unit.abilityScores;
    bonuses.str += abilityMod(scores.str);
    bonuses.dex += abilityMod(scores.dex);
    bonuses.con += abilityMod(scores.con);
    bonuses.int += abilityMod(scores.int);
    bonuses.wis += abilityMod(scores.wis);
    bonuses.cha += abilityMod(scores.cha);
    if (scores.dex > 10) bonuses.armor += 1;
    bonuses.maxHp += abilityMod(scores.con) * Math.max(1, unit.level);
  }

  return {
    maxHp: base.maxHp + bonuses.maxHp,
    armor: base.armor + bonuses.armor,
    move: base.move + bonuses.move,
    str: base.str + bonuses.str,
    dex: base.dex + bonuses.dex,
    con: base.con + bonuses.con,
    int: base.int + bonuses.int,
    wis: base.wis + bonuses.wis,
    cha: base.cha + bonuses.cha,
  };
}
