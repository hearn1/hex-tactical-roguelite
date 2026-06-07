import type { UnitStats } from "../state/types.ts";

const STAT_LABELS: Record<string, string> = {
  maxHp: "Max HP",
  armor: "Armor",
  move: "Move",
  might: "Might",
  agility: "Agility",
  spirit: "Spirit",
};

export type ItemHook =
  | {
      type: "oncePerCombatBonus";
      trigger: "firstMeleeAttack" | "firstSpellAttack" | "firstHitTaken" | "combatStart" | "firstTurn" | "firstHealDone";
      effect:
        | { kind: "bonusDamage"; value: number }
        | { kind: "damageReduction"; value: number }
        | { kind: "bonusHealing"; value: number }
        | { kind: "bonusMove"; value: number }
        | { kind: "applyCondition"; conditionId: string };
    }
  | {
      type: "attackBonus";
      attackType: "melee" | "spell";
      value: number;
    };

export interface ItemDef {
  id: string;
  displayName: string;
  slot: "weapon" | "armor" | "trinket";
  rarity: "common" | "uncommon" | "rare";
  /** Powerful items require attunement; a hero may attune at most {@link ATTUNEMENT_LIMIT}. */
  requiresAttunement?: boolean;
  statBonuses?: Partial<UnitStats>;
  grantedActionIds?: string[];
  flavorText?: string;
  hook?: ItemHook;
}

export const ITEM_REGISTRY: Record<string, ItemDef> = {
  "item.iron_sword": {
    id: "item.iron_sword",
    displayName: "Iron Sword",
    slot: "weapon",
    rarity: "common",
    statBonuses: { might: 1 },
  },
  "item.wooden_shield": {
    id: "item.wooden_shield",
    displayName: "Wooden Shield",
    slot: "trinket",
    rarity: "common",
    statBonuses: { armor: 1 },
  },
  "item.apprentice_wand": {
    id: "item.apprentice_wand",
    displayName: "Apprentice Wand",
    slot: "weapon",
    rarity: "common",
    statBonuses: { spirit: 1 },
  },
  "item.fine_dagger": {
    id: "item.fine_dagger",
    displayName: "Fine Dagger",
    slot: "weapon",
    rarity: "common",
    statBonuses: { agility: 1 },
  },
  "item.hunter_bow": {
    id: "item.hunter_bow",
    displayName: "Hunter Bow",
    slot: "weapon",
    rarity: "common",
    grantedActionIds: ["action.arrow_shot"],
  },
  "item.padded_armor": {
    id: "item.padded_armor",
    displayName: "Padded Armor",
    slot: "armor",
    rarity: "common",
    statBonuses: { maxHp: 1 },
  },
  "item.soldier_badge": {
    id: "item.soldier_badge",
    displayName: "Soldier Badge",
    slot: "trinket",
    rarity: "common",
    statBonuses: { might: 1 },
  },
  "item.chain_vest": {
    id: "item.chain_vest",
    displayName: "Chain Vest",
    slot: "armor",
    rarity: "common",
    statBonuses: { armor: 1 },
  },
  "item.lucky_charm": {
    id: "item.lucky_charm",
    displayName: "Lucky Charm",
    slot: "trinket",
    rarity: "common",
  },
  "item.bloodstone": {
    id: "item.bloodstone",
    displayName: "Bloodstone",
    slot: "trinket",
    rarity: "uncommon",
    statBonuses: { maxHp: 2 },
  },
  "item.ember_staff": {
    id: "item.ember_staff",
    displayName: "Ember Staff",
    slot: "weapon",
    rarity: "uncommon",
    statBonuses: { spirit: 1 },
  },
  "item.owl_feather": {
    id: "item.owl_feather",
    displayName: "Owl Feather",
    slot: "trinket",
    rarity: "uncommon",
  },
  "item.runed_robe": {
    id: "item.runed_robe",
    displayName: "Runed Robe",
    slot: "armor",
    rarity: "uncommon",
    statBonuses: { spirit: 1, maxHp: 1 },
  },
  "item.runemark_blade": {
    id: "item.runemark_blade",
    displayName: "Runemark Blade",
    slot: "weapon",
    rarity: "uncommon",
    requiresAttunement: true,
    statBonuses: { might: 1 },
    flavorText: "A steel blade etched with ancient runes that flare on the first strike.",
    hook: { type: "oncePerCombatBonus", trigger: "firstMeleeAttack", effect: { kind: "bonusDamage", value: 1 } },
  },
  "item.emberglass_wand": {
    id: "item.emberglass_wand",
    displayName: "Emberglass Wand",
    slot: "weapon",
    rarity: "uncommon",
    requiresAttunement: true,
    statBonuses: { spirit: 1 },
    flavorText: "A wand of obsidian and glass, smoldering with captive flame.",
    hook: { type: "attackBonus", attackType: "spell", value: 1 },
  },
  "item.ward_stitched_vest": {
    id: "item.ward_stitched_vest",
    displayName: "Ward-Stitched Vest",
    slot: "armor",
    rarity: "uncommon",
    requiresAttunement: true,
    statBonuses: { armor: 1 },
    flavorText: "Reinforced with warding threads that harden against the first blow.",
    hook: { type: "oncePerCombatBonus", trigger: "firstHitTaken", effect: { kind: "damageReduction", value: 1 } },
  },
  "item.moonwell_robe": {
    id: "item.moonwell_robe",
    displayName: "Moonwell Robe",
    slot: "armor",
    rarity: "uncommon",
    statBonuses: { spirit: 1, maxHp: 1 },
    flavorText: "Silvery fabric woven from moonlit well-threads, brimming with vitality.",
  },
  "item.hearthstone_charm": {
    id: "item.hearthstone_charm",
    displayName: "Hearthstone Charm",
    slot: "trinket",
    rarity: "common",
    requiresAttunement: true,
    flavorText: "A warm, flickering stone that wraps its bearer in protective energy when battle begins.",
    hook: { type: "oncePerCombatBonus", trigger: "combatStart", effect: { kind: "applyCondition", conditionId: "guarded" } },
  },
  "item.quickstep_buckle": {
    id: "item.quickstep_buckle",
    displayName: "Quickstep Buckle",
    slot: "trinket",
    rarity: "uncommon",
    requiresAttunement: true,
    flavorText: "A buckle that springs with alacrity, granting a burst of speed at the first sign of danger.",
    hook: { type: "oncePerCombatBonus", trigger: "firstTurn", effect: { kind: "bonusMove", value: 1 } },
  },
  "item.lantern_moth_pin": {
    id: "item.lantern_moth_pin",
    displayName: "Lantern Moth Pin",
    slot: "trinket",
    rarity: "uncommon",
    requiresAttunement: true,
    flavorText: "A pin bearing a luminescent moth; the first healing light each battle shines brighter.",
    hook: { type: "oncePerCombatBonus", trigger: "firstHealDone", effect: { kind: "bonusHealing", value: 2 } },
  },
};

const TRIGGER_LABELS: Record<string, string> = {
  firstMeleeAttack: "First melee attack each combat",
  firstSpellAttack: "First spell attack each combat",
  firstHitTaken: "First hit taken each combat",
  combatStart: "At combat start",
  firstTurn: "On first turn",
  firstHealDone: "First heal each combat",
};

const HOOK_KIND_LABELS: Record<string, string> = {
  bonusDamage: "deals +{value} damage",
  damageReduction: "reduces damage by {value}",
  bonusHealing: "restores +{value} HP",
  bonusMove: "+{value} Move",
  applyCondition: "grants {conditionId}",
};

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

export function describeItem(id: string): string {
  const def = ITEM_REGISTRY[id];
  if (!def) return "Unknown item";
  const parts: string[] = [capitalize(def.rarity), def.slot];
  if (def.requiresAttunement) parts.push("Requires Attunement");
  if (def.statBonuses) {
    for (const [k, v] of Object.entries(def.statBonuses)) {
      if (v) parts.push(`${STAT_LABELS[k] ?? k} +${v}`);
    }
  }
  if (def.grantedActionIds?.length) {
    parts.push(`Grants ${def.grantedActionIds.length} action(s)`);
  }
  if (def.flavorText) {
    parts.push(`"${def.flavorText}"`);
  }
  if (def.hook) {
    const desc = describeHook(def.hook);
    if (desc) parts.push(desc);
  }
  return parts.join(" | ");
}

function describeHook(hook: ItemHook): string {
  if (hook.type === "oncePerCombatBonus") {
    const trigger = TRIGGER_LABELS[hook.trigger] ?? hook.trigger;
    const tmpl = HOOK_KIND_LABELS[hook.effect.kind] ?? hook.effect.kind;
    const label = tmpl
      .replace("{value}", String("value" in hook.effect ? (hook.effect as { value: number }).value ?? "" : ""))
      .replace("{conditionId}", "conditionId" in hook.effect ? (hook.effect as { conditionId: string }).conditionId ?? "" : "");
    return `${trigger}: ${label}`;
  }
  if (hook.type === "attackBonus") {
    return `+${hook.value} damage on ${hook.attackType} attacks`;
  }
  return "";
}

export function describeItemShort(id: string): string {
  const def = ITEM_REGISTRY[id];
  if (!def) return "Unknown item";
  const parts: string[] = [capitalize(def.rarity), def.slot];
  if (def.requiresAttunement) parts.push("Requires Attunement");
  if (def.statBonuses) {
    for (const [k, v] of Object.entries(def.statBonuses)) {
      if (v) parts.push(`${STAT_LABELS[k] ?? k} +${v}`);
    }
  }
  if (def.grantedActionIds?.length) {
    parts.push(`Grants ${def.grantedActionIds.length} action(s)`);
  }
  return parts.join(" | ");
}
