import type { RunState, PartyMember } from "../state/RunState.ts";
import { BACKGROUND_REGISTRY } from "../data/backgrounds.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import { LEVELUP_PASSIVE_START_COMBAT_GUARDED } from "../data/levelups.ts";
import { revealUpcomingNodes } from "../data/shopServices.ts";

/**
 * Applies a single hero's chosen background to a fresh run. Deterministic and intended
 * to run exactly once at run start, alongside adventure modifiers and meta upgrades.
 */
export function applyBackground(pm: PartyMember, run: RunState): void {
  if (!pm.backgroundId) return;
  const def = BACKGROUND_REGISTRY[pm.backgroundId];
  if (!def) return;

  const key = def.statBonus.stat as keyof typeof pm.bonusStats;
  pm.bonusStats[key] = (pm.bonusStats[key] ?? 0) + def.statBonus.amount;

  if (def.startingItemId) {
    grantStartingItem(pm, run, def.startingItemId);
  }

  if (def.startingPotionId) {
    const count = def.startingPotionCount ?? 1;
    for (let i = 0; i < count; i++) {
      run.inventory.potions.push(def.startingPotionId);
    }
  }

  switch (def.perk.type) {
    case "startCombatGuarded": {
      pm.passives = pm.passives ? [...pm.passives] : [];
      if (!pm.passives.includes(LEVELUP_PASSIVE_START_COMBAT_GUARDED)) {
        pm.passives.push(LEVELUP_PASSIVE_START_COMBAT_GUARDED);
      }
      break;
    }
    case "xpMultiplier": {
      run.runModifiers.push({ kind: "reward_xp_multiplier", value: def.perk.value });
      break;
    }
    case "revealNodes": {
      revealUpcomingNodes(run, def.perk.count);
      break;
    }
    case "bonusGold": {
      run.gold += def.perk.amount;
      run.inventory.gold = run.gold;
      break;
    }
    case "shopDiscount": {
      run.runModifiers.push({ kind: "shop_discount", value: def.perk.value });
      break;
    }
  }
}

/** Applies every party member's background once. Call at run start. */
export function applyBackgrounds(run: RunState): void {
  for (const pm of run.party) {
    applyBackground(pm, run);
  }
}

function grantStartingItem(pm: PartyMember, run: RunState, itemId: string): void {
  const itemDef = ITEM_REGISTRY[itemId];
  if (!itemDef) return;

  const slot = itemDef.slot;
  if (!pm.equippedItemIds[slot]) {
    pm.equippedItemIds[slot] = itemId;
    return;
  }

  run.inventory.items.push(itemId);
}
