/**
 * Data-driven sprite overlay layers (#93). A unit's on-grid appearance is composed by
 * stacking procedural overlays on top of its base class/enemy sprite, in draw order:
 *
 *   base body  →  armor look  →  weapon  →  archetype flair
 *
 * Appearance is derived every render from the unit's live `equippedItemIds` + `archetypeId`
 * (see {@link resolveSpriteLayers}), so equipping a weapon or picking an archetype changes the
 * sprite with no caching to invalidate. New equipment visuals only need a registry entry here —
 * no renderer changes — satisfying the issue's "data-driven, no code for new visuals" criterion.
 *
 * This module is intentionally pure data + resolution: the canvas drawing of each overlay lives
 * in the renderer (CombatThreeRenderer) where the rest of the procedural sprite drawing lives.
 */

export type WeaponShape = "sword" | "mace" | "dagger" | "bow" | "wand" | "staff";
export type ArmorLook = "light" | "medium" | "heavy";
export type FlairKind = "aura" | "cloak" | "accessory";

export type SpriteLayerKind = "armorLook" | "weapon" | "flair";

export interface WeaponOverlayDef {
  id: string;
  shape: WeaponShape;
  /** Tint for the weapon's blade/head/tip. */
  color: string;
}

export interface ArmorOverlayDef {
  id: string;
  look: ArmorLook;
  /** Tint layered over the body to read as the armor tier. */
  tint: string;
}

export interface FlairOverlayDef {
  id: string;
  kind: FlairKind;
  color: string;
}

/** One resolved layer for a unit, in draw order. */
export interface SpriteLayer {
  kind: SpriteLayerKind;
  overlayId: string;
}

export const WEAPON_OVERLAYS: Record<string, WeaponOverlayDef> = {
  "overlay.weapon.sword": { id: "overlay.weapon.sword", shape: "sword", color: "#d8dde6" },
  "overlay.weapon.mace": { id: "overlay.weapon.mace", shape: "mace", color: "#c9b27a" },
  "overlay.weapon.dagger": { id: "overlay.weapon.dagger", shape: "dagger", color: "#cfd6df" },
  "overlay.weapon.bow": { id: "overlay.weapon.bow", shape: "bow", color: "#a9763f" },
  "overlay.weapon.wand": { id: "overlay.weapon.wand", shape: "wand", color: "#f0b4ff" },
  "overlay.weapon.staff": { id: "overlay.weapon.staff", shape: "staff", color: "#ff9a4d" },
};

export const ARMOR_OVERLAYS: Record<string, ArmorOverlayDef> = {
  "overlay.armor.light": { id: "overlay.armor.light", look: "light", tint: "#8c7a55" },
  "overlay.armor.medium": { id: "overlay.armor.medium", look: "medium", tint: "#6f7785" },
  "overlay.armor.heavy": { id: "overlay.armor.heavy", look: "heavy", tint: "#9aa3b2" },
};

export const FLAIR_OVERLAYS: Record<string, FlairOverlayDef> = {
  "overlay.flair.shieldbearer": { id: "overlay.flair.shieldbearer", kind: "accessory", color: "#6f9bff" },
  "overlay.flair.vindicator": { id: "overlay.flair.vindicator", kind: "aura", color: "#ff6a6a" },
  "overlay.flair.beacon": { id: "overlay.flair.beacon", kind: "aura", color: "#ffd76a" },
  "overlay.flair.cloistered": { id: "overlay.flair.cloistered", kind: "cloak", color: "#9a7bff" },
  "overlay.flair.evoker": { id: "overlay.flair.evoker", kind: "aura", color: "#6fe8ff" },
  "overlay.flair.enchanter": { id: "overlay.flair.enchanter", kind: "aura", color: "#ff7be0" },
  "overlay.flair.champion": { id: "overlay.flair.champion", kind: "aura", color: "#ffe066" },
  "overlay.flair.battle_master": { id: "overlay.flair.battle_master", kind: "accessory", color: "#ff8c42" },
};

/** Weapon/armor item id → overlay id. Trinkets have no appearance layer. */
export const ITEM_OVERLAYS: Record<string, string> = {
  // Weapons
  "item.iron_sword": "overlay.weapon.sword",
  "item.runemark_blade": "overlay.weapon.sword",
  "item.fine_dagger": "overlay.weapon.dagger",
  "item.hunter_bow": "overlay.weapon.bow",
  "item.apprentice_wand": "overlay.weapon.wand",
  "item.emberglass_wand": "overlay.weapon.wand",
  "item.ember_staff": "overlay.weapon.staff",
  // Armor
  "item.padded_armor": "overlay.armor.light",
  "item.runed_robe": "overlay.armor.light",
  "item.moonwell_robe": "overlay.armor.light",
  "item.ward_stitched_vest": "overlay.armor.medium",
  "item.chain_vest": "overlay.armor.heavy",
};

/** Archetype id → flair overlay id. */
export const ARCHETYPE_FLAIR: Record<string, string> = {
  "archetype.guardian.shieldbearer": "overlay.flair.shieldbearer",
  "archetype.guardian.vindicator": "overlay.flair.vindicator",
  "archetype.acolyte.beacon": "overlay.flair.beacon",
  "archetype.acolyte.cloistered": "overlay.flair.cloistered",
  "archetype.arcanist.evoker": "overlay.flair.evoker",
  "archetype.arcanist.enchanter": "overlay.flair.enchanter",
  "archetype.fighter.champion": "overlay.flair.champion",
  "archetype.fighter.battle_master": "overlay.flair.battle_master",
};

/** Look a hero shows when the corresponding slot is empty, keyed by class id (= hero `defId`). */
export const CLASS_DEFAULT_WEAPON: Record<string, string> = {
  "class.guardian": "overlay.weapon.sword",
  "class.acolyte": "overlay.weapon.mace",
  "class.arcanist": "overlay.weapon.wand",
  "class.scout": "overlay.weapon.dagger",
  "class.fighter": "overlay.weapon.sword",
  "class.rogue": "overlay.weapon.dagger",
};

export const CLASS_DEFAULT_ARMOR: Record<string, string> = {
  "class.guardian": "overlay.armor.heavy",
  "class.acolyte": "overlay.armor.medium",
  "class.arcanist": "overlay.armor.light",
  "class.scout": "overlay.armor.light",
  "class.fighter": "overlay.armor.heavy",
  "class.rogue": "overlay.armor.light",
};

/** Gear shown for enemies that visibly carry a weapon (best-effort per the AC). */
export const ENEMY_DEFAULT_WEAPON: Record<string, string> = {
  "enemy.goblin_skirmisher": "overlay.weapon.dagger",
  "enemy.skeleton_archer": "overlay.weapon.bow",
  "enemy.bandit_brute": "overlay.weapon.mace",
  "enemy.shadow_stalker": "overlay.weapon.dagger",
};

export function getWeaponOverlay(id: string): WeaponOverlayDef | null {
  return WEAPON_OVERLAYS[id] ?? null;
}

export function getArmorOverlay(id: string): ArmorOverlayDef | null {
  return ARMOR_OVERLAYS[id] ?? null;
}

export function getFlairOverlay(id: string): FlairOverlayDef | null {
  return FLAIR_OVERLAYS[id] ?? null;
}

export interface UnitEquipment {
  weapon: string | null;
  armor: string | null;
  trinket: string | null;
}

/**
 * Resolve the ordered overlay stack (armor look → weapon → flair) for a unit, derived from its
 * base def, equipped items, and archetype. Empty slots fall back to the class/enemy default look
 * so heroes are never bare; unknown ids simply contribute no layer.
 */
export function resolveSpriteLayers(
  defId: string,
  equipped: UnitEquipment | undefined,
  archetypeId: string | undefined,
): SpriteLayer[] {
  const layers: SpriteLayer[] = [];

  const armorId = (equipped?.armor && ITEM_OVERLAYS[equipped.armor]) || CLASS_DEFAULT_ARMOR[defId];
  if (armorId && ARMOR_OVERLAYS[armorId]) {
    layers.push({ kind: "armorLook", overlayId: armorId });
  }

  const weaponId =
    (equipped?.weapon && ITEM_OVERLAYS[equipped.weapon]) ||
    CLASS_DEFAULT_WEAPON[defId] ||
    ENEMY_DEFAULT_WEAPON[defId];
  if (weaponId && WEAPON_OVERLAYS[weaponId]) {
    layers.push({ kind: "weapon", overlayId: weaponId });
  }

  const flairId = archetypeId ? ARCHETYPE_FLAIR[archetypeId] : undefined;
  if (flairId && FLAIR_OVERLAYS[flairId]) {
    layers.push({ kind: "flair", overlayId: flairId });
  }

  return layers;
}

/** Stable cache key for a unit's full appearance, so textures rebuild only when a layer changes. */
export function spriteAppearanceKey(
  defId: string,
  equipped: UnitEquipment | undefined,
  archetypeId: string | undefined,
): string {
  return resolveSpriteLayers(defId, equipped, archetypeId)
    .map((layer) => layer.overlayId)
    .join("+");
}
