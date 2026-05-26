import { describe, it, expect } from "vitest";
import { restParty, trainPartyMember, applyEventChoiceEffects, applyStatBoost } from "./Events.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";
import type { EventChoice } from "../data/events.ts";
import { createRng } from "../core/rng.ts";
import { createInventory } from "./Inventory.ts";

const makeParty = (): PartyMember[] => [
  {
    instanceId: "hero_001",
    classId: "class.guardian",
    displayName: "Mara",
    level: 1,
    xp: 0,
    hp: 18,
    maxHp: 18,
    bonusStats: {},
    equippedItemIds: { weapon: "item.iron_sword", armor: null, trinket: null },
  },
  {
    instanceId: "hero_002",
    classId: "class.acolyte",
    displayName: "Sable",
    level: 1,
    xp: 0,
    hp: 7,
    maxHp: 14,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: "item.padded_armor", trinket: null },
  },
];

const makeRun = (party: PartyMember[]): RunState => ({
  seed: 0,
  gold: 0,
  party,
  inventory: createInventory(),
  mapState: { currentNodeId: "node.start", visitedNodeIds: ["node.start"], nodesCleared: 0, elitesDefeated: 0, bossDefeated: false },
  runStatus: "active",
  shopStates: {},
  recruitOffers: {},
  runModifiers: [],
});

describe("restParty", () => {
  it("heals heroes by floor(40% maxHp), min 1", () => {
    const party = makeParty();
    party[0].hp = 5;
    party[1].hp = 3;

    restParty(party);

    const heal0 = Math.max(1, Math.floor(18 * 0.4));
    const heal1 = Math.max(1, Math.floor(14 * 0.4));
    expect(party[0].hp).toBe(5 + heal0);
    expect(party[1].hp).toBe(3 + heal1);
  });

  it("does not heal past maxHp", () => {
    const party = makeParty();
    party[0].hp = 17;
    restParty(party);
    expect(party[0].hp).toBe(18);
  });

  it("heals minimum 1 even for very low maxHp", () => {
    const party = makeParty();
    party[0].maxHp = 1;
    party[0].hp = 0;
    restParty(party);
    expect(party[0].hp).toBe(0);
  });
});

describe("trainPartyMember", () => {
  it("applies +5 XP", () => {
    const party = makeParty();
    trainPartyMember(party[0], 5);
    expect(party[0].xp).toBe(5);
  });

  it("triggers level-up at boundary (20 XP)", () => {
    const party = makeParty();
    party[0].xp = 18;
    const result = trainPartyMember(party[0], 5);
    expect(result.leveledUp).toBe(true);
    expect(party[0].level).toBe(2);
    expect(party[0].xp).toBe(23);
  });

  it("does not level-up with small XP", () => {
    const party = makeParty();
    const result = trainPartyMember(party[0], 5);
    expect(result.leveledUp).toBe(false);
    expect(party[0].level).toBe(1);
  });
});

describe("applyEventChoiceEffects", () => {
  it("Loot option damages random hero and grants gold", () => {
    const rng = createRng(42);
    const party = makeParty();
    const run = makeRun(party);

    const lootChoice: EventChoice = {
      id: "event.strange_shrine.loot",
      label: "Loot the offerings",
      description: "",
      effects: [
        { type: "hp_damage", amount: 5, target: "random_hero" },
        { type: "gold", amount: 15 },
      ],
    };

    applyEventChoiceEffects(lootChoice, run, rng);
    expect(run.gold).toBe(15);
    expect(run.inventory.gold).toBe(15);
    const totalHp = party.reduce((s, p) => s + p.hp, 0);
    expect(totalHp).toBe(18 + 7 - 5);
  });

  it("hp_damage never reduces HP below 1", () => {
    const rng = createRng(42);
    const party = makeParty();
    const run = makeRun(party);
    party[0].hp = 3;

    const dmgChoice: EventChoice = {
      id: "test",
      label: "Test",
      description: "",
      effects: [{ type: "hp_damage", amount: 10, target: "random_hero" }],
    };

    applyEventChoiceEffects(dmgChoice, run, rng);
    for (const pm of party) {
      expect(pm.hp).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("applyStatBoost", () => {
  it("applies +1 spirit to the chosen hero", () => {
    const party = makeParty();
    const msg = applyStatBoost(party[0], "spirit", 1);
    expect(party[0].bonusStats.spirit).toBe(1);
    expect(msg).toContain("+1");
  });

  it("accumulates multiple boosts", () => {
    const party = makeParty();
    applyStatBoost(party[0], "spirit", 1);
    applyStatBoost(party[0], "spirit", 1);
    expect(party[0].bonusStats.spirit).toBe(2);
  });
});
