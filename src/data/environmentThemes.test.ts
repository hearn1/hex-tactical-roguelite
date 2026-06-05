import { describe, expect, it } from "vitest";
import type { NodeType } from "./nodes.ts";
import {
  ENVIRONMENT_THEMES,
  getEnvironmentTheme,
  getNodeTypeThemeMap,
  nodeTypeToEnvironmentTheme,
} from "./environmentThemes.ts";

describe("environment themes", () => {
  it("defines multiple complete placeholder 3D themes", () => {
    const themes = Object.values(ENVIRONMENT_THEMES);
    expect(themes.length).toBeGreaterThanOrEqual(2);

    for (const theme of themes) {
      expect(theme.ground.baseColor).toMatch(/^#/);
      expect(theme.ground.tileColor).toMatch(/^#/);
      expect(theme.ground.pattern).toBeTruthy();
      expect(theme.sky.topColor).toMatch(/^#/);
      expect(theme.sky.horizonColor).toMatch(/^#/);
      expect(theme.lighting.ambientIntensity).toBeGreaterThan(0);
      expect(theme.lighting.directionalIntensity).toBeGreaterThan(0);
    }
  });

  it("maps combat node types to differentiated environment themes", () => {
    expect(nodeTypeToEnvironmentTheme("combat")).toBe("forest");
    expect(nodeTypeToEnvironmentTheme("elite")).toBe("dungeon");
    expect(nodeTypeToEnvironmentTheme("boss")).toBe("boss_arena");
    const combatNodeTypes: NodeType[] = ["combat", "elite", "boss"];
    expect(new Set(combatNodeTypes.map((type) => nodeTypeToEnvironmentTheme(type))).size).toBe(3);
  });

  it("keeps every node-type mapping pointed at a defined theme", () => {
    const themeIds = new Set(Object.keys(ENVIRONMENT_THEMES));
    for (const themeId of Object.values(getNodeTypeThemeMap())) {
      expect(themeIds.has(themeId)).toBe(true);
    }
  });

  it("falls back gracefully when an unknown theme id is requested", () => {
    expect(getEnvironmentTheme("missing-theme").id).toBe("forest");
  });
});
