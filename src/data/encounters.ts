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

  // --- Long-template encounters (F26 / #57). Fresh placements composed from the existing
  // enemy roster; coordinate enemy variety with F27 (#58). ---
  "encounter.long_gatehouse": {
    id: "encounter.long_gatehouse",
    displayName: "Ruined Gatehouse",
    enemyGroups: [
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
      { enemyId: "enemy.wolf", count: 1 },
    ],
  },
  "encounter.long_mire_crossing": {
    id: "encounter.long_mire_crossing",
    displayName: "Mire Crossing",
    enemyGroups: [
      { enemyId: "enemy.wolf", count: 2 },
      { enemyId: "enemy.skeleton_archer", count: 1 },
    ],
  },
  "encounter.long_iron_sergeant_elite": {
    id: "encounter.long_iron_sergeant_elite",
    displayName: "The Iron Sergeant",
    enemyGroups: [
      { enemyId: "enemy.bandit_brute", count: 1 },
      { enemyId: "enemy.cult_acolyte", count: 1 },
      { enemyId: "enemy.goblin_skirmisher", count: 2 },
    ],
    rewardPoolId: "reward.uncommon",
  },
  "encounter.long_toll_of_bones": {
    id: "encounter.long_toll_of_bones",
    displayName: "Toll of Bones",
    enemyGroups: [
      { enemyId: "enemy.skeleton_archer", count: 2 },
      { enemyId: "enemy.bandit_brute", count: 1 },
    ],
  },
  "encounter.long_cult_vanguard": {
    id: "encounter.long_cult_vanguard",
    displayName: "Cult Vanguard",
    enemyGroups: [
      { enemyId: "enemy.cult_acolyte", count: 1 },
      { enemyId: "enemy.skeleton_archer", count: 2 },
    ],
    rewardPoolId: "reward.uncommon",
  },
};
