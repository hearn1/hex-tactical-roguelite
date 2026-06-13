/**
 * End-to-end seeded campaign smoke path (#496, audit deliverable #7).
 *
 * Unlike the static pool/node-resolution checks in encounterPoolContracts.test.ts, this
 * test exercises the *runtime* campaign flow: it walks each act's real map graph from
 * start node to boss node (via enumerateRootToBossPaths + visitNode), resolves encounters
 * from the act-context pools, transitions between acts, and verifies carry-forward/reset
 * before finally completing the campaign and generating the summary.
 *
 * Covers: Act 1 → Act 4 progression, boss-completion routing, between-act state
 * carry-forward (gold) and reset (HP / downed), final-act victory, win + loss summaries,
 * and full-run determinism under a fixed seed.
 */

import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import { createRunState, buildParty, defaultPartySpecs } from "./PartySetup.ts";
import { createCampaignState } from "../state/CampaignState.ts";
import type { CampaignState } from "../state/CampaignState.ts";
import type { RunState } from "../state/RunState.ts";
import { getMapTemplate, resolveNodeEncounterId, NODE_REGISTRY } from "../data/nodes.ts";
import { ENCOUNTER_REGISTRY } from "../data/encounters.ts";
import { enumerateRootToBossPaths, visitNode } from "./MapGraph.ts";
import {
  advanceToNextAct,
  completeCampaign,
  recordCampaignLoss,
  isActComplete,
  isFinalAct,
} from "./ActTransition.ts";
import { generateCampaignSummary } from "./CampaignSummary.ts";

/** Templates a fresh campaign should traverse, in order — Act 1 default + acts 2–4. */
const EXPECTED_ACT_TEMPLATES = ["act_1_map", "act_2_map", "act_3_map", "act_4_map"];

const GOLD_PER_FIGHT = 10;

/**
 * Walks an act from its start node to its boss along the first real graph path, resolving
 * encounters and tallying clears the way CombatScreen/RewardScreen do. Returns the resolved
 * encounter ids in visit order so callers can assert determinism.
 */
function playActToBoss(run: RunState, campaign: CampaignState, rng: () => number): string[] {
  const template = getMapTemplate(run.mapTemplateId);
  const path = enumerateRootToBossPaths(template)[0];
  expect(path[0]).toBe(template.startNodeId);
  expect(path[path.length - 1]).toBe(template.bossNodeId);

  const encounters: string[] = [];
  for (let i = 1; i < path.length; i++) {
    const nodeId = path[i];
    visitNode(run.mapState, nodeId);
    // visitNode only moves when the edge is real and unvisited — proves the path routes.
    expect(run.mapState.currentNodeId).toBe(nodeId);

    const node = NODE_REGISTRY[nodeId];
    if (node.type !== "combat" && node.type !== "elite" && node.type !== "boss") continue;

    const encounterId = resolveNodeEncounterId(node, rng, campaign.eventSelections);
    expect(encounterId, `${nodeId} resolved encounter`).toBeDefined();
    expect(ENCOUNTER_REGISTRY[encounterId!], `${nodeId} -> ${encounterId}`).toBeDefined();
    encounters.push(encounterId!);

    run.gold += GOLD_PER_FIGHT;
    if (node.type === "boss") {
      run.mapState.bossDefeated = true;
      run.runStatus = "won";
    } else if (node.type === "elite") {
      run.mapState.elitesDefeated++;
    }
    run.mapState.nodesCleared++;
  }
  return encounters;
}

interface CampaignPlaythrough {
  templates: string[];
  encounters: string[];
  summary: ReturnType<typeof generateCampaignSummary>;
}

/** Plays a full, deterministic Act 1 → Act 4 victory campaign for the given seed. */
function playWinningCampaign(seed: number): CampaignPlaythrough {
  const rng = createRng(seed);
  const party = buildParty(defaultPartySpecs());
  // No template argument → production Act-1 default (act_1_map), matching MainMenu/SetupScreen.
  let run = createRunState(party, "normal");
  run.seed = seed;
  const campaign = createCampaignState("campaign.verdant_dark", seed, "normal", run.party, run.inventory);

  expect(campaign.currentActNumber).toBe(1);
  expect(campaign.campaignStatus).toBe("active");

  const templates: string[] = [];
  const encounters: string[] = [];

  for (let act = 1; act <= 4; act++) {
    templates.push(run.mapTemplateId!);

    // Wound the party so the between-act long-rest reset is observable.
    run.party[0].hp = 1;
    if (act === 2) {
      run.party[1].deadForRun = true;
      run.party[1].hp = 0;
    }

    encounters.push(...playActToBoss(run, campaign, rng));
    expect(isActComplete(run)).toBe(true);

    if (isFinalAct(campaign.currentActNumber)) {
      completeCampaign(campaign, run);
    } else {
      const goldBefore = run.gold;
      const prevAct = campaign.currentActNumber;
      run = advanceToNextAct(campaign, run, rng);

      // Carry-forward: gold persists; act counter advances exactly once.
      expect(run.gold).toBe(goldBefore);
      expect(campaign.currentActNumber).toBe(prevAct + 1);
      // Reset: every hero is back to full HP and no longer downed.
      for (const pm of run.party) {
        expect(pm.hp).toBe(pm.maxHp);
        expect(pm.deadForRun).toBeFalsy();
      }
    }
  }

  return { templates, encounters, summary: generateCampaignSummary(campaign) };
}

describe("seeded campaign smoke path (#496)", () => {
  it("progresses Act 1 → Act 4 and resolves a campaign victory summary", () => {
    const { templates, summary } = playWinningCampaign(1337);

    expect(templates).toEqual(EXPECTED_ACT_TEMPLATES);
    expect(summary.campaignResult).toBe("won");
    expect(summary.actsCompleted).toBe(4);
    expect(summary.bossEncountersCompleted).toBe(4);
    expect(summary.finalActReached).toBe(4);
    expect(summary.actBreakdowns).toHaveLength(4);
    expect(summary.battlesWon).toBeGreaterThan(0);
    // Gold accumulated across all four acts carries forward to the final total.
    expect(summary.goldEarned).toBeGreaterThanOrEqual(4 * GOLD_PER_FIGHT);
    for (const act of summary.actBreakdowns) {
      expect(act.runStatus).toBe("won");
      expect(act.bossDefeated).toBe(true);
    }
  });

  it("is fully deterministic for a fixed seed", () => {
    const a = playWinningCampaign(2024);
    const b = playWinningCampaign(2024);
    expect(a.templates).toEqual(b.templates);
    expect(a.encounters).toEqual(b.encounters);
    expect(a.summary).toEqual(b.summary);
  });

  it("records a mid-campaign loss and summarizes the partial run", () => {
    const seed = 99;
    const rng = createRng(seed);
    const party = buildParty(defaultPartySpecs());
    let run = createRunState(party, "normal");
    const campaign = createCampaignState("campaign.verdant_dark", seed, "normal", run.party, run.inventory);

    // Win Act 1, transition into Act 2.
    playActToBoss(run, campaign, rng);
    run = advanceToNextAct(campaign, run, rng);
    expect(campaign.currentActNumber).toBe(2);

    // Partway through Act 2, the party is wiped.
    run.mapState.nodesCleared = 2;
    run.gold += 25;
    run.runStatus = "lost";
    recordCampaignLoss(campaign, run);

    expect(campaign.campaignStatus).toBe("lost");
    expect(campaign.lossActNumber).toBe(2);
    expect(campaign.lossNodeId).toBeDefined();

    const summary = generateCampaignSummary(campaign, run);
    expect(summary.campaignResult).toBe("lost");
    expect(summary.lossActNumber).toBe(2);
    expect(summary.lossNodeId).toBe(run.mapState.currentNodeId);
    expect(summary.finalActReached).toBe(2);
    expect(summary.actsCompleted).toBe(1); // only Act 1 was won
    expect(summary.bossEncountersCompleted).toBe(1);
    expect(summary.actBreakdowns).toHaveLength(2);
    expect(summary.actBreakdowns[1].runStatus).toBe("lost");
  });
});
