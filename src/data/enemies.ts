import type { UnitStats } from "../state/types.ts";
import type { EnemyTraitDef } from "./traits.ts";

export interface EnemyDef {
  id: string;
  displayName: string;
  aiTag: "brute" | "skirmisher" | "support" | "caster" | "boss" | "ambusher";
  baseStats: UnitStats;
  actionIds: string[];
  traits?: EnemyTraitDef[];
}

export const ENEMY_REGISTRY: Record<string, EnemyDef> = {
  "enemy.goblin_skirmisher": {
    id: "enemy.goblin_skirmisher",
    displayName: "Goblin Skirmisher",
    aiTag: "skirmisher",
    baseStats: { maxHp: 8, armor: 12, move: 4, str: 1, dex: 3, con: 0, int: 0, wis: 0, cha: 0 },
    actionIds: ["action.rusty_stab"],
  },
  "enemy.wolf": {
    id: "enemy.wolf",
    displayName: "Wolf",
    aiTag: "brute",
    baseStats: { maxHp: 10, armor: 12, move: 5, str: 2, dex: 2, con: 1, int: 0, wis: 0, cha: 0 },
    actionIds: ["action.bite"],
  },
  "enemy.skeleton_archer": {
    id: "enemy.skeleton_archer",
    displayName: "Skeleton Archer",
    aiTag: "skirmisher",
    baseStats: { maxHp: 9, armor: 12, move: 3, str: 1, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
    actionIds: ["action.bone_arrow"],
  },
  "enemy.bandit_brute": {
    id: "enemy.bandit_brute",
    displayName: "Bandit Brute",
    aiTag: "brute",
    baseStats: { maxHp: 16, armor: 13, move: 3, str: 3, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
    actionIds: ["action.heavy_club"],
  },
  "enemy.cult_acolyte": {
    id: "enemy.cult_acolyte",
    displayName: "Cult Acolyte",
    aiTag: "support",
    baseStats: { maxHp: 12, armor: 11, move: 3, str: 0, dex: 1, con: 0, int: 2, wis: 2, cha: 0 },
    actionIds: ["action.dark_bolt", "action.minor_heal"],
  },
  "enemy.shadow_stalker": {
    id: "enemy.shadow_stalker",
    displayName: "Shadow Stalker",
    aiTag: "ambusher",
    baseStats: { maxHp: 11, armor: 13, move: 5, str: 2, dex: 4, con: 0, int: 0, wis: 0, cha: 0 },
    actionIds: ["action.ambush_strike"],
  },
  "enemy.goblin_warchief": {
    id: "enemy.goblin_warchief",
    displayName: "Goblin Warchief",
    aiTag: "boss",
    baseStats: { maxHp: 36, armor: 13, move: 3, str: 3, dex: 2, con: 1, int: 1, wis: 0, cha: 2 },
    actionIds: ["action.rusty_stab", "action.heavy_club", "action.roar"],
    traits: [
      {
        id: "boss_action_rotation",
        actionIds: ["action.roar", "action.rusty_stab", "action.heavy_club"],
      },
      {
        id: "boss_reinforcement_at_hp_threshold",
        thresholdHpPct: 0.5,
        enemyId: "enemy.goblin_skirmisher",
        count: 2,
        spawnCandidates: [
          { q: 3, r: -3 },
          { q: 3, r: -2 },
          { q: 3, r: -1 },
          { q: 3, r: 0 },
          { q: 2, r: 1 },
        ],
        logText: "The Warchief shrieks — goblins swarm from the treeline!",
      },
    ],
  },
  "enemy.ogre_warlord": {
    id: "enemy.ogre_warlord",
    displayName: "Ogre Warlord",
    aiTag: "boss",
    baseStats: { maxHp: 52, armor: 14, move: 3, str: 4, dex: 0, con: 3, int: 0, wis: 0, cha: 0 },
    actionIds: ["action.massive_swing", "action.ground_slam", "action.roar"],
    traits: [
      {
        id: "boss_action_rotation",
        actionIds: ["action.roar", "action.massive_swing", "action.ground_slam"],
      },
      {
        id: "boss_ground_slam_telegraph",
        actionId: "action.ground_slam",
        thresholdHpPct: 0.5,
        targetPattern: "adjacent",
        cadence: { mode: "rotation_integrated" },
        warningText: "winds up Ground Slam — every adjacent hex will be struck next turn! Move clear!",
      },
      {
        id: "boss_reinforcement_at_hp_threshold",
        thresholdHpPct: 0.5,
        enemyId: "enemy.skeleton_archer",
        count: 1,
        spawnCandidates: [
          { q: 3, r: -2 },
          { q: 3, r: -1 },
          { q: 3, r: 0 },
        ],
        logText: "The Warlord bellows — a skeleton warrior rises to guard his flank!",
      },
    ],
  },
  "enemy.cult_high_priest": {
    id: "enemy.cult_high_priest",
    displayName: "Cult High Priest",
    aiTag: "boss",
    baseStats: { maxHp: 34, armor: 12, move: 3, str: 0, dex: 1, con: 0, int: 4, wis: 3, cha: 0 },
    actionIds: ["action.dark_bolt", "action.minor_heal", "action.roar"],
    traits: [
      {
        id: "boss_action_rotation",
        actionIds: ["action.roar", "action.dark_bolt", "action.minor_heal"],
      },
    ],
  },
  "enemy.arcane_lord": {
    id: "enemy.arcane_lord",
    displayName: "Arcane Lord",
    aiTag: "boss",
    baseStats: { maxHp: 50, armor: 14, move: 3, str: 2, dex: 0, con: 2, int: 5, wis: 1, cha: 0 },
    actionIds: ["action.dark_bolt", "action.ground_slam", "action.roar"],
    traits: [
      {
        id: "boss_action_rotation",
        actionIds: ["action.roar", "action.dark_bolt", "action.ground_slam"],
      },
      {
        id: "boss_ground_slam_telegraph",
        actionId: "action.ground_slam",
        thresholdHpPct: 0.5,
        targetPattern: "adjacent",
        cadence: { mode: "rotation_integrated" },
        warningText: "channels a Planar Slam — every adjacent hex will be crushed next turn! Move clear!",
      },
    ],
  },
  "enemy.arcane_bodyguard": {
    id: "enemy.arcane_bodyguard",
    displayName: "Arcane Bodyguard",
    aiTag: "brute",
    baseStats: { maxHp: 22, armor: 14, move: 3, str: 4, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
    actionIds: ["action.heavy_club"],
  },
  "enemy.ogre_hexbreaker": {
    id: "enemy.ogre_hexbreaker",
    displayName: "Ogre Hexbreaker",
    aiTag: "boss",
    baseStats: { maxHp: 42, armor: 13, move: 3, str: 4, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
    actionIds: ["action.massive_swing", "action.ground_slam", "action.roar"],
    traits: [
      {
        id: "boss_action_rotation",
        actionIds: ["action.roar", "action.massive_swing", "action.ground_slam"],
      },
      {
        id: "boss_ground_slam_telegraph",
        actionId: "action.ground_slam",
        thresholdHpPct: 0.5,
        targetPattern: "adjacent",
        cadence: { mode: "rotation_integrated" },
        warningText:
          "winds up Ground Slam — every adjacent hex will be struck next turn! Move clear!",
      },
      {
        id: "boss_reinforcement_at_hp_threshold",
        thresholdHpPct: 0.5,
        enemyId: "enemy.skeleton_archer",
        count: 1,
        spawnCandidates: [
          { q: 3, r: -2 },
          { q: 3, r: -1 },
          { q: 3, r: 0 },
          { q: 4, r: -2 },
          { q: 4, r: -1 },
          { q: 4, r: 0 },
        ],
        logText: "The Hexbreaker calls reinforcement — a Skeleton Archer joins!",
      },
    ],
  },
};
