import { describe, expect, it } from "vitest";
import {
  ATTUNEMENT_LIMIT,
  attunementCountFor,
  canEquipWithAttunement,
  requiresAttunement,
} from "./Attunement.ts";

type Equipped = { weapon: string | null; armor: string | null; trinket: string | null };

const empty = (): Equipped => ({ weapon: null, armor: null, trinket: null });

describe("requiresAttunement", () => {
  it("is true for an attuned magic item", () => {
    expect(requiresAttunement("item.runemark_blade")).toBe(true);
  });

  it("is false for a mundane item, null, and unknown ids", () => {
    expect(requiresAttunement("item.iron_sword")).toBe(false);
    expect(requiresAttunement(null)).toBe(false);
    expect(requiresAttunement(undefined)).toBe(false);
    expect(requiresAttunement("item.nonexistent")).toBe(false);
  });
});

describe("attunementCountFor", () => {
  it("counts only equipped items that require attunement", () => {
    const equipped: Equipped = {
      weapon: "item.runemark_blade",
      armor: "item.padded_armor",
      trinket: "item.quickstep_buckle",
    };
    expect(attunementCountFor(equipped)).toBe(2);
  });

  it("is zero for an empty loadout", () => {
    expect(attunementCountFor(empty())).toBe(0);
  });
});

describe("canEquipWithAttunement", () => {
  it("allows a non-attuned item even when at the attunement limit", () => {
    const equipped: Equipped = {
      weapon: "item.runemark_blade",
      armor: "item.ward_stitched_vest",
      trinket: null,
    };
    const check = canEquipWithAttunement(equipped, "item.soldier_badge");
    expect(check.ok).toBe(true);
    expect(check.current).toBe(2);
    expect(check.limit).toBe(ATTUNEMENT_LIMIT);
  });

  it("allows an attuned item when the hero has none attuned", () => {
    expect(canEquipWithAttunement(empty(), "item.runemark_blade").ok).toBe(true);
  });

  it("allows an attuned item when the hero has one attuned", () => {
    const equipped: Equipped = { weapon: "item.runemark_blade", armor: null, trinket: null };
    expect(canEquipWithAttunement(equipped, "item.quickstep_buckle").ok).toBe(true);
  });

  it("blocks an attuned item that replaces a non-attuned item while at the limit", () => {
    const equipped: Equipped = {
      weapon: "item.runemark_blade",
      armor: "item.ward_stitched_vest",
      trinket: "item.lucky_charm",
    };
    const check = canEquipWithAttunement(equipped, "item.quickstep_buckle");
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("2/2");
  });

  it("allows an attuned item that replaces another attuned item in the same slot", () => {
    const equipped: Equipped = {
      weapon: "item.runemark_blade",
      armor: null,
      trinket: "item.quickstep_buckle",
    };
    // At the limit (2 attuned), but replacing the attuned trinket with another is net-neutral.
    expect(canEquipWithAttunement(equipped, "item.lantern_moth_pin").ok).toBe(true);
  });

  it("rejects an unknown item", () => {
    const check = canEquipWithAttunement(empty(), "item.nonexistent");
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("Unknown item cannot be equipped.");
  });
});
