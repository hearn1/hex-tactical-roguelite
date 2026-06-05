import { describe, expect, it } from "vitest";
import { createRunState, defaultPartySpecs, buildParty } from "./PartySetup.ts";
import {
  SHORT_RESTS_PER_LONG_REST,
  applyLongRest,
  applyShortRest,
  ensureRunRestState,
  shortRestsRemaining,
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

  it("long rest gracefully recharges optional per-encounter use fields", () => {
    const run = freshRun() as ReturnType<typeof freshRun> & { perEncounterUses: Record<string, number> };
    run.perEncounterUses = { "action.test": 1 };

    const result = applyLongRest(run);

    expect(result.ok).toBe(true);
    expect(run.perEncounterUses).toEqual({});
    expect(result.hooksRecharged).toBe(true);
  });
});
