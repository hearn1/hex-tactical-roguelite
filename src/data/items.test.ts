import { describe, expect, it } from "vitest";
import { describeItem, describeItemShort, ITEM_REGISTRY } from "./items.ts";

describe("describeItem", () => {
  it("capitalizes rarity and includes Requires Attunement for attuned items", () => {
    const text = describeItem("item.runemark_blade");
    expect(text).toContain("Uncommon");
    expect(text).toContain("Requires Attunement");
  });

  it("omits attunement text for mundane items", () => {
    expect(describeItem("item.iron_sword")).not.toContain("Requires Attunement");
  });

  it("returns 'Unknown item' for an unregistered id", () => {
    expect(describeItem("item.nonexistent")).toBe("Unknown item");
  });
});

describe("describeItemShort", () => {
  it("includes Requires Attunement for attuned items", () => {
    expect(describeItemShort("item.quickstep_buckle")).toContain("Requires Attunement");
  });
});

describe("attunement data migration", () => {
  it("marks every hook-driven item as requiring attunement", () => {
    for (const def of Object.values(ITEM_REGISTRY)) {
      if (def.hook) {
        expect(def.requiresAttunement, `${def.id} has a hook but is not attuned`).toBe(true);
      }
    }
  });
});
