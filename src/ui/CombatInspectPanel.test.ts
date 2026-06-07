import { describe, it, expect } from "vitest";
import { buildInspectPanelHtml, aiBehaviorHint, describeCondition } from "./CombatInspectPanel.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import type { UnitInstance } from "../state/types.ts";

function makeEnemy(defId: string, overrides: Partial<UnitInstance> = {}): UnitInstance {
  const def = ENEMY_REGISTRY[defId];
  return {
    instanceId: `inst-${defId}`,
    defId,
    displayName: def.displayName,
    team: "enemy",
    level: 1,
    xp: 0,
    stats: { ...def.baseStats },
    hp: def.baseStats.maxHp,
    pos: { q: 0, r: 0 },
    conditions: [],
    movePointsRemaining: def.baseStats.move,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
    ...overrides,
  };
}

describe("CombatInspectPanel", () => {
  it("renders a readable stat block with name, HP, armor, move and ability scores", () => {
    const html = buildInspectPanelHtml(makeEnemy("enemy.goblin_skirmisher", { hp: 5 }));
    expect(html).toContain("Goblin Skirmisher");
    expect(html).toContain("Skirmisher");
    expect(html).toContain("5/8"); // current/max HP
    expect(html).toContain("Armor</b> 12");
    expect(html).toContain("Move</b> 4");
    expect(html).toContain("Might");
    expect(html).toContain("Agility");
    expect(html).toContain("Spirit");
  });

  it("lists each enemy action with its range and description", () => {
    const html = buildInspectPanelHtml(makeEnemy("enemy.goblin_skirmisher"));
    expect(html).toContain("Rusty Stab");
    expect(html).toContain("Range 1");
    expect(html).toContain("A crude goblin stab.");
  });

  it("shows current conditions with a short description", () => {
    const html = buildInspectPanelHtml(
      makeEnemy("enemy.wolf", { conditions: [{ id: "slowed", remainingTurns: 2 }] }),
    );
    expect(html).toContain("slowed (2)");
    expect(html).toContain(describeCondition("slowed"));
  });

  it("includes the AI behavior hint for the enemy's tag", () => {
    const html = buildInspectPanelHtml(makeEnemy("enemy.shadow_stalker"));
    expect(html).toContain(aiBehaviorHint("ambusher"));
  });

  it("renders the boss behavior hint and an optional intent line", () => {
    const intent = "Winding up Ground Slam — will strike the highlighted hexes next turn.";
    const html = buildInspectPanelHtml(makeEnemy("enemy.ogre_hexbreaker"), intent);
    expect(html).toContain(aiBehaviorHint("boss"));
    expect(html).toContain(intent);
    expect(html).toContain("Intent");
  });

  it("omits the intent section when no intent is supplied", () => {
    const html = buildInspectPanelHtml(makeEnemy("enemy.ogre_hexbreaker"));
    expect(html).not.toContain("Intent");
  });
});
