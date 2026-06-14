import { describe, it, expect } from "vitest";
import {
  computeActionChargeBonuses,
  getFastMovementBonus,
  getDraconicResilienceBonus,
  getBeaconSaveBonus,
  getBrutalCriticalExtraDamage,
  getColossusSlayerBonus,
  getFirstAttackBonusDice,
  getSpellDamageStatBonus,
  getOnKillHpGain,
  getDreadAmbusherInitiativeBonus,
  hasAllResistanceWhileRaged,
} from "./Passives.ts";
import { computeStats } from "./Stats.ts";
import { chargesRemaining } from "./ActionBar.ts";
import type { UnitInstance, CombatState, Hex } from "../state/types.ts";

function makeStats(overrides: Partial<UnitInstance["stats"]> = {}): UnitInstance["stats"] {
  return { maxHp: 20, armor: 12, move: 3, str: 0, dex: 0, con: 0, int: 3, wis: 1, cha: 2, ...overrides };
}

function makeUnit(overrides: Partial<UnitInstance> & { instanceId: string }): UnitInstance {
  return {
    defId: "class.guardian",
    displayName: "Test",
    team: "hero",
    level: 1,
    xp: 0,
    stats: makeStats(),
    hp: 20,
    pos: { q: 0, r: 0 } as Hex,
    conditions: [],
    movePointsRemaining: 3,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    passives: [],
    ...overrides,
  };
}

function makeState(units: UnitInstance[], perEncounterUses: Record<string, number> = {}): CombatState {
  return {
    round: 1,
    activeIndex: 0,
    turnQueue: units.map((u) => u.instanceId),
    units,
    log: [],
    status: "active",
    gridKeys: [],
    targetingActionId: null,
    perEncounterUses,
    traitState: { triggered: {} },
  };
}

const seededRng = (value: number) => () => value;

// ── #536: actionChargeBonus ──────────────────────────────────────────────────

describe("#536 actionChargeBonus passive", () => {
  it("computeActionChargeBonuses sums bonus charges per action across heroes", () => {
    const hero = makeUnit({
      instanceId: "h1",
      passives: ["passive.cleric.improved_channel"],
    });
    const bonuses = computeActionChargeBonuses([hero]);
    expect(bonuses["action.cleric.channel_divinity"]).toBe(1);
  });

  it("chargesRemaining adds perEncounterChargeBonus to base charges", () => {
    const remaining = chargesRemaining(
      "action.cleric.channel_divinity",
      { "action.cleric.channel_divinity": 1 },
      { "action.cleric.channel_divinity": 1 },
    );
    expect(remaining).toBe(1);
  });

  it("chargesRemaining with zero uses and no bonus matches base charges", () => {
    const remaining = chargesRemaining("action.cleric.channel_divinity", {}, {});
    expect(remaining).not.toBeNull();
    expect(remaining! >= 1).toBe(true);
  });
});

// ── #537: fastMovement ───────────────────────────────────────────────────────

describe("#537 fastMovement passive", () => {
  it("getFastMovementBonus returns bonus from passive", () => {
    const unit = makeUnit({ instanceId: "h1", passives: ["passive.barbarian.fast_movement"] });
    expect(getFastMovementBonus(unit)).toBe(1);
  });

  it("computeStats applies fastMovement bonus to move speed", () => {
    const unit = makeUnit({
      instanceId: "h1",
      passives: ["passive.barbarian.fast_movement"],
      defId: "class.berserker",
    });
    const baseStats = computeStats({ ...unit, passives: [] });
    const boostedStats = computeStats(unit);
    expect(boostedStats.move).toBe(baseStats.move + 1);
  });

  it("getFastMovementBonus returns 0 with no passive", () => {
    const unit = makeUnit({ instanceId: "h1" });
    expect(getFastMovementBonus(unit)).toBe(0);
  });
});

// ── #544a: draconicResilience ────────────────────────────────────────────────

describe("#544 draconicResilience passive", () => {
  it("getDraconicResilienceBonus returns 1 when passive present", () => {
    const unit = makeUnit({ instanceId: "h1", passives: ["passive.sorcerer.draconic_resilience"] });
    expect(getDraconicResilienceBonus(unit)).toBe(1);
  });

  it("getDraconicResilienceBonus returns 0 with no passive", () => {
    const unit = makeUnit({ instanceId: "h1" });
    expect(getDraconicResilienceBonus(unit)).toBe(0);
  });

  it("computeStats applies draconicResilience as +1 armor", () => {
    const unit = makeUnit({
      instanceId: "h1",
      passives: ["passive.sorcerer.draconic_resilience"],
      defId: "class.sorcerer",
    });
    const base = computeStats({ ...unit, passives: [] });
    const boosted = computeStats(unit);
    expect(boosted.armor).toBe(base.armor + 1);
  });
});

// ── #543: auraOfProtection ───────────────────────────────────────────────────

describe("#543 auraOfProtection passive", () => {
  it("getBeaconSaveBonus adds paladin CHA to nearby hero saves", () => {
    const paladin = makeUnit({
      instanceId: "p1",
      passives: ["passive.paladin.aura_of_protection"],
      stats: makeStats({ cha: 3 }),
      pos: { q: 0, r: 0 },
    });
    const ally = makeUnit({ instanceId: "h2", pos: { q: 1, r: 0 } });
    const state = makeState([paladin, ally]);
    expect(getBeaconSaveBonus(ally, state)).toBe(3);
  });

  it("getBeaconSaveBonus does not apply outside radius", () => {
    const paladin = makeUnit({
      instanceId: "p1",
      passives: ["passive.paladin.aura_of_protection"],
      stats: makeStats({ cha: 3 }),
      pos: { q: 0, r: 0 },
    });
    const farAlly = makeUnit({ instanceId: "h2", pos: { q: 5, r: 0 } });
    const state = makeState([paladin, farAlly]);
    expect(getBeaconSaveBonus(farAlly, state)).toBe(0);
  });

  it("getBeaconSaveBonus does not apply to enemies", () => {
    const paladin = makeUnit({
      instanceId: "p1",
      passives: ["passive.paladin.aura_of_protection"],
      stats: makeStats({ cha: 3 }),
      pos: { q: 0, r: 0 },
    });
    const enemy = makeUnit({ instanceId: "e1", team: "enemy", pos: { q: 1, r: 0 } });
    const state = makeState([paladin, enemy]);
    expect(getBeaconSaveBonus(enemy, state)).toBe(0);
  });
});

// ── #538a: brutalCritical ────────────────────────────────────────────────────

describe("#538 brutalCritical passive", () => {
  it("getBrutalCriticalExtraDamage returns 1–6 when passive present", () => {
    const unit = makeUnit({ instanceId: "h1", passives: ["passive.barbarian.brutal_critical"] });
    const dmg = getBrutalCriticalExtraDamage(unit, seededRng(0.5));
    expect(dmg).toBeGreaterThanOrEqual(1);
    expect(dmg).toBeLessThanOrEqual(6);
  });

  it("getBrutalCriticalExtraDamage returns 0 without passive", () => {
    const unit = makeUnit({ instanceId: "h1" });
    expect(getBrutalCriticalExtraDamage(unit, seededRng(0.5))).toBe(0);
  });
});

// ── #538b: colossusSlayer ────────────────────────────────────────────────────

describe("#538 colossusSlayer passive", () => {
  it("getColossusSlayerBonus returns 1–8 against wounded target", () => {
    const attacker = makeUnit({ instanceId: "h1", passives: ["passive.ranger.colossus_slayer"] });
    const target = makeUnit({ instanceId: "e1", team: "enemy", hp: 5, stats: makeStats({ maxHp: 20 }) });
    const state = makeState([attacker, target]);
    const bonus = getColossusSlayerBonus(attacker, target, state, seededRng(0.5));
    expect(bonus).toBeGreaterThanOrEqual(1);
    expect(bonus).toBeLessThanOrEqual(8);
  });

  it("getColossusSlayerBonus returns 0 against full-HP target", () => {
    const attacker = makeUnit({ instanceId: "h1", passives: ["passive.ranger.colossus_slayer"] });
    const target = makeUnit({ instanceId: "e1", team: "enemy", hp: 20, stats: makeStats({ maxHp: 20 }) });
    const state = makeState([attacker, target]);
    expect(getColossusSlayerBonus(attacker, target, state, seededRng(0.5))).toBe(0);
  });

  it("getColossusSlayerBonus fires only once per round", () => {
    const attacker = makeUnit({ instanceId: "h1", passives: ["passive.ranger.colossus_slayer"] });
    const target = makeUnit({ instanceId: "e1", team: "enemy", hp: 5, stats: makeStats({ maxHp: 20 }) });
    const state = makeState([attacker, target]);
    const first = getColossusSlayerBonus(attacker, target, state, seededRng(0.5));
    const second = getColossusSlayerBonus(attacker, target, state, seededRng(0.5));
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
  });
});

// ── #538c: firstAttackBonusDice (Assassinate) ───────────────────────────────

describe("#538 firstAttackBonusDice passive (Assassinate)", () => {
  it("getFirstAttackBonusDice returns bonus on first attack vs full-HP target", () => {
    const attacker = makeUnit({ instanceId: "h1", passives: ["passive.rogue.assassinate"] });
    const target = makeUnit({ instanceId: "e1", team: "enemy", hp: 20, stats: makeStats({ maxHp: 20 }) });
    const state = makeState([attacker, target]);
    const bonus = getFirstAttackBonusDice(attacker, target, state, seededRng(0.9));
    expect(bonus).toBeGreaterThanOrEqual(2);
    expect(bonus).toBeLessThanOrEqual(12);
  });

  it("getFirstAttackBonusDice returns 0 on second attack (per-encounter)", () => {
    const attacker = makeUnit({ instanceId: "h1", passives: ["passive.rogue.assassinate"] });
    const target = makeUnit({ instanceId: "e1", team: "enemy", hp: 20, stats: makeStats({ maxHp: 20 }) });
    const state = makeState([attacker, target]);
    getFirstAttackBonusDice(attacker, target, state, seededRng(0.9));
    const second = getFirstAttackBonusDice(attacker, target, state, seededRng(0.9));
    expect(second).toBe(0);
  });

  it("getFirstAttackBonusDice returns 0 vs non-full-HP target", () => {
    const attacker = makeUnit({ instanceId: "h1", passives: ["passive.rogue.assassinate"] });
    const target = makeUnit({ instanceId: "e1", team: "enemy", hp: 5, stats: makeStats({ maxHp: 20 }) });
    const state = makeState([attacker, target]);
    expect(getFirstAttackBonusDice(attacker, target, state, seededRng(0.9))).toBe(0);
  });
});

// ── #544b: elementalAffinity / #546: empoweredEvocation ─────────────────────

describe("#544/#546 spell damage stat bonus passives", () => {
  it("getSpellDamageStatBonus returns INT from empoweredEvocation", () => {
    const unit = makeUnit({
      instanceId: "h1",
      passives: ["passive.wizard.empowered_evocation"],
      stats: makeStats({ int: 4 }),
    });
    expect(getSpellDamageStatBonus(unit)).toBe(4);
  });

  it("getSpellDamageStatBonus returns CHA from elementalAffinity", () => {
    const unit = makeUnit({
      instanceId: "h1",
      passives: ["passive.sorcerer.elemental_affinity"],
      stats: makeStats({ cha: 3 }),
    });
    expect(getSpellDamageStatBonus(unit)).toBe(3);
  });

  it("getSpellDamageStatBonus returns 0 with no passives", () => {
    const unit = makeUnit({ instanceId: "h1" });
    expect(getSpellDamageStatBonus(unit)).toBe(0);
  });
});

// ── #541: onKillTempHp (Dark One's Blessing) ────────────────────────────────

describe("#541 onKillTempHp passive (Dark One's Blessing)", () => {
  it("getOnKillHpGain returns at least 1 when passive present", () => {
    const unit = makeUnit({
      instanceId: "h1",
      passives: ["passive.warlock.dark_ones_blessing"],
      stats: makeStats({ cha: 3 }),
    });
    expect(getOnKillHpGain(unit)).toBe(3);
  });

  it("getOnKillHpGain returns minimum 1 when stat is 0 or negative", () => {
    const unit = makeUnit({
      instanceId: "h1",
      passives: ["passive.warlock.dark_ones_blessing"],
      stats: makeStats({ cha: -1 }),
    });
    expect(getOnKillHpGain(unit)).toBe(1);
  });

  it("getOnKillHpGain returns 0 without passive", () => {
    const unit = makeUnit({ instanceId: "h1" });
    expect(getOnKillHpGain(unit)).toBe(0);
  });
});

// ── #547: dreadAmbusher initiative bonus ─────────────────────────────────────

describe("#547 dreadAmbusher passive (initiative bonus)", () => {
  it("getDreadAmbusherInitiativeBonus returns bonus when passive present", () => {
    const unit = makeUnit({ instanceId: "h1", passives: ["passive.ranger.dread_ambusher"] });
    expect(getDreadAmbusherInitiativeBonus(unit)).toBe(1);
  });

  it("getDreadAmbusherInitiativeBonus returns 0 without passive", () => {
    const unit = makeUnit({ instanceId: "h1" });
    expect(getDreadAmbusherInitiativeBonus(unit)).toBe(0);
  });
});

// ── #542: resistance while raged (Bear Totem) ───────────────────────────────

describe("#542 resistance passive (Bear Totem while raged)", () => {
  it("hasAllResistanceWhileRaged returns true when raged and has all-resistance passive", () => {
    const unit = makeUnit({
      instanceId: "h1",
      passives: ["passive.barbarian.bear_totem"],
      conditions: [{ id: "raged", duration: 3 }] as UnitInstance["conditions"],
    });
    expect(hasAllResistanceWhileRaged(unit)).toBe(true);
  });

  it("hasAllResistanceWhileRaged returns false when not raged", () => {
    const unit = makeUnit({
      instanceId: "h1",
      passives: ["passive.barbarian.bear_totem"],
      conditions: [],
    });
    expect(hasAllResistanceWhileRaged(unit)).toBe(false);
  });

  it("hasAllResistanceWhileRaged returns false without bear totem passive", () => {
    const unit = makeUnit({
      instanceId: "h1",
      passives: [],
      conditions: [{ id: "raged", duration: 3 }] as UnitInstance["conditions"],
    });
    expect(hasAllResistanceWhileRaged(unit)).toBe(false);
  });
});
