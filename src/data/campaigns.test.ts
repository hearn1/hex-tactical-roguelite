import { describe, it, expect } from "vitest";
import {
  DEFAULT_CAMPAIGN,
  CAMPAIGN_REGISTRY,
  getActDefinition,
  selectActMapTemplate,
  selectActEncounterPool,
  selectActRewardPool,
} from "./campaigns.ts";
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
