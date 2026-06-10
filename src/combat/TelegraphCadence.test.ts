import { describe, it, expect } from "vitest";
import { resolveTelegraphCadence } from "./Traits.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import type { EnemyTraitDef } from "../data/traits.ts";

type TelegraphTrait = Extract<EnemyTraitDef, { id: "boss_ground_slam_telegraph" }>;

function makeTelegraphTrait(
  cadence?: TelegraphTrait["cadence"],
): TelegraphTrait {
  return {
    id: "boss_ground_slam_telegraph",
    actionId: "action.ground_slam",
    thresholdHpPct: 0.5,
    targetPattern: "adjacent",
    cadence,
  };
}

describe("resolveTelegraphCadence (#280)", () => {
  it("defaults a trait with no cadence to once_per_threshold", () => {
    expect(resolveTelegraphCadence(makeTelegraphTrait())).toEqual({
      mode: "once_per_threshold",
    });
  });

  it("resolves the Ogre Hexbreaker's telegraph to rotation_integrated", () => {
    const ogreTelegraph = ENEMY_REGISTRY["enemy.ogre_hexbreaker"].traits?.find(
      (t): t is TelegraphTrait => t.id === "boss_ground_slam_telegraph",
    );
    expect(ogreTelegraph).toBeDefined();
    expect(resolveTelegraphCadence(ogreTelegraph!)).toEqual({
      mode: "rotation_integrated",
    });
  });

  it("returns the declared cooldown cadence when cooldownTurns is positive", () => {
    expect(
      resolveTelegraphCadence(makeTelegraphTrait({ mode: "cooldown", cooldownTurns: 3 })),
    ).toEqual({ mode: "cooldown", cooldownTurns: 3 });
  });

  it("rejects a cooldown cadence with no cooldownTurns", () => {
    expect(() => resolveTelegraphCadence(makeTelegraphTrait({ mode: "cooldown" }))).toThrow(
      /cooldownTurns/,
    );
  });

  it("rejects a cooldown cadence with a non-positive cooldownTurns", () => {
    expect(() =>
      resolveTelegraphCadence(makeTelegraphTrait({ mode: "cooldown", cooldownTurns: 0 })),
    ).toThrow(/cooldownTurns/);
  });
});
