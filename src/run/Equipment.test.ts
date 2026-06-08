import { describe, expect, it } from "vitest";
import type { PartyMember } from "../state/RunState.ts";
import { createInventory } from "./Inventory.ts";
import {
  computePartyMemberStats,
  equipBagItemToPartyMember,
  previewEquipItem,
} from "./Equipment.ts";

function makeGuardian(): PartyMember {
  return {
    instanceId: "hero_001",
    classId: "class.guardian",
    displayName: "Mara",
    level: 1,
    xp: 0,
    hp: 18,
    maxHp: 18,
    bonusStats: {},
    equippedItemIds: { weapon: "item.iron_sword", armor: null, trinket: null },
  };
}

describe("equipment helpers", () => {
  it("equips a bag item to the matching slot and removes it from the bag", () => {
    const hero = makeGuardian();
    const inventory = createInventory();
    inventory.items.push("item.soldier_badge");

    const result = equipBagItemToPartyMember(hero, inventory, 0, "trinket");

    expect(result).toEqual({
      ok: true,
      itemId: "item.soldier_badge",
      replacedItemId: null,
    });
    expect(hero.equippedItemIds.trinket).toBe("item.soldier_badge");
    expect(inventory.items).toEqual([]);
  });

  it("returns replaced equipment to the bag", () => {
    const hero = makeGuardian();
    const inventory = createInventory();
    inventory.items.push("item.hunter_bow");

    const result = equipBagItemToPartyMember(hero, inventory, 0, "weapon");

    expect(result.ok).toBe(true);
    expect(result.replacedItemId).toBe("item.iron_sword");
    expect(hero.equippedItemIds.weapon).toBe("item.hunter_bow");
    expect(inventory.items).toEqual(["item.iron_sword"]);
  });

  it("rejects a slot mismatch without mutating equipment or bag", () => {
    const hero = makeGuardian();
    const inventory = createInventory();
    inventory.items.push("item.hunter_bow");

    const result = equipBagItemToPartyMember(hero, inventory, 0, "armor");

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("weapon");
    expect(hero.equippedItemIds.weapon).toBe("item.iron_sword");
    expect(hero.equippedItemIds.armor).toBeNull();
    expect(inventory.items).toEqual(["item.hunter_bow"]);
  });

  it("previews direct stat changes before equipment is changed", () => {
    const hero = makeGuardian();

    const preview = previewEquipItem(hero, "item.soldier_badge");

    expect(preview).not.toBeNull();
    expect(preview!.slot).toBe("trinket");
    expect(preview!.current.str).toBe(4);
    expect(preview!.next.str).toBe(5);
    expect(preview!.diff.str).toBe(1);
    expect(hero.equippedItemIds.trinket).toBeNull();
  });

  it("blocks an attuned item when the hero is already at the attunement limit", () => {
    const hero = makeGuardian();
    hero.equippedItemIds.weapon = "item.runemark_blade";
    hero.equippedItemIds.armor = "item.ward_stitched_vest";
    const inventory = createInventory();
    inventory.items.push("item.quickstep_buckle");

    const result = equipBagItemToPartyMember(hero, inventory, 0, "trinket");

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Mara");
    expect(result.reason).toContain("2/2");
    expect(hero.equippedItemIds.trinket).toBeNull();
    expect(inventory.items).toEqual(["item.quickstep_buckle"]);
  });

  it("allows an attuned item that replaces another attuned item in the same slot", () => {
    const hero = makeGuardian();
    hero.equippedItemIds.weapon = "item.runemark_blade";
    hero.equippedItemIds.trinket = "item.quickstep_buckle";
    const inventory = createInventory();
    inventory.items.push("item.lantern_moth_pin");

    const result = equipBagItemToPartyMember(hero, inventory, 0, "trinket");

    expect(result.ok).toBe(true);
    expect(result.replacedItemId).toBe("item.quickstep_buckle");
    expect(hero.equippedItemIds.trinket).toBe("item.lantern_moth_pin");
    expect(inventory.items).toEqual(["item.quickstep_buckle"]);
  });

  it("allows a non-attuned item even when at the attunement limit", () => {
    const hero = makeGuardian();
    hero.equippedItemIds.weapon = "item.runemark_blade";
    hero.equippedItemIds.armor = "item.ward_stitched_vest";
    const inventory = createInventory();
    inventory.items.push("item.soldier_badge");

    const result = equipBagItemToPartyMember(hero, inventory, 0, "trinket");

    expect(result.ok).toBe(true);
    expect(hero.equippedItemIds.trinket).toBe("item.soldier_badge");
  });

  it("computes class, item, and run bonus stats together", () => {
    const hero = makeGuardian();
    hero.bonusStats = { maxHp: 2, armor: 1 };
    hero.equippedItemIds.trinket = "item.wooden_shield";

    const stats = computePartyMemberStats(hero);

    expect(stats.maxHp).toBe(20);
    expect(stats.armor).toBe(16);
    expect(stats.str).toBe(4);
  });
});
