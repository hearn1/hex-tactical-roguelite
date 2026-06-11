// #370 — Side quest reward and consequence regression tests

import { describe, it, expect } from "vitest";
import { applyQuestOutcomeHook, hasQuestOutcomeHookApplied } from "./QuestOutcomeApplicator.ts";
import { createCampaignState } from "../state/CampaignState.ts";
import { createInventory } from "./Inventory.ts";
import type { PartyMember } from "../state/RunState.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePartyMember(xp = 0): PartyMember {
  return {
    instanceId: "hero.1",
    classId: "class.guardian",
    displayName: "Kael",
    level: 1,
    xp,
    hp: 20,
    maxHp: 20,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: null, trinket: null },
  };
}

function makeCampaign() {
  return createCampaignState(
    "campaign.verdant_dark",
    42,
    "normal",
    [makePartyMember()],
    createInventory(),
  );
}

// ---------------------------------------------------------------------------
// #368 — Reward application
// ---------------------------------------------------------------------------

describe("applyQuestOutcomeHook — reward application (#368)", () => {
  it("grants gold to campaign inventory on completion", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(campaign.inventory.gold).toBe(30);
  });

  it("grants xp to all party members on completion", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(campaign.party[0].xp).toBe(20);
  });

  it("adds item to inventory on completion", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(campaign.inventory.items).toContain("item.hearthstone_charm");
  });

  it("adds potion to inventory for cache_secured", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act2.deserter_cache.cache_secured", campaign);
    expect(campaign.inventory.potions).toContain("potion.healing");
  });

  it("quest with no configured rewards resolves safely without changing inventory", () => {
    const campaign = makeCampaign();
    const result = applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.abandoned", campaign);
    expect(result.applied).toBe(true);
    expect(campaign.inventory.gold).toBe(0);
    expect(campaign.inventory.items).toHaveLength(0);
  });

  it("xp is granted to every party member", () => {
    const campaign = createCampaignState(
      "campaign.verdant_dark",
      1,
      "normal",
      [makePartyMember(), makePartyMember()],
      createInventory(),
    );
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(campaign.party[0].xp).toBe(20);
    expect(campaign.party[1].xp).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// #367 / #368 / #369 — Idempotency (once-only application)
// ---------------------------------------------------------------------------

describe("applyQuestOutcomeHook — idempotency (#367)", () => {
  it("applying the same hook twice does not double-grant gold", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(campaign.inventory.gold).toBe(30);
  });

  it("applying the same hook twice does not double-grant xp", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(campaign.party[0].xp).toBe(20);
  });

  it("applying the same hook twice does not add duplicate items", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(campaign.inventory.items.filter((id) => id === "item.hearthstone_charm")).toHaveLength(1);
  });

  it("second application returns already_applied reason", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    const result = applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(result.applied).toBe(false);
    expect(result.reason).toBe("already_applied");
  });

  it("hasQuestOutcomeHookApplied returns false before application", () => {
    const campaign = makeCampaign();
    expect(
      hasQuestOutcomeHookApplied("outcome.sq.act1.goblin_relic.completed", campaign),
    ).toBe(false);
  });

  it("hasQuestOutcomeHookApplied returns true after application", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(
      hasQuestOutcomeHookApplied("outcome.sq.act1.goblin_relic.completed", campaign),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// #369 — Consequence application
// ---------------------------------------------------------------------------

describe("applyQuestOutcomeHook — consequence application (#369)", () => {
  it("sets campaign flag on completion", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(campaign.eventSelections["flag.sq.act1.goblin_relic.completed"]).toBe("set");
  });

  it("sets campaign flag on failure", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act3.prisoner_rescue.failed", campaign);
    expect(campaign.eventSelections["flag.sq.act3.prisoner_rescue.failed"]).toBe("set");
  });

  it("appends a quest_outcome log entry on completion", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    const entry = campaign.adventureLog.find((e) => e.kind === "quest_outcome");
    expect(entry).toBeDefined();
    expect(entry?.text).toContain("Shattered Relic");
  });

  it("applies run_modifier for cache_destroyed", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act2.deserter_cache.cache_destroyed", campaign);
    const mod = campaign.runModifiers.find((m) => m.kind === "enemy_hp_multiplier");
    expect(mod).toBeDefined();
    expect((mod as { kind: "enemy_hp_multiplier"; value: number }).value).toBe(0.9);
  });

  it("applies enemy_damage_bonus run_modifier for prisoner_rescue.failed", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act3.prisoner_rescue.failed", campaign);
    const mod = campaign.runModifiers.find((m) => m.kind === "enemy_damage_bonus");
    expect(mod).toBeDefined();
    expect((mod as { kind: "enemy_damage_bonus"; value: number }).value).toBe(2);
  });

  it("failure hook does not grant completion rewards", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act3.prisoner_rescue.failed", campaign);
    expect(campaign.inventory.gold).toBe(0);
    expect(campaign.inventory.items).toHaveLength(0);
    expect(campaign.inventory.potions).toHaveLength(0);
  });

  it("ward_broken applies enemy_hp_multiplier and grants item reward", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act4.planar_echo.ward_broken", campaign);
    const mod = campaign.runModifiers.find((m) => m.kind === "enemy_hp_multiplier");
    expect(mod).toBeDefined();
    expect(campaign.inventory.items).toContain("item.bloodstone");
  });
});

// ---------------------------------------------------------------------------
// #367 — Unknown / invalid hook ids
// ---------------------------------------------------------------------------

describe("applyQuestOutcomeHook — unknown hook ids (#367)", () => {
  it("returns no_hook for an unregistered hookId", () => {
    const campaign = makeCampaign();
    const result = applyQuestOutcomeHook("outcome.unknown.hook", campaign);
    expect(result.applied).toBe(false);
    expect(result.reason).toBe("no_hook");
  });

  it("does not record an unknown hookId in appliedQuestOutcomeHookIds", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.unknown.hook", campaign);
    expect(campaign.appliedQuestOutcomeHookIds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// #370 — Hook persistence and act transition safety
// ---------------------------------------------------------------------------

describe("applyQuestOutcomeHook — persistence across act transitions (#370)", () => {
  it("appliedQuestOutcomeHookIds records applied hooks", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(campaign.appliedQuestOutcomeHookIds).toContain(
      "outcome.sq.act1.goblin_relic.completed",
    );
  });

  it("applied hooks remain guarded after simulated act transition", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    campaign.currentActNumber += 1;
    expect(
      hasQuestOutcomeHookApplied("outcome.sq.act1.goblin_relic.completed", campaign),
    ).toBe(true);
    const result = applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    expect(result.reason).toBe("already_applied");
  });

  it("different hooks across acts are applied independently", () => {
    const campaign = makeCampaign();
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    campaign.currentActNumber += 1;
    applyQuestOutcomeHook("outcome.sq.act2.deserter_cache.cache_secured", campaign);
    expect(campaign.appliedQuestOutcomeHookIds).toHaveLength(2);
    expect(campaign.inventory.gold).toBe(30 + 40);
    expect(campaign.party[0].xp).toBe(20 + 20);
  });

  it("quest with no rewards and no consequences resolves without modifying inventory or modifiers", () => {
    const campaign = makeCampaign();
    const result = applyQuestOutcomeHook("outcome.sq.act2.deserter_cache.failed", campaign);
    expect(result.applied).toBe(true);
    expect(campaign.inventory.gold).toBe(0);
    expect(campaign.runModifiers).toHaveLength(0);
    expect(campaign.appliedQuestOutcomeHookIds).toContain(
      "outcome.sq.act2.deserter_cache.failed",
    );
  });
});
