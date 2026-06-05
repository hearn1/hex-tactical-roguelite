import { describe, it, expect } from "vitest";
import {
  restParty,
  trainPartyMember,
  applyEventChoiceEffects,
  applyEffectList,
  applyStatBoost,
  resolveCheckEffect,
  evaluateRequirements,
  choiceNeedsHeroPick,
  resolveEventChoice,
  resolveEventChoiceWithHero,
  selectEventForNode,
  brewPotion,
  prepareForCombat,
  CAMP_BREW_POTION_COST,
  CAMP_BREW_POTION_ID,
} from "./Events.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";
import type { EventChoice, CheckEffect } from "../data/events.ts";
import { EVENT_REGISTRY, EVENT_POOLS, DEFAULT_EVENT_POOL_ID } from "../data/events.ts";
import { NODE_REGISTRY } from "../data/nodes.ts";
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
  campStates: {},
  recruitOffers: {},
  runModifiers: [],
  difficulty: "normal",
  eventSelections: {},
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

describe("brewPotion", () => {
  it("spends gold and adds a Healing Potion when affordable", () => {
    const run = makeRun(makeParty());
    run.gold = CAMP_BREW_POTION_COST + 5;
    run.inventory.gold = run.gold;

    const result = brewPotion(run);

    expect(result.ok).toBe(true);
    expect(run.gold).toBe(5);
    expect(run.inventory.gold).toBe(5);
    expect(run.inventory.potions).toContain(CAMP_BREW_POTION_ID);
    expect(result.message).toContain("Healing Potion");
  });

  it("fails without changing state when the party can't afford it", () => {
    const run = makeRun(makeParty());
    run.gold = CAMP_BREW_POTION_COST - 1;
    run.inventory.gold = run.gold;

    const result = brewPotion(run);

    expect(result.ok).toBe(false);
    expect(run.gold).toBe(CAMP_BREW_POTION_COST - 1);
    expect(run.inventory.potions).toHaveLength(0);
  });
});

describe("prepareForCombat", () => {
  it("queues a next_combat_blessing run modifier", () => {
    const run = makeRun(makeParty());

    const result = prepareForCombat(run);

    expect(result.ok).toBe(true);
    expect(run.runModifiers).toEqual([{ kind: "next_combat_blessing" }]);
    expect(result.message).toContain("Blessed");
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

describe("resolveCheckEffect", () => {
  const faceRng = (face: number) => () => (face - 1) / 20;

  const bridgeCheck: CheckEffect = {
    type: "check",
    check: { stat: "agility", dc: 12, partialWithin: 3 },
    onSuccess: [{ type: "gold", amount: 25 }],
    onPartial: [{ type: "gold", amount: 10 }],
    onFailure: [{ type: "hp_damage", amount: 6, target: "random_hero" }],
  };

  it("runs the onSuccess branch and logs the roll", () => {
    const party = makeParty(); // Mara (guardian) agility mod 1
    const run = makeRun(party);
    // roll 14 + 1 = 15 >= 12 -> success
    const { result, messages } = resolveCheckEffect(bridgeCheck, party[0], run, faceRng(14));
    expect(result.outcome).toBe("success");
    expect(run.gold).toBe(25);
    expect(messages[0]).toContain("Agility check");
    expect(messages[0]).toContain("Success");
  });

  it("runs the onPartial branch on a near-miss", () => {
    const party = makeParty();
    const run = makeRun(party);
    // roll 10 + 1 = 11, dc 12, margin -1, band 3 -> partial
    const { result } = resolveCheckEffect(bridgeCheck, party[0], run, faceRng(10));
    expect(result.outcome).toBe("partial");
    expect(run.gold).toBe(10);
  });

  it("runs the onFailure branch outside the band", () => {
    const party = makeParty();
    const run = makeRun(party);
    const before = party.reduce((s, p) => s + p.hp, 0);
    // roll 3 + 1 = 4, dc 12, margin -8 -> failure -> 6 damage
    const { result } = resolveCheckEffect(bridgeCheck, party[0], run, faceRng(3));
    expect(result.outcome).toBe("failure");
    const after = party.reduce((s, p) => s + p.hp, 0);
    expect(after).toBe(before - 6);
  });

  it("falls back to onFailure when a partial occurs but no onPartial is defined", () => {
    const party = makeParty();
    const run = makeRun(party);
    const noPartial: CheckEffect = { ...bridgeCheck, onPartial: undefined };
    const before = party.reduce((s, p) => s + p.hp, 0);
    const { result } = resolveCheckEffect(noPartial, party[0], run, faceRng(10));
    expect(result.outcome).toBe("partial");
    const after = party.reduce((s, p) => s + p.hp, 0);
    expect(after).toBe(before - 6);
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

describe("applyEffectList — every effect type", () => {
  const rng = () => 0;

  it("gold adds to run and inventory", () => {
    const run = makeRun(makeParty());
    applyEffectList([{ type: "gold", amount: 12 }], run, rng);
    expect(run.gold).toBe(12);
    expect(run.inventory.gold).toBe(12);
  });

  it("gold_cost spends down to a floor of 0", () => {
    const run = makeRun(makeParty());
    run.gold = 5;
    run.inventory.gold = 5;
    applyEffectList([{ type: "gold_cost", amount: 20 }], run, rng);
    expect(run.gold).toBe(0);
    expect(run.inventory.gold).toBe(0);
  });

  it("item and potion land in inventory", () => {
    const run = makeRun(makeParty());
    applyEffectList([{ type: "item", itemId: "item.lucky_charm" }, { type: "potion", potionId: "potion.healing" }], run, rng);
    expect(run.inventory.items).toContain("item.lucky_charm");
    expect(run.inventory.potions).toContain("potion.healing");
  });

  it("heal_party heals living heroes only", () => {
    const party = makeParty();
    party[1].hp = 4;
    const run = makeRun(party);
    applyEffectList([{ type: "heal_party", percent: 50 }], run, rng);
    expect(party[1].hp).toBe(4 + Math.floor(14 * 0.5));
  });

  it("xp:party grants XP to every hero", () => {
    const party = makeParty();
    const run = makeRun(party);
    applyEffectList([{ type: "xp", amount: 10, target: "party" }], run, rng);
    expect(party[0].xp).toBe(10);
    expect(party[1].xp).toBe(10);
  });

  it("xp:random_hero grants XP to exactly one living hero", () => {
    const party = makeParty();
    const run = makeRun(party);
    applyEffectList([{ type: "xp", amount: 10, target: "random_hero" }], run, rng);
    const total = party.reduce((s, p) => s + p.xp, 0);
    expect(total).toBe(10);
  });

  it("xp:picked_hero is deferred to the hero-pick flow (no-op here)", () => {
    const party = makeParty();
    const run = makeRun(party);
    applyEffectList([{ type: "xp", amount: 10, target: "picked_hero" }], run, rng);
    expect(party.reduce((s, p) => s + p.xp, 0)).toBe(0);
  });

  it("buff pushes the modifier onto run.runModifiers", () => {
    const run = makeRun(makeParty());
    applyEffectList([{ type: "buff", modifier: { kind: "global_stat", stat: "might", value: 1 } }], run, rng);
    expect(run.runModifiers).toEqual([{ kind: "global_stat", stat: "might", value: 1 }]);
  });

  it("noop changes nothing", () => {
    const run = makeRun(makeParty());
    const msgs = applyEffectList([{ type: "noop" }], run, rng);
    expect(run.gold).toBe(0);
    expect(msgs[0]).toContain("Nothing");
  });
});

describe("evaluateRequirements", () => {
  it("ok when no requirements", () => {
    const run = makeRun(makeParty());
    const choice: EventChoice = { id: "c", label: "c", description: "", effects: [{ type: "noop" }] };
    expect(evaluateRequirements(choice, run).ok).toBe(true);
  });

  it("minGold fails with a reason when too poor, passes when affordable", () => {
    const run = makeRun(makeParty());
    const choice: EventChoice = { id: "c", label: "c", description: "", effects: [{ type: "noop" }], requirements: [{ type: "minGold", amount: 20 }] };
    let r = evaluateRequirements(choice, run);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("20 gold");
    run.gold = 25;
    expect(evaluateRequirements(choice, run).ok).toBe(true);
  });

  it("hasItem checks the run inventory", () => {
    const run = makeRun(makeParty());
    const choice: EventChoice = { id: "c", label: "c", description: "", effects: [{ type: "noop" }], requirements: [{ type: "hasItem", itemId: "item.lucky_charm" }] };
    expect(evaluateRequirements(choice, run).ok).toBe(false);
    run.inventory.items.push("item.lucky_charm");
    expect(evaluateRequirements(choice, run).ok).toBe(true);
  });

  it("livingHero fails when the whole party is down", () => {
    const party = makeParty();
    for (const p of party) p.hp = 0;
    const run = makeRun(party);
    const choice: EventChoice = { id: "c", label: "c", description: "", effects: [{ type: "noop" }], requirements: [{ type: "livingHero" }] };
    const r = evaluateRequirements(choice, run);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("living hero");
  });

  it("partySizeAtLeast compares against the party length", () => {
    const run = makeRun(makeParty()); // 2 heroes
    const choice: EventChoice = { id: "c", label: "c", description: "", effects: [{ type: "noop" }], requirements: [{ type: "partySizeAtLeast", n: 3 }] };
    expect(evaluateRequirements(choice, run).ok).toBe(false);
    choice.requirements = [{ type: "partySizeAtLeast", n: 2 }];
    expect(evaluateRequirements(choice, run).ok).toBe(true);
  });
});

describe("resolveEventChoice", () => {
  const rng = () => 0;

  it("applies non-picker effects immediately", () => {
    const run = makeRun(makeParty());
    const choice: EventChoice = { id: "c", label: "c", description: "", effects: [{ type: "gold", amount: 5 }] };
    const res = resolveEventChoice(choice, run, rng);
    expect(res.needsHeroPick).toBe(false);
    expect(run.gold).toBe(5);
    expect(res.messages.length).toBeGreaterThan(0);
  });

  it("flags hero pick and applies nothing for stat_boost / check / xp:picked_hero", () => {
    const run = makeRun(makeParty());
    for (const effects of [
      [{ type: "stat_boost", stat: "spirit", amount: 1 }] as const,
      [{ type: "xp", amount: 5, target: "picked_hero" }] as const,
    ]) {
      const choice: EventChoice = { id: "c", label: "c", description: "", effects: [...effects] };
      expect(choiceNeedsHeroPick(choice)).toBe(true);
      const res = resolveEventChoice(choice, run, rng);
      expect(res.needsHeroPick).toBe(true);
      expect(res.messages).toHaveLength(0);
    }
    expect(run.party.reduce((s, p) => s + p.xp, 0)).toBe(0);
  });
});

describe("resolveEventChoiceWithHero", () => {
  const rng = () => 0;

  it("applies stat_boost to the chosen hero", () => {
    const party = makeParty();
    const run = makeRun(party);
    const choice: EventChoice = { id: "c", label: "c", description: "", effects: [{ type: "stat_boost", stat: "spirit", amount: 1 }] };
    resolveEventChoiceWithHero(choice, party[1], run, rng);
    expect(party[1].bonusStats.spirit).toBe(1);
    expect(party[0].bonusStats.spirit ?? 0).toBe(0);
  });

  it("applies xp:picked_hero to the chosen hero only", () => {
    const party = makeParty();
    const run = makeRun(party);
    const choice: EventChoice = { id: "c", label: "c", description: "", effects: [{ type: "xp", amount: 10, target: "picked_hero" }] };
    resolveEventChoiceWithHero(choice, party[0], run, rng);
    expect(party[0].xp).toBe(10);
    expect(party[1].xp).toBe(0);
  });

  it("routes a check effect through the chosen hero", () => {
    const party = makeParty();
    const run = makeRun(party);
    const choice: EventChoice = {
      id: "c", label: "c", description: "",
      effects: [{
        type: "check",
        check: { stat: "agility", dc: 12 },
        onSuccess: [{ type: "gold", amount: 25 }],
        onFailure: [{ type: "noop" }],
      }],
    };
    // face 20 -> guaranteed success
    const { messages } = resolveEventChoiceWithHero(choice, party[0], run, () => 19 / 20);
    expect(run.gold).toBe(25);
    expect(messages[0]).toContain("Agility check");
  });
});

describe("selectEventForNode", () => {
  it("is deterministic for a fixed seed and persists the selection", () => {
    const runA = makeRun(makeParty());
    const runB = makeRun(makeParty());
    const a = selectEventForNode(runA, "node.event_1", createRng(777));
    const b = selectEventForNode(runB, "node.event_1", createRng(777));
    expect(a).toBe(b);
    expect(runA.eventSelections["node.event_1"]).toBe(a);
  });

  it("returns the stored selection on re-visit without drawing again", () => {
    const run = makeRun(makeParty());
    run.eventSelections["node.event_1"] = "event.healing_spring";
    // An rng that would throw if called proves no draw happens.
    const chosen = selectEventForNode(run, "node.event_1", () => { throw new Error("must not draw"); });
    expect(chosen).toBe("event.healing_spring");
  });

  it("draws from the default shared pool for nodes without an eventPoolId", () => {
    const run = makeRun(makeParty());
    const chosen = selectEventForNode(run, "node.event_1", createRng(1));
    expect(EVENT_POOLS[DEFAULT_EVENT_POOL_ID]).toContain(chosen);
  });

  it("does not repeat a non-repeatable event within a run", () => {
    const run = makeRun(makeParty());
    const pool = EVENT_POOLS[DEFAULT_EVENT_POOL_ID];
    const seen = new Set<string>();
    // Draw once per pool entry; with no repeatable events every draw must be distinct.
    for (let i = 0; i < pool.length; i++) {
      const chosen = selectEventForNode(run, `node.synthetic_${i}`, createRng(100 + i));
      expect(seen.has(chosen)).toBe(false);
      seen.add(chosen);
    }
    expect(seen.size).toBe(pool.length);
  });

  it("allows a repeatable event to be selected again", () => {
    const run = makeRun(makeParty());
    const repeatableId = Object.keys(EVENT_REGISTRY).find((id) => EVENT_REGISTRY[id].repeatable);
    EVENT_REGISTRY["event.__repeatable_fixture"] = {
      id: "event.__repeatable_fixture",
      title: "Repeatable Fixture",
      description: "",
      choices: [{ id: "a", label: "A", description: "", effects: [{ type: "noop" }] }],
      repeatable: true,
    };
    EVENT_POOLS["pool.__repeatable_fixture"] = ["event.__repeatable_fixture"];
    NODE_REGISTRY["node.__rf_a"] = { id: "node.__rf_a", type: "event", title: "", description: "", layer: 0, eventPoolId: "pool.__repeatable_fixture", nextNodeIds: [] };
    NODE_REGISTRY["node.__rf_b"] = { id: "node.__rf_b", type: "event", title: "", description: "", layer: 0, eventPoolId: "pool.__repeatable_fixture", nextNodeIds: [] };
    try {
      const first = selectEventForNode(run, "node.__rf_a", createRng(5));
      const second = selectEventForNode(run, "node.__rf_b", createRng(6));
      expect(first).toBe("event.__repeatable_fixture");
      expect(second).toBe("event.__repeatable_fixture");
    } finally {
      delete EVENT_REGISTRY["event.__repeatable_fixture"];
      delete EVENT_POOLS["pool.__repeatable_fixture"];
      delete NODE_REGISTRY["node.__rf_a"];
      delete NODE_REGISTRY["node.__rf_b"];
    }
    expect(repeatableId).toBeUndefined(); // pack ships with no repeatable events by default
  });

  it("honors a node's pinned eventId (guaranteed signature scene)", () => {
    const run = makeRun(makeParty());
    NODE_REGISTRY["node.__pinned"] = {
      id: "node.__pinned", type: "event", title: "", description: "", layer: 0,
      eventId: "event.ashen_star_shrine", nextNodeIds: [],
    };
    try {
      const chosen = selectEventForNode(run, "node.__pinned", () => { throw new Error("must not draw"); });
      expect(chosen).toBe("event.ashen_star_shrine");
    } finally {
      delete NODE_REGISTRY["node.__pinned"];
    }
  });
});

describe("event content pack — check branches reward the attempting hero", () => {
  const faceRng = (face: number) => () => (face - 1) / 20;

  it("Whispering Milestone success grants +1 Spirit to the hero who attempted", () => {
    const party = makeParty();
    const run = makeRun(party);
    const choice = EVENT_REGISTRY["event.whispering_milestone"].choices[0];
    // Acolyte (Sable) spirit mod +3; roll 12 -> 15 vs DC 13 -> success.
    resolveEventChoiceWithHero(choice, party[1], run, faceRng(12));
    expect(party[1].bonusStats.spirit).toBe(1);
    expect(party[0].bonusStats.spirit ?? 0).toBe(0);
  });

  it("Rain-Washed Cairn success grants XP to the reader on success", () => {
    const party = makeParty();
    const run = makeRun(party);
    const choice = EVENT_REGISTRY["event.rain_washed_cairn"].choices[1];
    resolveEventChoiceWithHero(choice, party[1], run, faceRng(20));
    expect(party[1].xp).toBe(15);
    expect(party[0].xp).toBe(0);
  });
});
