export type SpriteFrameId = "idle" | "attack" | "walk" | "cast" | "hit" | "death";

export interface SpriteFrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpritePalette {
  primary: string;
  secondary: string;
  accent: string;
  shadow: string;
}

export interface SpriteDef {
  id: string;
  displayName: string;
  frameW: number;
  frameH: number;
  sheetColumns: number;
  sheetRows: number;
  scale: number;
  palette: SpritePalette;
  frames: Record<SpriteFrameId, SpriteFrameRect>;
}

const FRAME_W = 32;
const FRAME_H = 32;

function frames(): Record<SpriteFrameId, SpriteFrameRect> {
  return {
    idle: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
    attack: { x: FRAME_W, y: 0, w: FRAME_W, h: FRAME_H },
    walk: { x: 0, y: FRAME_H, w: FRAME_W, h: FRAME_H },
    cast: { x: FRAME_W, y: FRAME_H, w: FRAME_W, h: FRAME_H },
    hit: { x: 0, y: FRAME_H * 2, w: FRAME_W, h: FRAME_H },
    death: { x: FRAME_W, y: FRAME_H * 2, w: FRAME_W, h: FRAME_H },
  };
}

function sprite(
  id: string,
  displayName: string,
  palette: SpritePalette,
  scale: number = 1,
): SpriteDef {
  return {
    id,
    displayName,
    frameW: FRAME_W,
    frameH: FRAME_H,
    sheetColumns: 2,
    sheetRows: 3,
    scale,
    palette,
    frames: frames(),
  };
}

export const SPRITE_REGISTRY: Record<string, SpriteDef> = {
  "class.guardian": sprite("class.guardian", "Guardian", {
    primary: "#5c7cff",
    secondary: "#243b7a",
    accent: "#d8d2a8",
    shadow: "#11182c",
  }),
  "class.acolyte": sprite("class.acolyte", "Acolyte", {
    primary: "#e8dfb5",
    secondary: "#6951c9",
    accent: "#91e6b5",
    shadow: "#241f3d",
  }),
  "class.arcanist": sprite("class.arcanist", "Arcanist", {
    primary: "#6fd7ff",
    secondary: "#1d4370",
    accent: "#f5b8ff",
    shadow: "#101b2a",
  }),
  "class.scout": sprite("class.scout", "Scout", {
    primary: "#6fd58a",
    secondary: "#234d33",
    accent: "#e0c069",
    shadow: "#12241a",
  }),
  "class.fighter": sprite("class.fighter", "Fighter", {
    primary: "#c87b3a",
    secondary: "#5a3018",
    accent: "#d8d2a8",
    shadow: "#201208",
  }),
  "class.rogue": sprite("class.rogue", "Rogue", {
    primary: "#5e4c7a",
    secondary: "#2a1f3d",
    accent: "#c0a060",
    shadow: "#130f1e",
  }),
  "class.cleric": sprite("class.cleric", "Cleric", {
    primary: "#f0e8c8",
    secondary: "#7a5a20",
    accent: "#d4a8ff",
    shadow: "#1e1810",
  }),
  "class.wizard": sprite("class.wizard", "Wizard", {
    primary: "#9b6fff",
    secondary: "#2d1a5a",
    accent: "#6fe8ff",
    shadow: "#100820",
  }),
  "class.ranger": sprite("class.ranger", "Ranger", {
    primary: "#5a9e68",
    secondary: "#253d2a",
    accent: "#c8b46a",
    shadow: "#121e15",
  }),
  "class.druid": sprite("class.druid", "Druid", {
    primary: "#5fa84a",
    secondary: "#2b4f20",
    accent: "#c8e887",
    shadow: "#141f0e",
  }),
  "class.bard": sprite("class.bard", "Bard", {
    primary: "#9b59b6",
    secondary: "#4a1f5a",
    accent: "#f4d03f",
    shadow: "#1a0a24",
  }),
  "class.warlock": sprite("class.warlock", "Warlock", {
    primary: "#4a2a7a",
    secondary: "#1a0a2e",
    accent: "#c060ff",
    shadow: "#0d0618",
  }),
  "class.paladin": sprite("class.paladin", "Paladin", {
    primary: "#d4af37",
    secondary: "#7a5c10",
    accent: "#f0f0e8",
    shadow: "#1c1608",
  }),
  "class.barbarian": sprite("class.barbarian", "Barbarian", {
    primary: "#a03820",
    secondary: "#5a1a08",
    accent: "#d4a060",
    shadow: "#200a04",
  }),
  "class.sorcerer": sprite("class.sorcerer", "Sorcerer", {
    primary: "#e05abf",
    secondary: "#5a1a4a",
    accent: "#f5b8ff",
    shadow: "#1e0818",
  }),
  "class.monk": sprite("class.monk", "Monk", {
    primary: "#5a7a8a",
    secondary: "#2a3a45",
    accent: "#c8d8e0",
    shadow: "#101820",
  }),
  "enemy.goblin_skirmisher": sprite("enemy.goblin_skirmisher", "Goblin Skirmisher", {
    primary: "#7ac86b",
    secondary: "#31572b",
    accent: "#d99a4e",
    shadow: "#172316",
  }),
  "enemy.wolf": sprite("enemy.wolf", "Wolf", {
    primary: "#9aa0aa",
    secondary: "#4a4d55",
    accent: "#f0d08a",
    shadow: "#1e2025",
  }),
  "enemy.skeleton_archer": sprite("enemy.skeleton_archer", "Skeleton Archer", {
    primary: "#d9d0b7",
    secondary: "#746f67",
    accent: "#b46a42",
    shadow: "#26231e",
  }),
  "enemy.bandit_brute": sprite("enemy.bandit_brute", "Bandit Brute", {
    primary: "#c57458",
    secondary: "#5d2f2a",
    accent: "#d7c27a",
    shadow: "#251714",
  }),
  "enemy.cult_acolyte": sprite("enemy.cult_acolyte", "Cult Acolyte", {
    primary: "#b65bd8",
    secondary: "#3b214c",
    accent: "#eb5b7b",
    shadow: "#1f1228",
  }),
  "enemy.shadow_stalker": sprite("enemy.shadow_stalker", "Shadow Stalker", {
    primary: "#4f5871",
    secondary: "#171d2b",
    accent: "#89a7ff",
    shadow: "#090d14",
  }),
  "enemy.ogre_hexbreaker": sprite("enemy.ogre_hexbreaker", "Ogre Hexbreaker", {
    primary: "#8f7759",
    secondary: "#473326",
    accent: "#ffba57",
    shadow: "#211812",
  }, 1.45),
};

export function getSpriteDef(defId: string): SpriteDef | null {
  return SPRITE_REGISTRY[defId] ?? null;
}

export function spriteSheetSize(sprite: SpriteDef): { width: number; height: number } {
  return {
    width: sprite.frameW * sprite.sheetColumns,
    height: sprite.frameH * sprite.sheetRows,
  };
}
