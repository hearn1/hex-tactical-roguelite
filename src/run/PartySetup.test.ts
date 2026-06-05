import { describe, it, expect } from "vitest";
import {
  RUN_SETUP_PARTY_SIZE,
  defaultPartySpecs,
  validatePartySetup,
  buildParty,
  createRunState,
} from "./PartySetup.ts";
import type { PartySpec } from "./PartySetup.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";
import { createDefaultAbilityScores } from "../data/abilities.ts";

const scores = () => createDefaultAbilityScores();

describe("defaultPartySpecs", () => {
  it("produces exactly RUN_SETUP_PARTY_SIZE specs with valid classes and names", () => {
    const specs = defaultPartySpecs();
    expect(specs).toHaveLength(RUN_SETUP_PARTY_SIZE);
    expect(validatePartySetup(specs).ok).toBe(true);
  });
});

describe("validatePartySetup", () => {
  const valid = (): PartySpec[] => [
    { classId: "class.guardian", name: "Mara", abilityScores: scores() },
    { classId: "class.acolyte", name: "Sable", abilityScores: scores() },
    { classId: "class.arcanist", name: "Eldra", abilityScores: scores() },
  ];

  it("accepts a full valid party", () => {
    const v = validatePartySetup(valid());
    expect(v.ok).toBe(true);
    expect(v.reason).toBeNull();
    expect(v.slotErrors.every((e) => e === null)).toBe(true);
  });

  it("accepts duplicate classes", () => {
    const specs: PartySpec[] = [
      { classId: "class.guardian", name: "Mara", abilityScores: scores() },
      { classId: "class.guardian", name: "Bran", abilityScores: scores() },
      { classId: "class.arcanist", name: "Eldra", abilityScores: scores() },
    ];
    expect(validatePartySetup(specs).ok).toBe(true);
  });

  it("accepts duplicate names", () => {
    const specs = valid();
    specs[1].name = "Mara";
    expect(validatePartySetup(specs).ok).toBe(true);
  });

  it("rejects an empty name with a slot-level reason", () => {
    const specs = valid();
    specs[2].name = "   ";
    const v = validatePartySetup(specs);
    expect(v.ok).toBe(false);
    expect(v.slotErrors[2]).toBe("Name cannot be empty.");
    expect(v.reason).toBe("Name cannot be empty.");
  });

  it("rejects an unknown/empty class slot", () => {
    const specs = valid();
    specs[0].classId = "";
    const v = validatePartySetup(specs);
    expect(v.ok).toBe(false);
    expect(v.slotErrors[0]).toBe("Choose a class.");
  });

  it("rejects an unassigned ability score set", () => {
    const specs = valid();
    specs[1].abilityScores = undefined;
    const v = validatePartySetup(specs);
    expect(v.ok).toBe(false);
    expect(v.slotErrors[1]).toBe("Assign all six ability scores.");
  });

  it("rejects the wrong party size", () => {
    const specs = valid().slice(0, 2);
    const v = validatePartySetup(specs);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain(`${RUN_SETUP_PARTY_SIZE}`);
  });
});

describe("buildParty", () => {
  it("builds heroes matching the legacy default party shape", () => {
    const party = buildParty(defaultPartySpecs());
    expect(party).toHaveLength(RUN_SETUP_PARTY_SIZE);
    const guardian = party[0];
    expect(guardian.classId).toBe("class.guardian");
    expect(guardian.displayName).toBe("Mara");
    expect(guardian.level).toBe(1);
    expect(guardian.xp).toBe(0);
    expect(guardian.hp).toBe(guardian.maxHp);
    expect(guardian.maxHp).toBe(18);
    expect(guardian.hitDieSize).toBe(10);
    expect(guardian.hitDiceTotal).toBe(1);
    expect(guardian.hitDiceRemaining).toBe(1);
    expect(guardian.bonusStats).toEqual({});
    expect(guardian.abilityScores).toEqual(createDefaultAbilityScores());
    // Guardian auto-equips iron sword (weapon) and wooden shield (trinket).
    expect(guardian.equippedItemIds.weapon).toBe("item.iron_sword");
    expect(guardian.equippedItemIds.trinket).toBe("item.wooden_shield");
    expect(guardian.equippedItemIds.armor).toBeNull();
  });

  it("trims hero names", () => {
    const party = buildParty([
      { classId: "class.guardian", name: "  Knight  " },
      { classId: "class.acolyte", name: "Sable" },
      { classId: "class.arcanist", name: "Eldra" },
    ]);
    expect(party[0].displayName).toBe("Knight");
  });

  it("gives duplicate-class heroes distinct instance ids", () => {
    const party = buildParty([
      { classId: "class.guardian", name: "A" },
      { classId: "class.guardian", name: "B" },
      { classId: "class.guardian", name: "C" },
    ]);
    const ids = new Set(party.map((p) => p.instanceId));
    expect(ids.size).toBe(3);
  });

  it("stores the chosen background id on the hero", () => {
    const party = buildParty([
      { classId: "class.guardian", name: "A", backgroundId: "background.cutpurse", abilityScores: scores() },
      { classId: "class.acolyte", name: "B", abilityScores: scores() },
      { classId: "class.arcanist", name: "C", backgroundId: null, abilityScores: scores() },
    ]);
    expect(party[0].backgroundId).toBe("background.cutpurse");
    expect(party[1].backgroundId).toBeUndefined();
    expect(party[2].backgroundId).toBeUndefined();
  });

  it("carries custom ability scores and applies CON to starting max HP", () => {
    const customScores = { str: 16, dex: 14, con: 14, int: 10, wis: 8, cha: 12 };
    const party = buildParty([
      { classId: "class.guardian", name: "A", abilityScores: customScores },
      { classId: "class.acolyte", name: "B", abilityScores: scores() },
      { classId: "class.arcanist", name: "C", abilityScores: scores() },
    ]);
    expect(party[0].abilityScores).toEqual(customScores);
    expect(party[0].maxHp).toBe(20);
    expect(party[0].hp).toBe(20);
  });
});

describe("defaultPartySpecs backgrounds", () => {
  it("seeds each slot with its class-default background", () => {
    const specs = defaultPartySpecs();
    for (const spec of specs) {
      expect(spec.backgroundId).toBe(CLASS_REGISTRY[spec.classId].defaultBackgroundId);
    }
  });

  it("seeds each slot with all-10 ability scores", () => {
    const specs = defaultPartySpecs();
    for (const spec of specs) {
      expect(spec.abilityScores).toEqual(createDefaultAbilityScores());
    }
  });

  it("builds a Quick Start party with class-default backgrounds assigned", () => {
    const party = buildParty(defaultPartySpecs());
    expect(party.every((p) => typeof p.backgroundId === "string")).toBe(true);
  });
});

describe("createRunState", () => {
  it("wraps a party in a fresh active run on the default (long) template", () => {
    const party = buildParty(defaultPartySpecs());
    const run = createRunState(party, "hard");
    expect(run.party).toBe(party);
    expect(run.difficulty).toBe("hard");
    expect(run.runStatus).toBe("active");
    expect(run.gold).toBe(30);
    expect(run.campSupplies).toBe(3);
    expect(run.shortRestsSinceLongRest).toBe(0);
    expect(run.mapTemplateId).toBe("long");
    expect(run.mapState.currentNodeId).toBe("node.long_start");
    expect(run.mapState.visitedNodeIds).toEqual(["node.long_start"]);
    expect(run.campStates).toEqual({});
  });

  it("can start a run on the short prototype template", () => {
    const run = createRunState(buildParty(defaultPartySpecs()), "normal", "short");
    expect(run.mapTemplateId).toBe("short");
    expect(run.mapState.currentNodeId).toBe("node.start");
  });

  it("defaults difficulty to normal", () => {
    const run = createRunState(buildParty(defaultPartySpecs()));
    expect(run.difficulty).toBe("normal");
  });
});
