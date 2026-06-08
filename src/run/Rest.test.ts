import { describe, expect, it } from "vitest";
import { createRunState, defaultPartySpecs, buildParty } from "./PartySetup.ts";
import {
  SHORT_RESTS_PER_LONG_REST,
  applyLongRest,
  applyShortRest,
  ensureRunRestState,
  shortRestsRemaining,
  isPartyMemberAlive,
  canPartyMemberBeHealed,
  canPartyMemberRest,
  canPartyMemberEnterCombat,
} from "./Rest.ts";

function freshRun() {
  return createRunState(buildParty(defaultPartySpecs()), "normal", "short");
}

describe("rest mechanics", () => {
  it("initializes hit dice and camp supplies on new runs", () => {
    const run = freshRun();

    expect(run.campSupplies).toBe(3);
    expect(run.shortRestsSinceLongRest).toBe(0);
    expect(run.party.map((p) => p.hitDieSize)).toEqual([10, 8, 6]);
    expect(run.party.every((p) => p.hitDiceTotal === 1 && p.hitDiceRemaining === 1)).toBe(true);
  });

  it("short rest spends up to half total hit dice and clamps healing", () => {
    const run = freshRun();
    const guardian = run.party[0];
    guardian.level = 3;
    guardian.hitDiceTotal = 3;
    guardian.hitDiceRemaining = 3;
    guardian.hp = 1;

    const result = applyShortRest(run, () => 0);

    expect(result.ok).toBe(true);
    expect(guardian.hp).toBe(3);
    expect(guardian.hitDiceRemaining).toBe(1);
    expect(result.heroes[0].diceSpent).toBe(2);
    expect(result.heroes[0].rolls).toEqual([1, 1]);
    expect(run.shortRestsSinceLongRest).toBe(1);
  });

  it("short rest can use a future CON modifier field when present", () => {
    const run = freshRun();
    const guardian = run.party[0] as typeof run.party[number] & { conMod: number };
    guardian.hp = 1;
    guardian.conMod = 2;

    applyShortRest(run, () => 0);

    expect(guardian.hp).toBe(4);
  });

  it("blocks short rests after two since the last long rest", () => {
    const run = freshRun();
    run.shortRestsSinceLongRest = SHORT_RESTS_PER_LONG_REST;
    run.party[0].hp = 1;

    const result = applyShortRest(run, () => 0);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("No Short Rests remain");
    expect(shortRestsRemaining(run)).toBe(0);
  });

  it("long rest blocks when camp supplies are insufficient", () => {
    const run = freshRun();
    run.campSupplies = run.party.length - 1;
    run.party[0].hp = 1;

    const result = applyLongRest(run);

    expect(result.ok).toBe(false);
    expect(run.party[0].hp).toBe(1);
    expect(run.campSupplies).toBe(run.party.length - 1);
  });

  it("long rest consumes supplies, full heals, restores hit dice, and resets short rests", () => {
    const run = freshRun();
    ensureRunRestState(run);
    run.campSupplies = 5;
    run.shortRestsSinceLongRest = 2;
    run.party[0].hp = 1;
    run.party[0].hitDiceRemaining = 0;

    const result = applyLongRest(run);

    expect(result.ok).toBe(true);
    expect(run.campSupplies).toBe(2);
    expect(run.shortRestsSinceLongRest).toBe(0);
    expect(run.party[0].hp).toBe(run.party[0].maxHp);
    expect(run.party[0].hitDiceRemaining).toBe(run.party[0].hitDiceTotal);
  });

  it("initializes spell slots from class on new runs (#118)", () => {
    const run = freshRun();
    // defaultPartySpecs order: guardian, acolyte, arcanist.
    expect(run.party.map((p) => p.spellSlotsMax)).toEqual([0, 2, 2]);
    expect(run.party.map((p) => p.spellSlotsRemaining)).toEqual([0, 2, 2]);
  });

  it("long rest restores spent spell slots to max (#118)", () => {
    const run = freshRun();
    run.campSupplies = 5;
    const acolyte = run.party[1];
    acolyte.spellSlotsRemaining = 0;

    const result = applyLongRest(run);

    expect(result.ok).toBe(true);
    expect(acolyte.spellSlotsRemaining).toBe(acolyte.spellSlotsMax);
    expect(acolyte.spellSlotsRemaining).toBe(2);
  });

  it("long rest gracefully recharges optional per-encounter use fields", () => {
    const run = freshRun() as ReturnType<typeof freshRun> & { perEncounterUses: Record<string, number> };
    run.perEncounterUses = { "action.test": 1 };

    const result = applyLongRest(run);

    expect(result.ok).toBe(true);
    expect(run.perEncounterUses).toEqual({});
    expect(result.hooksRecharged).toBe(true);
  });

  it("long rest does not restore a dead-for-run hero (#143)", () => {
    const run = freshRun();
    ensureRunRestState(run);
    run.campSupplies = 5;
    const dead = run.party[0];
    dead.hp = 0;
    dead.deadForRun = true;

    const result = applyLongRest(run);

    expect(result.ok).toBe(true);
    expect(dead.hp).toBe(0);
    expect(dead.deadForRun).toBe(true);
    expect(result.heroes.find((h) => h.instanceId === dead.instanceId)).toBeUndefined();
  });

  it("long rest cost counts only living heroes (#143)", () => {
    const run = freshRun();
    ensureRunRestState(run);
    run.campSupplies = 2;
    run.party[0].hp = 0;
    run.party[0].deadForRun = true;
    // 2 living heroes remain; cost should be 2

    const result = applyLongRest(run);

    expect(result.ok).toBe(true);
    expect(run.campSupplies).toBe(0);
  });

  it("short rest does not restore a dead-for-run hero (#143)", () => {
    const run = freshRun();
    ensureRunRestState(run);
    const dead = run.party[0];
    dead.hp = 0;
    dead.deadForRun = true;
    dead.hitDiceRemaining = 3;
    // living hero is wounded so short rest can proceed
    run.party[1].hp = 1;

    const result = applyShortRest(run, () => 0.5);

    expect(result.ok).toBe(true);
    expect(dead.hp).toBe(0);
    expect(dead.deadForRun).toBe(true);
    expect(result.heroes.find((h) => h.instanceId === dead.instanceId)).toBeUndefined();
  });
});

describe("party member life-state helpers (#143)", () => {
  it("isPartyMemberAlive returns false for deadForRun heroes", () => {
    const run = freshRun();
    run.party[0].deadForRun = true;
    expect(isPartyMemberAlive(run.party[0])).toBe(false);
    expect(isPartyMemberAlive(run.party[1])).toBe(true);
  });

  it("canPartyMemberBeHealed returns false for deadForRun heroes", () => {
    const run = freshRun();
    run.party[0].deadForRun = true;
    expect(canPartyMemberBeHealed(run.party[0])).toBe(false);
    expect(canPartyMemberBeHealed(run.party[1])).toBe(true);
  });

  it("canPartyMemberRest returns false for deadForRun heroes", () => {
    const run = freshRun();
    run.party[0].deadForRun = true;
    expect(canPartyMemberRest(run.party[0])).toBe(false);
    expect(canPartyMemberRest(run.party[1])).toBe(true);
  });

  it("canPartyMemberEnterCombat returns false for deadForRun heroes", () => {
    const run = freshRun();
    run.party[0].deadForRun = true;
    expect(canPartyMemberEnterCombat(run.party[0])).toBe(false);
    expect(canPartyMemberEnterCombat(run.party[1])).toBe(true);
  });
});
