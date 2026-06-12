import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.ts";
import { resolveNodeEncounterId } from "./nodes.ts";
import type { NodeDef } from "./nodes.ts";

const rng = createRng(1);

const nodeWithConditional: NodeDef = {
  id: "test.node",
  type: "side_route_node",
  title: "Test Node",
  description: "",
  layer: 1,
  encounterId: "encounter.default",
  conditionalEncounterId: {
    "flag.sq.act1.goblin_relic.completed": "encounter.sq.deserter_cache.weakened_patrol",
  },
  nextNodeIds: [],
};

describe("resolveNodeEncounterId — campaignFlags branching", () => {
  it("returns conditional encounter ID when matching flag is present", () => {
    const result = resolveNodeEncounterId(nodeWithConditional, rng, {
      "flag.sq.act1.goblin_relic.completed": "completed",
    });
    expect(result).toBe("encounter.sq.deserter_cache.weakened_patrol");
  });

  it("falls back to encounterId when campaignFlags is empty", () => {
    const result = resolveNodeEncounterId(nodeWithConditional, rng, {});
    expect(result).toBe("encounter.default");
  });

  it("falls back to encounterId when a different flag is set", () => {
    const result = resolveNodeEncounterId(nodeWithConditional, rng, {
      "flag.some_other_flag": "true",
    });
    expect(result).toBe("encounter.default");
  });

  it("returns encounterId when node has no conditionalEncounterId", () => {
    const plainNode: NodeDef = {
      id: "test.plain",
      type: "side_route_node",
      title: "Plain Node",
      description: "",
      layer: 1,
      encounterId: "encounter.default",
      nextNodeIds: [],
    };
    const result = resolveNodeEncounterId(plainNode, rng, {
      "flag.sq.act1.goblin_relic.completed": "completed",
    });
    expect(result).toBe("encounter.default");
  });

  it("behaves identically to existing behavior when campaignFlags is undefined", () => {
    const result = resolveNodeEncounterId(nodeWithConditional, rng);
    expect(result).toBe("encounter.default");
  });
});
