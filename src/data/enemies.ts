import type { UnitStats } from "../state/types.ts";

export interface EnemyDef {
  id: string;
  displayName: string;
  aiTag: "brute" | "skirmisher" | "support" | "caster" | "boss";
  baseStats: UnitStats;
  actionIds: string[];
}

export const ENEMY_REGISTRY: Record<string, EnemyDef> = {
  "enemy.goblin_skirmisher": {
    id: "enemy.goblin_skirmisher",
    displayName: "Goblin Skirmisher",
    aiTag: "skirmisher",
    baseStats: { maxHp: 8, armor: 12, move: 4, might: 1, agility: 3, spirit: 0 },
    actionIds: ["action.rusty_stab"],
  },
  "enemy.wolf": {
    id: "enemy.wolf",
    displayName: "Wolf",
    aiTag: "brute",
    baseStats: { maxHp: 10, armor: 12, move: 5, might: 2, agility: 2, spirit: 0 },
    actionIds: ["action.bite"],
  },
  "enemy.skeleton_archer": {
    id: "enemy.skeleton_archer",
    displayName: "Skeleton Archer",
    aiTag: "skirmisher",
    baseStats: { maxHp: 9, armor: 12, move: 3, might: 1, agility: 2, spirit: 0 },
    actionIds: ["action.bone_arrow"],
  },
  "enemy.bandit_brute": {
    id: "enemy.bandit_brute",
    displayName: "Bandit Brute",
    aiTag: "brute",
    baseStats: { maxHp: 16, armor: 13, move: 3, might: 3, agility: 0, spirit: 0 },
    actionIds: ["action.heavy_club"],
  },
  "enemy.cult_acolyte": {
    id: "enemy.cult_acolyte",
    displayName: "Cult Acolyte",
    aiTag: "support",
    baseStats: { maxHp: 12, armor: 11, move: 3, might: 0, agility: 1, spirit: 3 },
    actionIds: ["action.dark_bolt", "action.minor_heal"],
  },
  "enemy.ogre_hexbreaker": {
    id: "enemy.ogre_hexbreaker",
    displayName: "Ogre Hexbreaker",
    aiTag: "boss",
    baseStats: { maxHp: 42, armor: 13, move: 3, might: 4, agility: 0, spirit: 1 },
    actionIds: ["action.massive_swing", "action.ground_slam", "action.roar"],
  },
};
