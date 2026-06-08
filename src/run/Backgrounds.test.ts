import { describe, it, expect } from "vitest";
import { applyBackground, applyBackgrounds } from "./Backgrounds.ts";
import { buildParty, createRunState, defaultPartySpecs } from "./PartySetup.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";
import { LEVELUP_PASSIVE_START_COMBAT_GUARDED } from "../data/levelups.ts";
import { NODE_REGISTRY } from "../data/nodes.ts";
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
  it("Caravan Guard applies Strength, a healing potion, and guarded-at-start", () => {
    const pm = hero({ backgroundId: "background.caravan_guard" });
    const run = runWith([pm]);

    applyBackground(pm, run);

    expect(pm.bonusStats.str).toBe(1);
    expect(run.inventory.potions).toEqual(["potion.healing"]);
    expect(pm.passives).toContain(LEVELUP_PASSIVE_START_COMBAT_GUARDED);
  });

  it("Hedge Scholar applies Intelligence, a starter item, and reveals two upcoming nodes", () => {
    const pm = hero({ backgroundId: "background.hedge_scholar" });
    const run = runWith([pm]);

    applyBackground(pm, run);

    expect(pm.bonusStats.int).toBe(1);
    expect(pm.equippedItemIds.weapon).toBe("item.apprentice_wand");
    expect(Object.keys(run.revealedForecasts ?? {})).toEqual(
      NODE_REGISTRY[run.mapState.currentNodeId].nextNodeIds.slice(0, 2),
    );
  });

  it("Cutpurse applies Dexterity, a starter item, and bonus gold", () => {
    const pm = hero({ backgroundId: "background.cutpurse" });
    const run = runWith([pm]);
    const before = run.gold;

    applyBackground(pm, run);

    expect(pm.bonusStats.dex).toBe(1);
    expect(pm.equippedItemIds.trinket).toBe("item.quickstep_buckle");
    expect(run.gold).toBe(before + 10);
    expect(run.inventory.gold).toBe(run.gold);
  });

  it("Merchant's Heir applies Armor, a starter item, and a shop discount modifier", () => {
    const pm = hero({ backgroundId: "background.merchants_heir" });
    const run = runWith([pm]);

    applyBackground(pm, run);

    expect(pm.bonusStats.armor).toBe(1);
    expect(pm.equippedItemIds.trinket).toBe("item.lucky_charm");
    expect(run.runModifiers).toContainEqual({ kind: "shop_discount", value: 0.1 });
  });

  it("Field Medic applies Wisdom, a healing potion, and an XP modifier", () => {
    const pm = hero({ backgroundId: "background.field_medic" });
    const run = runWith([pm]);

    applyBackground(pm, run);

    expect(pm.bonusStats.wis).toBe(1);
    expect(run.inventory.potions).toEqual(["potion.healing"]);
    expect(run.runModifiers).toContainEqual({ kind: "reward_xp_multiplier", value: 1.1 });
  });

  it("stashes a starter item when its slot is already filled", () => {
    const pm = hero({
      backgroundId: "background.hedge_scholar",
      equippedItemIds: { weapon: "item.iron_sword", armor: null, trinket: null },
    });
    const run = runWith([pm]);

    applyBackground(pm, run);

    expect(pm.equippedItemIds.weapon).toBe("item.iron_sword");
    expect(run.inventory.items).toEqual(["item.apprentice_wand"]);
  });

  it("stacks a stat bonus on top of any existing bonusStats", () => {
    const pm = hero({ backgroundId: "background.hedge_scholar", bonusStats: { int: 2 } });
    const run = runWith([pm]);
    applyBackground(pm, run);
    expect(pm.bonusStats.int).toBe(3);
  });

  it("does nothing for a hero with no background", () => {
    const pm = hero();
    const run = runWith([pm]);
    applyBackground(pm, run);
    expect(pm.bonusStats).toEqual({});
    expect(run.inventory.potions).toEqual([]);
    expect(run.runModifiers).toEqual([]);
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
      hero({ instanceId: "h1", backgroundId: "background.caravan_guard" }),
      hero({ instanceId: "h2", backgroundId: "background.cutpurse" }),
      hero({ instanceId: "h3", backgroundId: "background.field_medic" }),
    ];
    const run = runWith(party);
    const goldBefore = run.gold;

    applyBackgrounds(run);

    expect(party[0].bonusStats.str).toBe(1);
    expect(party[1].bonusStats.dex).toBe(1);
    expect(party[2].bonusStats.wis).toBe(1);
    expect(run.gold).toBe(goldBefore + 10);
    expect(run.inventory.potions).toEqual(["potion.healing", "potion.healing"]);
    expect(run.runModifiers).toContainEqual({ kind: "reward_xp_multiplier", value: 1.1 });
  });

  it("is deterministic: identical specs produce identical run effects", () => {
    const make = () => {
      const run = createRunState(buildParty(defaultPartySpecs()));
      applyBackgrounds(run);
      return run;
    };
    const a = make();
    const b = make();
    expect(a.gold).toBe(b.gold);
    expect(a.inventory.potions).toEqual(b.inventory.potions);
    expect(a.inventory.items).toEqual(b.inventory.items);
    expect(a.party.map((p) => p.bonusStats)).toEqual(b.party.map((p) => p.bonusStats));
    expect(a.runModifiers).toEqual(b.runModifiers);
    expect(a.revealedForecasts).toEqual(b.revealedForecasts);
  });
});

describe("statBonus background is visible to check stats (F23 consistency)", () => {
  const checkModifierFor = (pm: PartyMember, stat: "str" | "dex" | "wis" | "int"): number => {
    const base = CLASS_REGISTRY[pm.classId].baseStats[stat];
    return base + (pm.bonusStats[stat] ?? 0);
  };

  it("Cutpurse (+1 Dexterity) raises the dexterity check modifier and computed stat", () => {
    const pm = hero({ classId: "class.arcanist", backgroundId: "background.cutpurse" });
    const run = runWith([pm]);
    const before = checkModifierFor(pm, "dex");
    applyBackground(pm, run);
    expect(checkModifierFor(pm, "dex")).toBe(before + 1);

    const unit = {
      defId: pm.classId,
      stats: CLASS_REGISTRY[pm.classId].baseStats,
      equippedItemIds: pm.equippedItemIds,
      bonusStats: pm.bonusStats,
    } as Parameters<typeof computeStats>[0];
    expect(computeStats(unit).dex).toBe(CLASS_REGISTRY[pm.classId].baseStats.dex + 1);
  });

  it("Merchant's Heir (+1 Armor) raises computed armor without becoming a check stat", () => {
    const pm = hero({ classId: "class.guardian", backgroundId: "background.merchants_heir" });
    const run = runWith([pm]);
    applyBackground(pm, run);

    const unit = {
      defId: pm.classId,
      stats: CLASS_REGISTRY[pm.classId].baseStats,
      equippedItemIds: pm.equippedItemIds,
      bonusStats: pm.bonusStats,
    } as Parameters<typeof computeStats>[0];
    expect(computeStats(unit).armor).toBe(CLASS_REGISTRY[pm.classId].baseStats.armor + 1);
  });
});
