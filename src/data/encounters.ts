export interface EncounterDef {
  id: string;
  displayName: string;
  enemyGroups: { enemyId: string; count: number }[];
  rewardPoolId?: string;
}

export const ENCOUNTER_REGISTRY: Record<string, EncounterDef> = {
  "encounter.road_ambush": {
    id: "encounter.road_ambush",
    displayName: "Road Ambush",
    enemyGroups: [
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
      { enemyId: "enemy.wolf", count: 1 },
    ],
  },
  "encounter.old_graveyard": {
    id: "encounter.old_graveyard",
    displayName: "Old Graveyard",
    enemyGroups: [
      { enemyId: "enemy.skeleton_archer", count: 2 },
      { enemyId: "enemy.wolf", count: 1 },
    ],
  },
  "encounter.bandit_toll": {
    id: "encounter.bandit_toll",
    displayName: "Bandit Toll",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 1 },
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
    ],
  },
  "encounter.cult_ritual": {
    id: "encounter.cult_ritual",
    displayName: "Cult Ritual",
    enemyGroups: [
      { enemyId: "enemy.cult_acolyte", count: 1 },
      { enemyId: "enemy.skeleton_archer", count: 2 },
    ],
    rewardPoolId: "reward.uncommon",
  },
  "encounter.wolf_pack": {
    id: "encounter.wolf_pack",
    displayName: "Ravenous Swarm",
    enemyGroups: [
      { enemyId: "enemy.wolf", count: 3 },
      { enemyId: "enemy.bandit_brute", count: 1 },
    ],
  },
  "encounter.broken_banner_elite": {
    id: "encounter.broken_banner_elite",
    displayName: "Broken Banner Company",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 1 },
      { enemyId: "enemy.cult_acolyte", count: 1 },
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
    ],
    rewardPoolId: "reward.uncommon",
  },
  "encounter.boss_ogre_hexbreaker": {
    id: "encounter.boss_ogre_hexbreaker",
    displayName: "Ogre Hexbreaker",
    enemyGroups: [
      { enemyId: "enemy.ogre_hexbreaker", count: 1 },
    ],
  },
};
