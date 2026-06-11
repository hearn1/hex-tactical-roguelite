// #366 — Quest node dispatch tests

import { describe, it, expect } from "vitest";
import { resolveQuestNode } from "./QuestNodeDispatch.ts";
import { initQuestProgress, getQuestState } from "./QuestState.ts";
import type { NodeDef } from "../data/nodes.ts";
import type { QuestProgressMap } from "./QuestState.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// sq.act1.goblin_relic has 2 stages; stage_1 has 2 steps, stage_2 has 1 step.
const ACT_NUMBER = 1;

function makeNode(overrides: Partial<NodeDef>): NodeDef {
  return {
    id: "node.test",
    type: "side_route_start",
    title: "Test",
    description: "",
    layer: 0,
    nextNodeIds: [],
    ...overrides,
  };
}

const START_NODE = makeNode({
  id: "node.sq_start",
  questId: "sq.act1.goblin_relic",
  questNodeRole: "start",
});

const ADVANCE_NODE = makeNode({
  id: "node.sq_advance",
  type: "side_route_node",
  questId: "sq.act1.goblin_relic",
  questNodeRole: "advance",
});

const COMPLETE_NODE = makeNode({
  id: "node.sq_complete",
  type: "side_route_return",
  questId: "sq.act1.goblin_relic",
  questNodeRole: "complete",
  questOutcomeHookId: "outcome.sq.act1.goblin_relic.completed",
});

const FAIL_NODE = makeNode({
  id: "node.sq_fail",
  type: "side_route_return",
  questId: "sq.act1.goblin_relic",
  questNodeRole: "fail",
});

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

describe("resolveQuestNode — start (#366)", () => {
  it("starts the quest on first resolution", () => {
    const p: QuestProgressMap = initQuestProgress();
    resolveQuestNode(START_NODE, p, ACT_NUMBER);
    const state = getQuestState(p, "sq.act1.goblin_relic");
    expect(state?.status).toBe("active");
    expect(state?.currentStageIndex).toBe(0);
    expect(state?.currentStepIndex).toBe(0);
    expect(state?.startedAtActNumber).toBe(ACT_NUMBER);
  });

  it("is idempotent — repeated start on already-active quest has no effect", () => {
    const p: QuestProgressMap = initQuestProgress();
    resolveQuestNode(START_NODE, p, ACT_NUMBER);
    resolveQuestNode(START_NODE, p, ACT_NUMBER);
    expect(Object.keys(p)).toHaveLength(1);
    expect(getQuestState(p, "sq.act1.goblin_relic")?.status).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// advance
// ---------------------------------------------------------------------------

describe("resolveQuestNode — advance (#366)", () => {
  it("advances an active quest to the next step", () => {
    const p: QuestProgressMap = initQuestProgress();
    resolveQuestNode(START_NODE, p, ACT_NUMBER);
    resolveQuestNode(ADVANCE_NODE, p, ACT_NUMBER);
    const state = getQuestState(p, "sq.act1.goblin_relic")!;
    expect(state.currentStageIndex).toBe(0);
    expect(state.currentStepIndex).toBe(1);
  });

  it("is idempotent — advance on non-active quest is a no-op", () => {
    const p: QuestProgressMap = initQuestProgress();
    // Quest never started; advance should do nothing
    resolveQuestNode(ADVANCE_NODE, p, ACT_NUMBER);
    expect(getQuestState(p, "sq.act1.goblin_relic")).toBeUndefined();
  });

  it("second quest node advances to next stage when first stage exhausted", () => {
    const p: QuestProgressMap = initQuestProgress();
    // sq.act1.goblin_relic stage_1 has 2 steps, so two advances exhaust it → stage_2
    resolveQuestNode(START_NODE, p, ACT_NUMBER);  // step 0
    resolveQuestNode(ADVANCE_NODE, p, ACT_NUMBER); // step 0 → 1
    resolveQuestNode(ADVANCE_NODE, p, ACT_NUMBER); // step 1 exhausted → stage 1, step 0
    const state = getQuestState(p, "sq.act1.goblin_relic")!;
    expect(state.currentStageIndex).toBe(1);
    expect(state.currentStepIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// complete
// ---------------------------------------------------------------------------

describe("resolveQuestNode — complete (#366)", () => {
  it("completes an active quest with the specified outcome hook", () => {
    const p: QuestProgressMap = initQuestProgress();
    resolveQuestNode(START_NODE, p, ACT_NUMBER);
    resolveQuestNode(COMPLETE_NODE, p, ACT_NUMBER);
    const state = getQuestState(p, "sq.act1.goblin_relic")!;
    expect(state.status).toBe("completed");
    expect(state.resolvedOutcomeHookId).toBe("outcome.sq.act1.goblin_relic.completed");
    expect(state.resolvedAtActNumber).toBe(ACT_NUMBER);
  });

  it("is idempotent — completing an already-completed quest leaves state unchanged", () => {
    const p: QuestProgressMap = initQuestProgress();
    resolveQuestNode(START_NODE, p, ACT_NUMBER);
    resolveQuestNode(COMPLETE_NODE, p, ACT_NUMBER);
    resolveQuestNode(COMPLETE_NODE, p, 2);
    expect(getQuestState(p, "sq.act1.goblin_relic")?.resolvedAtActNumber).toBe(ACT_NUMBER);
  });

  it("falls back to first outcomeHookId when questOutcomeHookId is absent", () => {
    const nodeNoHook = makeNode({
      id: "node.sq_complete_no_hook",
      type: "side_route_return",
      questId: "sq.act1.goblin_relic",
      questNodeRole: "complete",
    });
    const p: QuestProgressMap = initQuestProgress();
    resolveQuestNode(START_NODE, p, ACT_NUMBER);
    resolveQuestNode(nodeNoHook, p, ACT_NUMBER);
    const state = getQuestState(p, "sq.act1.goblin_relic")!;
    expect(state.status).toBe("completed");
    expect(state.resolvedOutcomeHookId).toBe("outcome.sq.act1.goblin_relic.completed");
  });
});

// ---------------------------------------------------------------------------
// fail
// ---------------------------------------------------------------------------

describe("resolveQuestNode — fail (#366)", () => {
  it("fails an active quest", () => {
    const p: QuestProgressMap = initQuestProgress();
    resolveQuestNode(START_NODE, p, ACT_NUMBER);
    resolveQuestNode(FAIL_NODE, p, ACT_NUMBER);
    const state = getQuestState(p, "sq.act1.goblin_relic")!;
    expect(state.status).toBe("failed");
    expect(state.resolvedAtActNumber).toBe(ACT_NUMBER);
  });
});

// ---------------------------------------------------------------------------
// Main-path and no-op cases
// ---------------------------------------------------------------------------

describe("resolveQuestNode — non-quest nodes are unaffected (#366)", () => {
  it("node without questId is a no-op", () => {
    const p: QuestProgressMap = initQuestProgress();
    const combatNode = makeNode({ id: "node.combat", type: "combat" });
    resolveQuestNode(combatNode, p, ACT_NUMBER);
    expect(Object.keys(p)).toHaveLength(0);
  });

  it("node with questId but missing questNodeRole is a no-op", () => {
    const p: QuestProgressMap = initQuestProgress();
    const partial = makeNode({ questId: "sq.act1.goblin_relic" });
    resolveQuestNode(partial, p, ACT_NUMBER);
    expect(Object.keys(p)).toHaveLength(0);
  });

  it("node referencing an unknown questId is a no-op", () => {
    const p: QuestProgressMap = initQuestProgress();
    const unknown = makeNode({ questId: "sq.nonexistent", questNodeRole: "start" });
    resolveQuestNode(unknown, p, ACT_NUMBER);
    expect(Object.keys(p)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Full chain: start → advance → complete
// ---------------------------------------------------------------------------

describe("resolveQuestNode — full quest chain (#366)", () => {
  it("start → advance → complete produces completed quest", () => {
    const p: QuestProgressMap = initQuestProgress();
    resolveQuestNode(START_NODE, p, ACT_NUMBER);
    resolveQuestNode(ADVANCE_NODE, p, ACT_NUMBER);
    resolveQuestNode(COMPLETE_NODE, p, ACT_NUMBER);
    const state = getQuestState(p, "sq.act1.goblin_relic")!;
    expect(state.status).toBe("completed");
    expect(state.resolvedOutcomeHookId).toBe("outcome.sq.act1.goblin_relic.completed");
  });
});
