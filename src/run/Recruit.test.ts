import { describe, it, expect } from "vitest";
import { generateRecruitCandidates, addRecruitToParty, createPackMuleModifier } from "./Recruit.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";
import { createRng } from "../core/rng.ts";
import { createInventory } from "./Inventory.ts";
import type { CombatReward } from "./RewardManager.ts";
import { applyGoldModifiers } from "./RewardManager.ts";

const makeParty = (size: number): PartyMember[] => {
  const party: PartyMember[] = [];
  const classIds = ["class.guardian", "class.acolyte", "class.arcanist"];
  for (let i = 0; i < size; i++) {
    party.push({
      instanceId: `hero_00${i + 1}`,
      classId: classIds[i % 3],
      displayName: `Hero ${i + 1}`,
      level: 1,
      xp: 0,
      hp: 10,
      maxHp: 10,
      bonusStats: {},
      equippedItemIds: { weapon: null, armor: null, trinket: null },
    });
  }
  return party;
};

describe("generateRecruitCandidates", () => {
  it("returns exactly 2 candidates", () => {
    const rng = createRng(42);
    const candidates = generateRecruitCandidates(rng, "node.test");
    expect(candidates).toHaveLength(2);
  });

  it("candidates have valid classIds", () => {
    const rng = createRng(42);
    const candidates = generateRecruitCandidates(rng, "node.test");
    for (const c of candidates) {
      expect(["class.guardian", "class.acolyte", "class.arcanist"]).toContain(c.classId);
    }
  });

  it("candidates are level 1", () => {
    const rng = createRng(42);
    const candidates = generateRecruitCandidates(rng, "node.test");
    for (const c of candidates) {
      expect(c.level).toBe(1);
      expect(c.xp).toBe(0);
    }
  });

  it("deterministic with fixed seed", () => {
    const rng1 = createRng(99);
    const rng2 = createRng(99);
    const a = generateRecruitCandidates(rng1, "node.test");
    const b = generateRecruitCandidates(rng2, "node.test");
    expect(a.map((c) => c.classId)).toEqual(b.map((c) => c.classId));
  });

  it("persists per node id", () => {
    const rng = createRng(42);
    const a = generateRecruitCandidates(rng, "node.alpha");
    const b = generateRecruitCandidates(rng, "node.beta");
    expect(a.map((c) => c.classId)).not.toEqual(b.map((c) => c.classId));
  });
});

describe("addRecruitToParty", () => {
  it("with party size 3, grows it to 4", () => {
    const party = makeParty(3);
    const recruit = makeParty(1)[0];
    const inventory: string[] = [];
    addRecruitToParty(party, recruit, inventory);
    expect(party).toHaveLength(4);
    expect(party[3].instanceId).toBe(recruit.instanceId);
  });

  it("with party size 4 + replacement, removes chosen hero and adds recruit", () => {
    const party = makeParty(4);
    party[0].equippedItemIds.weapon = "item.iron_sword";
    const recruit = makeParty(1)[0];
    const inventory: string[] = [];
    addRecruitToParty(party, recruit, inventory, 0);
    expect(party).toHaveLength(4);
    expect(party[3].instanceId).toBe(recruit.instanceId);
    expect(inventory).toContain("item.iron_sword");
  });

  it("adds without replacement when no index given", () => {
    const party = makeParty(2);
    const recruit = makeParty(1)[0];
    const inventory: string[] = [];
    addRecruitToParty(party, recruit, inventory);
    expect(party).toHaveLength(3);
  });
});

describe("createPackMuleModifier", () => {
  it("creates a gold_multiplier modifier with value 1.2", () => {
    const mod = createPackMuleModifier();
    if (mod.kind !== "gold_multiplier") throw new Error("wrong kind");
    expect(mod.value).toBe(1.2);
  });

  it("applyGoldModifiers applies 1.2 multiplier", () => {
    const mod = createPackMuleModifier();
    const result = applyGoldModifiers(10, [mod]);
    expect(result).toBe(12);
  });

  it("applyGoldModifiers floors the result", () => {
    const mod = createPackMuleModifier();
    const result = applyGoldModifiers(11, [mod]);
    expect(result).toBe(13);
  });
});
