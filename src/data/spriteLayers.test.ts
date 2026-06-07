import { describe, expect, it } from "vitest";
import { CLASS_REGISTRY } from "./classes.ts";
import { ARCHETYPE_REGISTRY } from "./archetypes.ts";
import { ITEM_REGISTRY } from "./items.ts";
import {
  ARCHETYPE_FLAIR,
  ARMOR_OVERLAYS,
  CLASS_DEFAULT_ARMOR,
  CLASS_DEFAULT_WEAPON,
  ENEMY_DEFAULT_WEAPON,
  FLAIR_OVERLAYS,
  ITEM_OVERLAYS,
  WEAPON_OVERLAYS,
  getArmorOverlay,
  getWeaponOverlay,
  resolveSpriteLayers,
  spriteAppearanceKey,
} from "./spriteLayers.ts";

const NO_EQUIP = { weapon: null, armor: null, trinket: null };

describe("resolveSpriteLayers", () => {
  it("derives armor look → weapon → flair in draw order from equipment and archetype", () => {
    const layers = resolveSpriteLayers(
      "class.guardian",
      { weapon: "item.iron_sword", armor: "item.chain_vest", trinket: null },
      "archetype.guardian.shieldbearer",
    );
    expect(layers.map((l) => l.kind)).toEqual(["armorLook", "weapon", "flair"]);
    expect(layers.map((l) => l.overlayId)).toEqual([
      "overlay.armor.heavy",
      "overlay.weapon.sword",
      "overlay.flair.shieldbearer",
    ]);
  });

  it("maps the equipped weapon to its overlay (iron sword → sword, ember staff → staff)", () => {
    const sword = resolveSpriteLayers("class.guardian", { weapon: "item.iron_sword", armor: null, trinket: null }, undefined);
    const staff = resolveSpriteLayers("class.arcanist", { weapon: "item.ember_staff", armor: null, trinket: null }, undefined);
    expect(sword.find((l) => l.kind === "weapon")?.overlayId).toBe("overlay.weapon.sword");
    expect(staff.find((l) => l.kind === "weapon")?.overlayId).toBe("overlay.weapon.staff");
  });

  it("maps heavy armor to the heavy body look", () => {
    const layers = resolveSpriteLayers("class.guardian", { weapon: null, armor: "item.chain_vest", trinket: null }, undefined);
    expect(layers.find((l) => l.kind === "armorLook")?.overlayId).toBe("overlay.armor.heavy");
  });

  it("falls back to the class default weapon and armor when slots are empty", () => {
    const layers = resolveSpriteLayers("class.acolyte", NO_EQUIP, undefined);
    expect(layers.find((l) => l.kind === "weapon")?.overlayId).toBe(CLASS_DEFAULT_WEAPON["class.acolyte"]);
    expect(layers.find((l) => l.kind === "armorLook")?.overlayId).toBe(CLASS_DEFAULT_ARMOR["class.acolyte"]);
  });

  it("adds an archetype flair layer only when an archetype is chosen", () => {
    const none = resolveSpriteLayers("class.arcanist", NO_EQUIP, undefined);
    const evoker = resolveSpriteLayers("class.arcanist", NO_EQUIP, "archetype.arcanist.evoker");
    expect(none.some((l) => l.kind === "flair")).toBe(false);
    expect(evoker.find((l) => l.kind === "flair")?.overlayId).toBe("overlay.flair.evoker");
  });

  it("shows gear for enemies that carry a weapon, and nothing for those that don't", () => {
    const archer = resolveSpriteLayers("enemy.skeleton_archer", NO_EQUIP, undefined);
    const wolf = resolveSpriteLayers("enemy.wolf", NO_EQUIP, undefined);
    expect(archer.find((l) => l.kind === "weapon")?.overlayId).toBe("overlay.weapon.bow");
    expect(wolf.length).toBe(0);
  });

  it("ignores unknown item ids rather than producing a broken layer", () => {
    const layers = resolveSpriteLayers("class.scout", { weapon: "item.does_not_exist", armor: null, trinket: null }, undefined);
    // Unknown weapon id → no equipped overlay, falls back to the class default weapon.
    expect(layers.find((l) => l.kind === "weapon")?.overlayId).toBe(CLASS_DEFAULT_WEAPON["class.scout"]);
  });
});

describe("spriteAppearanceKey", () => {
  it("changes when the equipped weapon changes (so the texture rebuilds)", () => {
    const sword = spriteAppearanceKey("class.guardian", { weapon: "item.iron_sword", armor: null, trinket: null }, undefined);
    const dagger = spriteAppearanceKey("class.guardian", { weapon: "item.fine_dagger", armor: null, trinket: null }, undefined);
    expect(sword).not.toBe(dagger);
  });

  it("is stable for the same appearance", () => {
    const a = spriteAppearanceKey("class.arcanist", { weapon: "item.ember_staff", armor: null, trinket: null }, "archetype.arcanist.evoker");
    const b = spriteAppearanceKey("class.arcanist", { weapon: "item.ember_staff", armor: null, trinket: null }, "archetype.arcanist.evoker");
    expect(a).toBe(b);
  });
});

describe("overlay registry integrity", () => {
  it("gives every playable class a default weapon and armor look that resolve", () => {
    for (const classId of Object.keys(CLASS_REGISTRY)) {
      expect(getWeaponOverlay(CLASS_DEFAULT_WEAPON[classId]), classId).not.toBeNull();
      expect(getArmorOverlay(CLASS_DEFAULT_ARMOR[classId]), classId).not.toBeNull();
    }
  });

  it("gives every class access to at least 2 distinct weapon appearance variants", () => {
    // Weapons are not class-locked, so every class can display its default look plus any
    // equippable weapon item. Assert each class has >= 2 distinct silhouettes available.
    const weaponItemShapes = Object.entries(ITEM_OVERLAYS)
      .filter(([, overlayId]) => WEAPON_OVERLAYS[overlayId])
      .map(([, overlayId]) => WEAPON_OVERLAYS[overlayId].shape);

    for (const classId of Object.keys(CLASS_REGISTRY)) {
      const shapes = new Set<string>([WEAPON_OVERLAYS[CLASS_DEFAULT_WEAPON[classId]].shape, ...weaponItemShapes]);
      expect(shapes.size, classId).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives every archetype a flair overlay that resolves", () => {
    for (const archetypeId of Object.keys(ARCHETYPE_REGISTRY)) {
      const flairId = ARCHETYPE_FLAIR[archetypeId];
      expect(flairId, archetypeId).toBeDefined();
      expect(FLAIR_OVERLAYS[flairId], archetypeId).toBeDefined();
    }
  });

  it("only maps real weapon/armor items, and every mapped overlay resolves", () => {
    for (const [itemId, overlayId] of Object.entries(ITEM_OVERLAYS)) {
      const item = ITEM_REGISTRY[itemId];
      expect(item, itemId).toBeDefined();
      expect(item.slot === "weapon" || item.slot === "armor", itemId).toBe(true);
      const resolves = !!WEAPON_OVERLAYS[overlayId] || !!ARMOR_OVERLAYS[overlayId];
      expect(resolves, overlayId).toBe(true);
    }
  });

  it("maps every weapon and armor item in the catalog to an overlay", () => {
    for (const [itemId, def] of Object.entries(ITEM_REGISTRY)) {
      if (def.slot === "weapon" || def.slot === "armor") {
        expect(ITEM_OVERLAYS[itemId], itemId).toBeDefined();
      }
    }
  });

  it("references only real enemy weapon overlays", () => {
    for (const overlayId of Object.values(ENEMY_DEFAULT_WEAPON)) {
      expect(getWeaponOverlay(overlayId), overlayId).not.toBeNull();
    }
  });
});
