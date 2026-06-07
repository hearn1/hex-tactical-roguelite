import { ITEM_REGISTRY } from "../data/items.ts";

/** Maximum number of attuned magic items a single hero may have equipped at once. */
export const ATTUNEMENT_LIMIT = 2;

/** Anything carrying the three equipment slots — both `PartyMember` and combat `UnitInstance`. */
export interface EquippedItemIds {
  weapon: string | null;
  armor: string | null;
  trinket: string | null;
}

export interface AttunementCheck {
  ok: boolean;
  reason?: string;
  current: number;
  limit: number;
}

export function requiresAttunement(itemId: string | null | undefined): boolean {
  if (!itemId) return false;
  return ITEM_REGISTRY[itemId]?.requiresAttunement === true;
}

export function attunedItemIdsFor(equippedItemIds: EquippedItemIds): string[] {
  return [equippedItemIds.weapon, equippedItemIds.armor, equippedItemIds.trinket].filter(
    (id): id is string => requiresAttunement(id),
  );
}

export function attunementCountFor(equippedItemIds: EquippedItemIds): number {
  return attunedItemIdsFor(equippedItemIds).length;
}

/**
 * Whether `itemId` may be equipped without exceeding the attunement limit, accounting for the
 * item it would replace in its own slot (replacing one attuned item with another is net-neutral).
 */
export function canEquipWithAttunement(equippedItemIds: EquippedItemIds, itemId: string): AttunementCheck {
  const current = attunementCountFor(equippedItemIds);
  const def = ITEM_REGISTRY[itemId];

  if (!def) {
    return { ok: false, reason: "Unknown item cannot be equipped.", current, limit: ATTUNEMENT_LIMIT };
  }
  if (!def.requiresAttunement) {
    return { ok: true, current, limit: ATTUNEMENT_LIMIT };
  }

  const replaced = equippedItemIds[def.slot];
  const projected = current - (requiresAttunement(replaced) ? 1 : 0) + 1;
  if (projected > ATTUNEMENT_LIMIT) {
    return {
      ok: false,
      reason: `Already attuned to ${current}/${ATTUNEMENT_LIMIT} magic items. Replace an attuned item first.`,
      current,
      limit: ATTUNEMENT_LIMIT,
    };
  }
  return { ok: true, current, limit: ATTUNEMENT_LIMIT };
}
