import { describe, it, expect } from "vitest";
import {
  resolveCheck,
  checkModifierFor,
  rollNeeded,
  pickBestHero,
  formatCheckLog,
} from "./AbilityCheck.ts";
import type { PartyMember } from "../state/RunState.ts";

/** rng stub that yields a fixed d20 face: `Math.floor(value * 20) + 1 === face`. */
const faceRng = (face: number) => () => (face - 1) / 20;

const makePm = (over: Partial<PartyMember> = {}): PartyMember => ({
  instanceId: "hero_001",
  classId: "class.guardian", // baseStats: might 3, agility 1, spirit 0
  displayName: "Mara",
  level: 1,
  xp: 0,
  hp: 18,
  maxHp: 18,
  bonusStats: {},
  equippedItemIds: { weapon: null, armor: null, trinket: null },
  ...over,
});

describe("resolveCheck", () => {
  it("computes total = roll + modifier and succeeds when total >= dc", () => {
    const r = resolveCheck("might", 3, 12, faceRng(10));
    expect(r.roll).toBe(10);
    expect(r.modifier).toBe(3);
    expect(r.total).toBe(13);
    expect(r.dc).toBe(12);
    expect(r.margin).toBe(1);
    expect(r.outcome).toBe("success");
  });

  it("fails when total < dc and no partial band is set", () => {
    const r = resolveCheck("might", 1, 15, faceRng(10));
    expect(r.total).toBe(11);
    expect(r.outcome).toBe("failure");
  });

  it("reports partial for a near-miss within partialWithin", () => {
    // total 13, dc 15 -> margin -2, band 3 -> partial
    const r = resolveCheck("agility", 3, 15, faceRng(10), 3);
    expect(r.margin).toBe(-2);
    expect(r.outcome).toBe("partial");
  });

  it("reports failure for the same roll when no band is given", () => {
    const r = resolveCheck("agility", 3, 15, faceRng(10));
    expect(r.outcome).toBe("failure");
  });

  it("a miss outside the band is still a failure", () => {
    // total 11, dc 15 -> margin -4, band 3 -> failure
    const r = resolveCheck("agility", 1, 15, faceRng(10), 3);
    expect(r.outcome).toBe("failure");
  });

  it("draws exactly one rng() per check", () => {
    let calls = 0;
    const rng = () => {
      calls++;
      return 0.5;
    };
    resolveCheck("might", 0, 10, rng, 3);
    expect(calls).toBe(1);
  });

  it("is fully reproducible from a fixed rng", () => {
    const a = resolveCheck("might", 2, 12, faceRng(14));
    const b = resolveCheck("might", 2, 12, faceRng(14));
    expect(a).toEqual(b);
  });
});

describe("checkModifierFor", () => {
  it("returns baseStats[stat] + bonusStats[stat]", () => {
    const pm = makePm({ bonusStats: { might: 2 } });
    expect(checkModifierFor(pm, "might")).toBe(3 + 2);
  });

  it("treats a missing bonus as 0", () => {
    const pm = makePm();
    expect(checkModifierFor(pm, "spirit")).toBe(0);
    expect(checkModifierFor(pm, "agility")).toBe(1);
  });
});

describe("rollNeeded", () => {
  it("returns dc - modifier", () => {
    expect(rollNeeded(3, 12)).toBe(9);
    expect(rollNeeded(-1, 12)).toBe(13);
  });
});

describe("pickBestHero", () => {
  it("picks the living hero with the highest modifier", () => {
    const guardian = makePm({ instanceId: "g", classId: "class.guardian" }); // might 3
    const arcanist = makePm({ instanceId: "a", classId: "class.arcanist", displayName: "Eldra" }); // might 0, spirit 4
    expect(pickBestHero([guardian, arcanist], "might")?.instanceId).toBe("g");
    expect(pickBestHero([guardian, arcanist], "spirit")?.instanceId).toBe("a");
  });

  it("ignores downed heroes and returns null when all are down", () => {
    const downed = makePm({ hp: 0 });
    expect(pickBestHero([downed], "might")).toBeNull();
  });
});

describe("formatCheckLog", () => {
  it("reports roll, modifier, total, DC, and outcome in one line", () => {
    const r = resolveCheck("agility", 2, 12, faceRng(14));
    const line = formatCheckLog("Mara", r);
    expect(line).toBe("Mara's Agility check: d20 14 +2 = 16 vs DC 12 — Success.");
  });

  it("labels a partial result", () => {
    const r = resolveCheck("agility", 0, 12, faceRng(10), 3);
    expect(formatCheckLog("Mara", r)).toContain("Partial success");
  });
});
