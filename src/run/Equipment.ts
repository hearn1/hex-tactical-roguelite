import { CLASS_REGISTRY } from "../data/classes.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import type { PartyMember } from "../state/RunState.ts";
import type { UnitStats } from "../state/types.ts";
import { canEquipWithAttunement } from "./Attunement.ts";
import type { InventoryState } from "./Inventory.ts";

export type EquipmentSlot = keyof PartyMember["equippedItemIds"];

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ["weapon", "armor", "trinket"];
export const STAT_KEYS: (keyof UnitStats)[] = ["maxHp", "armor", "move", "str", "dex", "con", "int", "wis", "cha"];

export interface EquipBagItemResult {
  ok: boolean;
  itemId: string | null;
  replacedItemId: string | null;
  reason?: string;
}

export interface EquipmentStatPreview {
  current: UnitStats;
  next: UnitStats;
  diff: UnitStats;
  slot: EquipmentSlot;
  replacedItemId: string | null;
}

function zeroStats(): UnitStats {
  return { maxHp: 0, armor: 0, move: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
}

export function canEquipItemToSlot(itemId: string, slot: EquipmentSlot): boolean {
  return ITEM_REGISTRY[itemId]?.slot === slot;
}

export function computePartyMemberStats(
  partyMember: PartyMember,
  equippedItemIds: PartyMember["equippedItemIds"] = partyMember.equippedItemIds,
): UnitStats {
  const classDef = CLASS_REGISTRY[partyMember.classId];
  const base = classDef?.baseStats ?? {
    maxHp: partyMember.maxHp,
    armor: 0,
    move: 0,
    str: 0,
    dex: 0,
    con: 0,
    int: 0,
    wis: 0,
    cha: 0,
  };
  const bonuses = zeroStats();

  for (const slot of EQUIPMENT_SLOTS) {
    const itemId = equippedItemIds[slot];
    if (!itemId) continue;
    const item = ITEM_REGISTRY[itemId];
    if (!item?.statBonuses) continue;
    for (const key of STAT_KEYS) {
      bonuses[key] += item.statBonuses[key] ?? 0;
    }
  }

  for (const key of STAT_KEYS) {
    bonuses[key] += partyMember.bonusStats[key] ?? 0;
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

export function previewEquipItem(partyMember: PartyMember, itemId: string): EquipmentStatPreview | null {
  const itemDef = ITEM_REGISTRY[itemId];
  if (!itemDef) return null;

  const slot = itemDef.slot;
  const current = computePartyMemberStats(partyMember);
  const nextEquipped = { ...partyMember.equippedItemIds, [slot]: itemId };
  const next = computePartyMemberStats(partyMember, nextEquipped);
  const diff = zeroStats();

  for (const key of STAT_KEYS) {
    diff[key] = next[key] - current[key];
  }

  return {
    current,
    next,
    diff,
    slot,
    replacedItemId: partyMember.equippedItemIds[slot],
  };
}

export function equipBagItemToPartyMember(
  partyMember: PartyMember,
  inventory: InventoryState,
  bagIndex: number,
  targetSlot: EquipmentSlot,
): EquipBagItemResult {
  const itemId = inventory.items[bagIndex] ?? null;
  if (!itemId) {
    return { ok: false, itemId: null, replacedItemId: null, reason: "No item in that bag slot." };
  }

  if (!canEquipItemToSlot(itemId, targetSlot)) {
    const actualSlot = ITEM_REGISTRY[itemId]?.slot;
    const reason = actualSlot
      ? `${ITEM_REGISTRY[itemId]?.displayName ?? itemId} fits ${actualSlot}, not ${targetSlot}.`
      : "Unknown item cannot be equipped.";
    return { ok: false, itemId, replacedItemId: null, reason };
  }

  const attune = canEquipWithAttunement(partyMember.equippedItemIds, itemId);
  if (!attune.ok) {
    const reason = attune.reason?.startsWith("Already attuned")
      ? `${partyMember.displayName} is ${attune.reason.charAt(0).toLowerCase()}${attune.reason.slice(1)}`
      : attune.reason;
    return { ok: false, itemId, replacedItemId: null, reason };
  }

  const replacedItemId = partyMember.equippedItemIds[targetSlot];
  partyMember.equippedItemIds[targetSlot] = itemId;
  inventory.items.splice(bagIndex, 1);

  if (replacedItemId) {
    inventory.items.push(replacedItemId);
  }

  return { ok: true, itemId, replacedItemId };
}
