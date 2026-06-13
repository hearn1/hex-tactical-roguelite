import type { NodeType } from "./nodes.ts";

export type CombatEnvironmentThemeId = "forest" | "dungeon" | "boss_arena" | "camp" | "shop" | "event";

export interface EnvironmentThemeDef {
  id: CombatEnvironmentThemeId;
  displayName: string;
  ground: {
    baseColor: string;
    accentColor: string;
    lineColor: string;
    tileColor: string;
    tileEmissive: string;
    fallbackFill: string;
    pattern: "grass" | "stone" | "arena" | "earth" | "planks" | "mystic";
  };
  sky: {
    topColor: string;
    horizonColor: string;
    bottomColor: string;
  };
  lighting: {
    ambientColor: string;
    ambientIntensity: number;
    directionalColor: string;
    directionalIntensity: number;
  };
}

export const DEFAULT_ENVIRONMENT_THEME_ID: CombatEnvironmentThemeId = "forest";

export const ENVIRONMENT_THEMES: Record<CombatEnvironmentThemeId, EnvironmentThemeDef> = {
  forest: {
    id: "forest",
    displayName: "Forest Overland",
    ground: {
      baseColor: "#314f35",
      accentColor: "#6f8f4e",
      lineColor: "#1b2d20",
      tileColor: "#3f6f3f",
      tileEmissive: "#061006",
      fallbackFill: "rgba(61, 110, 63, 0.5)",
      pattern: "grass",
    },
    sky: {
      topColor: "#476f9f",
      horizonColor: "#aebf8c",
      bottomColor: "#1e3326",
    },
    lighting: {
      ambientColor: "#dcefc2",
      ambientIntensity: 1.25,
      directionalColor: "#fff0ba",
      directionalIntensity: 1.35,
    },
  },
  dungeon: {
    id: "dungeon",
    displayName: "Dungeon Crypt",
    ground: {
      baseColor: "#2f3440",
      accentColor: "#555f70",
      lineColor: "#151923",
      tileColor: "#3b4252",
      tileEmissive: "#04070d",
      fallbackFill: "rgba(55, 62, 78, 0.55)",
      pattern: "stone",
    },
    sky: {
      topColor: "#111827",
      horizonColor: "#283044",
      bottomColor: "#080b12",
    },
    lighting: {
      ambientColor: "#b9c5d8",
      ambientIntensity: 1.0,
      directionalColor: "#f2d28b",
      directionalIntensity: 1.1,
    },
  },
  boss_arena: {
    id: "boss_arena",
    displayName: "Hexbreaker Arena",
    ground: {
      baseColor: "#34221f",
      accentColor: "#9f5535",
      lineColor: "#170b0a",
      tileColor: "#5c3329",
      tileEmissive: "#1f0905",
      fallbackFill: "rgba(105, 50, 36, 0.6)",
      pattern: "arena",
    },
    sky: {
      topColor: "#201322",
      horizonColor: "#8a3f2c",
      bottomColor: "#090507",
    },
    lighting: {
      ambientColor: "#ffc07a",
      ambientIntensity: 0.95,
      directionalColor: "#ff9b54",
      directionalIntensity: 1.55,
    },
  },
  camp: {
    id: "camp",
    displayName: "Warm Camp",
    ground: {
      baseColor: "#4a3f2d",
      accentColor: "#c18a4c",
      lineColor: "#2a2117",
      tileColor: "#6a5234",
      tileEmissive: "#120b04",
      fallbackFill: "rgba(116, 82, 46, 0.5)",
      pattern: "earth",
    },
    sky: {
      topColor: "#384766",
      horizonColor: "#d28a4b",
      bottomColor: "#231a12",
    },
    lighting: {
      ambientColor: "#ffd8a8",
      ambientIntensity: 1.05,
      directionalColor: "#ffb35c",
      directionalIntensity: 1.25,
    },
  },
  shop: {
    id: "shop",
    displayName: "Caravan Shop",
    ground: {
      baseColor: "#5d4632",
      accentColor: "#a16c3b",
      lineColor: "#2f2118",
      tileColor: "#7a5436",
      tileEmissive: "#120905",
      fallbackFill: "rgba(122, 84, 54, 0.52)",
      pattern: "planks",
    },
    sky: {
      topColor: "#253247",
      horizonColor: "#b68b5f",
      bottomColor: "#1a120d",
    },
    lighting: {
      ambientColor: "#f5d2a2",
      ambientIntensity: 1.1,
      directionalColor: "#ffd08a",
      directionalIntensity: 1.2,
    },
  },
  event: {
    id: "event",
    displayName: "Mystic Hollow",
    ground: {
      baseColor: "#263d3b",
      accentColor: "#5bb7a9",
      lineColor: "#122320",
      tileColor: "#315856",
      tileEmissive: "#06110f",
      fallbackFill: "rgba(49, 88, 86, 0.5)",
      pattern: "mystic",
    },
    sky: {
      topColor: "#2c335f",
      horizonColor: "#6ca6a0",
      bottomColor: "#101a21",
    },
    lighting: {
      ambientColor: "#c7fff4",
      ambientIntensity: 1.1,
      directionalColor: "#a8fff1",
      directionalIntensity: 1.15,
    },
  },
};

const NODE_TYPE_THEME_MAP: Record<NodeType, CombatEnvironmentThemeId> = {
  start: "forest",
  combat: "forest",
  elite: "dungeon",
  boss: "boss_arena",
  shop: "shop",
  camp: "camp",
  event: "event",
  recruit: "camp",
  pet: "camp",
  shrine: "event",
  side_route_start: "forest",
  side_route_node: "forest",
  side_route_return: "forest",
};

export function nodeTypeToEnvironmentTheme(
  nodeType: NodeType | null | undefined,
  encounterId?: string,
): CombatEnvironmentThemeId {
  if (nodeType === "boss" || encounterId === "encounter.boss_ogre_hexbreaker") {
    return "boss_arena";
  }
  if (!nodeType) return DEFAULT_ENVIRONMENT_THEME_ID;
  return NODE_TYPE_THEME_MAP[nodeType] ?? DEFAULT_ENVIRONMENT_THEME_ID;
}

export function getEnvironmentTheme(themeId: string | null | undefined): EnvironmentThemeDef {
  return ENVIRONMENT_THEMES[(themeId as CombatEnvironmentThemeId) ?? DEFAULT_ENVIRONMENT_THEME_ID]
    ?? ENVIRONMENT_THEMES[DEFAULT_ENVIRONMENT_THEME_ID];
}

export function getNodeTypeThemeMap(): Record<NodeType, CombatEnvironmentThemeId> {
  return { ...NODE_TYPE_THEME_MAP };
}
