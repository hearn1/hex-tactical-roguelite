import { describe, it, expect } from "vitest";
import {
  DEFAULT_CAMPAIGN,
  CAMPAIGN_REGISTRY,
  STORY_BEAT_REGISTRY,
  getActDefinition,
  selectActMapTemplate,
  selectActEncounterPool,
  selectActRewardPool,
} from "./campaigns.ts";
import { MAP_TEMPLATES } from "./nodes.ts";
import { ENCOUNTER_POOLS } from "./encounters.ts";
import { ACT_REWARD_POOLS, REWARD_REGISTRY } from "./rewards.ts";
import { createCampaignState } from "../state/CampaignState.ts";
import { createInventory } from "../run/Inventory.ts";
import type { PartyMember } from "../state/RunState.ts";

const EXPECTED_ACT_IDS = ["act_1", "act_2", "act_3", "act_4"] as const;

function deterministicRng(value: number): () => number {
  return () => value;
}

function makePartyMember(id: string): PartyMember {
  return {
    instanceId: id,
    classId: "class.guardian",
    displayName: "Hero",
    level: 1,
    xp: 0,
    hp: 18,
    maxHp: 18,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: null, trinket: null },
  };
}

describe("DEFAULT_CAMPAIGN", () => {
  it("has a stable id", () => {
    expect(DEFAULT_CAMPAIGN.id).toBe("campaign.verdant_dark");
  });

  it("contains exactly 4 acts", () => {
    expect(DEFAULT_CAMPAIGN.acts).toHaveLength(4);
  });

  it("act ids follow the act_N format", () => {
    const ids = DEFAULT_CAMPAIGN.acts.map((a) => a.id);
    expect(ids).toEqual(EXPECTED_ACT_IDS);
  });

  it("acts are in ascending order", () => {
    const orders = DEFAULT_CAMPAIGN.acts.map((a) => a.order);
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it("each act has a non-empty displayName", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      expect(act.displayName.length).toBeGreaterThan(0);
    }
  });

  it("each act has at least one map template", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      expect(act.mapPool.templateIds.length).toBeGreaterThan(0);
    }
  });

  it("each act has a non-empty encounterPool poolId", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      expect(act.encounterPool.poolId.length).toBeGreaterThan(0);
    }
  });

  it("each act has a non-empty rewardPool poolId", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      expect(act.rewardPool.poolId.length).toBeGreaterThan(0);
    }
  });

  it("each act has at least one story beat", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      expect(act.storyBeats.length).toBeGreaterThan(0);
    }
  });

  it("all story beat ids are unique within each act", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      const ids = act.storyBeats.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("story beat ids are prefixed with the act id", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      for (const beat of act.storyBeats) {
        expect(beat.id.startsWith(act.id + ".")).toBe(true);
      }
    }
  });
});

describe("CAMPAIGN_REGISTRY", () => {
  it("contains the default campaign", () => {
    expect(CAMPAIGN_REGISTRY["campaign.verdant_dark"]).toBe(DEFAULT_CAMPAIGN);
  });
});

describe("getActDefinition", () => {
  it("returns act_1 for actNumber 1", () => {
    const act = getActDefinition(DEFAULT_CAMPAIGN, 1);
    expect(act?.id).toBe("act_1");
  });

  it("returns act_4 for actNumber 4", () => {
    const act = getActDefinition(DEFAULT_CAMPAIGN, 4);
    expect(act?.id).toBe("act_4");
  });

  it("returns undefined for actNumber 0 (out of range)", () => {
    expect(getActDefinition(DEFAULT_CAMPAIGN, 0)).toBeUndefined();
  });

  it("returns undefined for actNumber 5 (beyond campaign length)", () => {
    expect(getActDefinition(DEFAULT_CAMPAIGN, 5)).toBeUndefined();
  });
});

describe("selectActMapTemplate — RNG seam", () => {
  it("returns a template id from the act pool", () => {
    const act = getActDefinition(DEFAULT_CAMPAIGN, 1)!;
    const result = selectActMapTemplate(act, deterministicRng(0));
    expect(act.mapPool.templateIds).toContain(result);
  });

  it("returns 'long' fallback when act is undefined (missing campaign data)", () => {
    expect(selectActMapTemplate(undefined, deterministicRng(0))).toBe("long");
  });

  it("returns 'long' fallback when act map pool is empty", () => {
    const emptyAct = { ...getActDefinition(DEFAULT_CAMPAIGN, 1)!, mapPool: { templateIds: [] } };
    expect(selectActMapTemplate(emptyAct, deterministicRng(0))).toBe("long");
  });

  it("selects deterministically based on rng value", () => {
    const act = getActDefinition(DEFAULT_CAMPAIGN, 1)!;
    // rng returns 0 → index 0
    const first = selectActMapTemplate(act, deterministicRng(0));
    expect(first).toBe(act.mapPool.templateIds[0]);
    // rng returns 0.99 → last index
    const last = selectActMapTemplate(act, deterministicRng(0.9999));
    expect(last).toBe(act.mapPool.templateIds[act.mapPool.templateIds.length - 1]);
  });
});

describe("selectActEncounterPool — RNG seam", () => {
  it("returns the act encounter pool id", () => {
    const act = getActDefinition(DEFAULT_CAMPAIGN, 1)!;
    expect(selectActEncounterPool(act)).toBe(act.encounterPool.poolId);
  });

  it("returns 'pool.standard_combat' fallback when act is undefined", () => {
    expect(selectActEncounterPool(undefined)).toBe("pool.standard_combat");
  });
});

describe("selectActRewardPool — RNG seam", () => {
  it("returns the act reward pool id", () => {
    const act = getActDefinition(DEFAULT_CAMPAIGN, 1)!;
    expect(selectActRewardPool(act)).toBe(act.rewardPool.poolId);
  });

  it("returns 'pool.basic_rewards' fallback when act is undefined", () => {
    expect(selectActRewardPool(undefined)).toBe("pool.basic_rewards");
  });
});

describe("createCampaignState", () => {
  it("creates a campaign state starting at act 1", () => {
    const party = [makePartyMember("hero_001")];
    const state = createCampaignState("campaign.verdant_dark", 42, "normal", party, createInventory());
    expect(state.currentActNumber).toBe(1);
    expect(state.campaignStatus).toBe("active");
  });

  it("carries the supplied party and inventory", () => {
    const party = [makePartyMember("hero_001"), makePartyMember("hero_002")];
    const inventory = createInventory();
    const state = createCampaignState("campaign.verdant_dark", 1, "hard", party, inventory);
    expect(state.party).toBe(party);
    expect(state.inventory).toBe(inventory);
  });

  it("initializes completedActs as empty", () => {
    const state = createCampaignState("campaign.verdant_dark", 1, "normal", [], createInventory());
    expect(state.completedActs).toHaveLength(0);
  });

  it("initializes eventSelections and adventureLog as empty", () => {
    const state = createCampaignState("campaign.verdant_dark", 1, "normal", [], createInventory());
    expect(state.eventSelections).toEqual({});
    expect(state.adventureLog).toHaveLength(0);
  });

  it("stores the seed and difficulty", () => {
    const state = createCampaignState("campaign.verdant_dark", 9999, "hard", [], createInventory());
    expect(state.seed).toBe(9999);
    expect(state.difficulty).toBe("hard");
  });
});

// ---------------------------------------------------------------------------
// Registry resolution tests (issue #312)
// ---------------------------------------------------------------------------

describe("map template registry — all act references resolve", () => {
  it("every mapPool templateId in DEFAULT_CAMPAIGN exists in MAP_TEMPLATES", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      for (const templateId of act.mapPool.templateIds) {
        expect(MAP_TEMPLATES[templateId], `Missing map template "${templateId}" for act "${act.id}"`).toBeDefined();
      }
    }
  });

  it("every alternateLayoutId in DEFAULT_CAMPAIGN exists in MAP_TEMPLATES", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      for (const layoutId of act.alternateLayoutIds ?? []) {
        expect(MAP_TEMPLATES[layoutId], `Missing alternate layout template "${layoutId}" for act "${act.id}"`).toBeDefined();
      }
    }
  });

  it("each placeholder act template has a valid startNodeId and bossNodeId", () => {
    const actTemplateIds = ["act_2_map", "act_3_map", "act_4_map",
      "act_2_map_deserter_route", "act_3_map_prisoner_rescue", "act_4_map_planar_anchor"];
    for (const templateId of actTemplateIds) {
      const template = MAP_TEMPLATES[templateId];
      expect(template, `Template "${templateId}" missing`).toBeDefined();
      const nodeIds = new Set(template.nodes.map((n) => n.id));
      expect(nodeIds.has(template.startNodeId), `"${templateId}" startNodeId not in nodes`).toBe(true);
      expect(nodeIds.has(template.bossNodeId), `"${templateId}" bossNodeId not in nodes`).toBe(true);
    }
  });
});

describe("encounter pool registry — all act references resolve", () => {
  it("every encounterPool poolId in DEFAULT_CAMPAIGN exists in ENCOUNTER_POOLS", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      const poolId = act.encounterPool.poolId;
      expect(ENCOUNTER_POOLS[poolId], `Missing encounter pool "${poolId}" for act "${act.id}"`).toBeDefined();
    }
  });

  it("every encounter in act pool IDs exists in ENCOUNTER_REGISTRY", async () => {
    const { ENCOUNTER_REGISTRY } = await import("./encounters.ts");
    const actPoolIds = ["pool.act_2_combat", "pool.act_3_combat", "pool.act_4_combat"];
    for (const poolId of actPoolIds) {
      for (const encId of ENCOUNTER_POOLS[poolId]) {
        expect(ENCOUNTER_REGISTRY[encId], `Encounter "${encId}" in pool "${poolId}" not found`).toBeDefined();
      }
    }
  });
});

describe("reward pool registry — all act references resolve", () => {
  it("every rewardPool poolId in DEFAULT_CAMPAIGN exists in ACT_REWARD_POOLS", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      const poolId = act.rewardPool.poolId;
      expect(ACT_REWARD_POOLS[poolId], `Missing act reward pool "${poolId}" for act "${act.id}"`).toBeDefined();
    }
  });

  it("fallback pool 'pool.basic_rewards' exists in ACT_REWARD_POOLS", () => {
    expect(ACT_REWARD_POOLS["pool.basic_rewards"]).toBeDefined();
  });

  it("every reward tier referenced in ACT_REWARD_POOLS exists in REWARD_REGISTRY", () => {
    for (const [poolId, tiers] of Object.entries(ACT_REWARD_POOLS)) {
      for (const tierId of tiers) {
        expect(REWARD_REGISTRY[tierId], `Reward tier "${tierId}" in pool "${poolId}" not found in REWARD_REGISTRY`).toBeDefined();
      }
    }
  });
});

describe("story beat registry — all act beats resolve", () => {
  it("STORY_BEAT_REGISTRY contains every beat from DEFAULT_CAMPAIGN", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      for (const beat of act.storyBeats) {
        expect(STORY_BEAT_REGISTRY[beat.id], `Story beat "${beat.id}" not in STORY_BEAT_REGISTRY`).toBeDefined();
      }
    }
  });

  it("each registry entry matches the source beat definition", () => {
    for (const act of DEFAULT_CAMPAIGN.acts) {
      for (const beat of act.storyBeats) {
        const entry = STORY_BEAT_REGISTRY[beat.id];
        expect(entry.id).toBe(beat.id);
        expect(entry.description).toBe(beat.description);
      }
    }
  });

  it("total beat count matches sum across all acts", () => {
    const expected = DEFAULT_CAMPAIGN.acts.reduce((sum, a) => sum + a.storyBeats.length, 0);
    expect(Object.keys(STORY_BEAT_REGISTRY).length).toBe(expected);
  });
});
