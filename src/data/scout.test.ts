import { describe, it, expect } from "vitest";
import { CLASS_REGISTRY, HERO_DEFAULT_NAMES } from "./classes.ts";
import { ACTION_REGISTRY } from "./actions.ts";
import { ITEM_REGISTRY } from "./items.ts";
import { DataRepository } from "./DataRepository.ts";

describe("scout class (#119)", () => {
  const scout = CLASS_REGISTRY["class.scout"];

  it("registers an agility-based scout with a default hero name", () => {
    expect(scout).toBeDefined();
    expect(scout.baseStats.agility).toBeGreaterThanOrEqual(scout.baseStats.might);
    expect(HERO_DEFAULT_NAMES["class.scout"]).toBe("Nyx");
  });

  it("is squishier and faster than the Guardian", () => {
    const guardian = CLASS_REGISTRY["class.guardian"];
    expect(scout.baseStats.maxHp).toBeLessThan(guardian.baseStats.maxHp);
    expect(scout.baseStats.move).toBeGreaterThan(guardian.baseStats.move);
  });

  it("has at least three starter actions, all resolving and agility-driven for its attacks", () => {
    expect(scout.actionIds.length).toBeGreaterThanOrEqual(3);
    for (const id of scout.actionIds) {
      expect(ACTION_REGISTRY[id], id).toBeDefined();
    }
    const stab = ACTION_REGISTRY["action.precise_stab"];
    const shot = ACTION_REGISTRY["action.shortbow_shot"];
    expect(stab.accuracyStat).toBe("agility");
    expect(stab.range).toBe(1);
    expect(shot.accuracyStat).toBe("agility");
    expect(shot.range).toBeGreaterThan(1);
  });

  it("grants a self-buff mobility option usable a limited number of times", () => {
    const step = ACTION_REGISTRY["action.cunning_step"];
    expect(step.targetType).toBe("self");
    expect(step.charges).toBe(1);
    expect(step.effect).toEqual({ type: "applyCondition", conditionId: "hasted", duration: 1 });
  });

  it("resolves its starting items through the registry", () => {
    expect(scout.startingItems.length).toBeGreaterThan(0);
    for (const id of scout.startingItems) {
      expect(ITEM_REGISTRY[id], id).toBeDefined();
    }
  });

  it("keeps the full data registry valid", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const report = repo.validate();
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });
});
