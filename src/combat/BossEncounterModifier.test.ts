// #389 — Tests: boss encounter modifier application

import { describe, it, expect } from "vitest";
import { createCombatFromRun } from "../state/GameState.ts";
import { createRng } from "../core/rng.ts";
import { applyQuestOutcomeHook } from "../run/QuestOutcomeApplicator.ts";
import { createCampaignState } from "../state/CampaignState.ts";
import { createInventory } from "../run/Inventory.ts";
import type { RunState } from "../state/RunState.ts";
import type { RunModifier } from "../state/types.ts";
import type { PartyMember } from "../state/RunState.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePartyMember(): PartyMember {
  return {
    instanceId: "hero.1",
    classId: "class.guardian",
    displayName: "Kael",
    level: 1,
    xp: 0,
    hp: 20,
    maxHp: 20,
    bonusStats: {},
    equippedItemIds: { weapon: null, armor: null, trinket: null },
  };
}

function makeRun(runModifiers: RunModifier[] = []): RunState {
  return {
    seed: 42,
    gold: 0,
    party: [makePartyMember()],
    inventory: createInventory(),
    mapState: { nodes: [], connections: [], currentNodeId: null, visitedNodeIds: [], availableNodeIds: [] },
    runStatus: "active",
    shopStates: {},
    campStates: {},
    recruitOffers: {},
    runModifiers,
    difficulty: "normal",
    eventSelections: {},
  };
}

// ---------------------------------------------------------------------------
// #1 — RunModifier type narrowing
// ---------------------------------------------------------------------------

describe("boss_encounter_modifier — type narrowing (#377)", () => {
  it("TypeScript narrows kind and exposes encounterId, hpMultiplier, damageBonus", () => {
    const mod: RunModifier = {
      kind: "boss_encounter_modifier",
      encounterId: "encounter.boss_ogre_hexbreaker",
      hpMultiplier: 0.8,
      damageBonus: -1,
    };
    if (mod.kind === "boss_encounter_modifier") {
      expect(mod.encounterId).toBe("encounter.boss_ogre_hexbreaker");
      expect(mod.hpMultiplier).toBe(0.8);
      expect(mod.damageBonus).toBe(-1);
    }
  });
});

// ---------------------------------------------------------------------------
// #2 — Boss HP scaled by modifier
// ---------------------------------------------------------------------------

describe("boss_encounter_modifier — HP scaling (#381)", () => {
  it("boss unit starts with maxHp = Math.round(42 * 0.8) = 34 when hpMultiplier 0.8 applied", () => {
    const run = makeRun([
      {
        kind: "boss_encounter_modifier",
        encounterId: "encounter.boss_ogre_hexbreaker",
        hpMultiplier: 0.8,
      },
    ]);
    const combat = createCombatFromRun(run, "encounter.boss_ogre_hexbreaker", createRng(1));
    const boss = combat.units.find((u) => u.defId === "enemy.ogre_hexbreaker");
    expect(boss).toBeDefined();
    expect(boss!.stats.maxHp).toBe(34);
    expect(boss!.hp).toBeLessThanOrEqual(34);
  });

  // ---------------------------------------------------------------------------
  // #3 — Non-matching encounterId is ignored
  // ---------------------------------------------------------------------------

  it("boss starts at full HP when encounterId does not match", () => {
    const run = makeRun([
      {
        kind: "boss_encounter_modifier",
        encounterId: "encounter.boss_goblin_warchief",
        hpMultiplier: 0.8,
      },
    ]);
    const combat = createCombatFromRun(run, "encounter.boss_ogre_hexbreaker", createRng(1));
    const boss = combat.units.find((u) => u.defId === "enemy.ogre_hexbreaker");
    expect(boss).toBeDefined();
    expect(boss!.stats.maxHp).toBe(42);
  });

  // ---------------------------------------------------------------------------
  // #4 — Non-boss units in the same encounter are unaffected
  // ---------------------------------------------------------------------------

  it("non-boss units in the encounter are unaffected by boss modifier", () => {
    const run = makeRun([
      {
        kind: "boss_encounter_modifier",
        encounterId: "encounter.boss_ogre_hexbreaker",
        hpMultiplier: 0.5,
      },
    ]);
    const combat = createCombatFromRun(run, "encounter.boss_ogre_hexbreaker", createRng(1));
    const nonBossEnemies = combat.units.filter((u) => u.team === "enemy" && u.defId !== "enemy.ogre_hexbreaker");
    for (const unit of nonBossEnemies) {
      expect(unit.bonusDamage).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// #5 — Outcome hook applies modifier to campaign
// ---------------------------------------------------------------------------

describe("boss_encounter_modifier — outcome hook application (#385)", () => {
  it("applyQuestOutcomeHook adds boss_encounter_modifier for act1 success", () => {
    const campaign = createCampaignState("campaign.verdant_dark", 42, "normal", [makePartyMember()], createInventory());
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    const bossMod = campaign.runModifiers.find(
      (m) => m.kind === "boss_encounter_modifier" && m.encounterId === "encounter.boss_ogre_hexbreaker",
    );
    expect(bossMod).toBeDefined();
  });

  it("applying the same hook twice is a no-op (idempotency)", () => {
    const campaign = createCampaignState("campaign.verdant_dark", 42, "normal", [makePartyMember()], createInventory());
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    const countBefore = campaign.runModifiers.filter((m) => m.kind === "boss_encounter_modifier").length;
    applyQuestOutcomeHook("outcome.sq.act1.goblin_relic.completed", campaign);
    const countAfter = campaign.runModifiers.filter((m) => m.kind === "boss_encounter_modifier").length;
    expect(countAfter).toBe(countBefore);
  });
});
