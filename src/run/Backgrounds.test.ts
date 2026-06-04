import { describe, it, expect } from "vitest";
import { applyBackground, applyBackgrounds } from "./Backgrounds.ts";
import { buildParty, createRunState, defaultPartySpecs } from "./PartySetup.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";
import { computeStats } from "../combat/Stats.ts";

function hero(overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    instanceId: "hero_001",
    classId: "class.guardian",
    displayName: "Test",
    level: 1,
    xp: 0,
    hp: 18,
    maxHp: 18,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    ...overrides,
  };
}

function runWith(party: PartyMember[]): RunState {
  return createRunState(party);
}

describe("applyBackground", () => {
  it("statBonus adds to the hero's bonusStats", () => {
    const pm = hero({ backgroundId: "background.caravan_guard" }); // +1 might
    const run = runWith([pm]);
    applyBackground(pm, run);
    expect(pm.bonusStats.might).toBe(1);
  });

  it("stacks a statBonus on top of any existing bonusStats", () => {
    const pm = hero({ backgroundId: "background.hedge_scholar", bonusStats: { spirit: 2 } }); // +1 spirit
    const run = runWith([pm]);
    applyBackground(pm, run);
    expect(pm.bonusStats.spirit).toBe(3);
  });

  it("gold adds to the run gold", () => {
    const pm = hero({ backgroundId: "background.merchants_heir" }); // +10 gold
    const run = runWith([pm]);
    const before = run.gold;
    applyBackground(pm, run);
    expect(run.gold).toBe(before + 10);
  });

  it("potion pushes the starter potion into the run inventory", () => {
    const pm = hero({ backgroundId: "background.field_medic" }); // 1 healing potion
    const run = runWith([pm]);
    applyBackground(pm, run);
    expect(run.inventory.potions).toEqual(["potion.healing"]);
  });

  it("does nothing for a hero with no background", () => {
    const pm = hero();
    const run = runWith([pm]);
    applyBackground(pm, run);
    expect(pm.bonusStats).toEqual({});
    expect(run.inventory.potions).toEqual([]);
  });

  it("does nothing for an unknown background id", () => {
    const pm = hero({ backgroundId: "background.nonexistent" });
    const run = runWith([pm]);
    applyBackground(pm, run);
    expect(pm.bonusStats).toEqual({});
    expect(run.gold).toBe(30);
  });
});

describe("applyBackgrounds", () => {
  it("applies each party member's background to the correct hero exactly once", () => {
    const party = [
      hero({ instanceId: "h1", backgroundId: "background.caravan_guard" }), // +1 might
      hero({ instanceId: "h2", backgroundId: "background.merchants_heir" }), // +10 gold
      hero({ instanceId: "h3", backgroundId: "background.field_medic" }), // 1 potion
    ];
    const run = runWith(party);
    const goldBefore = run.gold;

    applyBackgrounds(run);

    expect(party[0].bonusStats.might).toBe(1);
    expect(party[1].bonusStats).toEqual({});
    expect(run.gold).toBe(goldBefore + 10);
    expect(run.inventory.potions).toEqual(["potion.healing"]);
  });

  it("is deterministic — identical specs produce identical run effects", () => {
    const make = () => {
      const run = createRunState(buildParty(defaultPartySpecs()));
      applyBackgrounds(run);
      return run;
    };
    const a = make();
    const b = make();
    expect(a.gold).toBe(b.gold);
    expect(a.inventory.potions).toEqual(b.inventory.potions);
    expect(a.party.map((p) => p.bonusStats)).toEqual(b.party.map((p) => p.bonusStats));
  });
});

describe("statBonus background is visible to check stats (F23 consistency)", () => {
  // F23 reads a hero's check modifier as base stat + bonusStats — the same path computeStats
  // uses. A statBonus background must therefore raise that combined value.
  const checkModifierFor = (pm: PartyMember, stat: "might" | "agility" | "spirit"): number => {
    const base = CLASS_REGISTRY[pm.classId].baseStats[stat];
    return base + (pm.bonusStats[stat] ?? 0);
  };

  it("Cutpurse (+1 Agility) raises the agility check modifier and computed stat", () => {
    const pm = hero({ classId: "class.arcanist", backgroundId: "background.cutpurse" });
    const run = runWith([pm]);
    const before = checkModifierFor(pm, "agility");
    applyBackground(pm, run);
    expect(checkModifierFor(pm, "agility")).toBe(before + 1);

    const unit = {
      defId: pm.classId,
      stats: CLASS_REGISTRY[pm.classId].baseStats,
      equippedItemIds: pm.equippedItemIds,
      bonusStats: pm.bonusStats,
    } as Parameters<typeof computeStats>[0];
    expect(computeStats(unit).agility).toBe(CLASS_REGISTRY[pm.classId].baseStats.agility + 1);
  });
});
