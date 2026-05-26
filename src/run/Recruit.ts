import type { PartyMember } from "../state/RunState.ts";
import type { RunModifier } from "../state/types.ts";
import { CLASS_REGISTRY, HERO_DEFAULT_NAMES } from "../data/classes.ts";
import { ITEM_REGISTRY } from "../data/items.ts";

export function createPackMuleModifier(): RunModifier {
  return { kind: "gold_multiplier", value: 1.2 };
}

export function generateRecruitCandidates(rng: () => number, nodeId: string): PartyMember[] {
  const classIds = ["class.guardian", "class.acolyte", "class.arcanist"];
  const shuffled = [...classIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const pickedClasses = shuffled.slice(0, 2);

  return pickedClasses.map((classId, i) => {
    const def = CLASS_REGISTRY[classId];
    const displayName = HERO_DEFAULT_NAMES[classId] ?? `Hero`;
    const equippedItemIds: { weapon: string | null; armor: string | null; trinket: string | null } = {
      weapon: null, armor: null, trinket: null,
    };
    for (const itemId of def.startingItems ?? []) {
      const itemDef = ITEM_REGISTRY[itemId];
      if (!itemDef) continue;
      const slot = itemDef.slot;
      if (!equippedItemIds[slot]) {
        equippedItemIds[slot] = itemId;
      }
    }
    return {
      instanceId: `recruit_${nodeId}_${i}`,
      classId,
      displayName,
      level: 1,
      xp: 0,
      hp: def.baseStats.maxHp,
      maxHp: def.baseStats.maxHp,
      bonusStats: {},
      equippedItemIds,
    };
  });
}

export function addRecruitToParty(
  party: PartyMember[],
  recruit: PartyMember,
  inventoryItems: string[],
  replaceIndex?: number,
): void {
  if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < party.length) {
    const removed = party[replaceIndex];
    for (const slot of ["weapon", "armor", "trinket"] as const) {
      const itemId = removed.equippedItemIds[slot];
      if (itemId) {
        inventoryItems.push(itemId);
      }
    }
    party.splice(replaceIndex, 1);
  }
  party.push(recruit);
}
