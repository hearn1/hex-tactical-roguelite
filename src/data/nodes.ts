export interface NodeDef {
  id: string;
  type: "start" | "combat" | "elite" | "boss" | "shop" | "camp" | "event" | "recruit";
  title: string;
  description: string;
  layer: number;
  encounterId?: string;
  shopPoolId?: string;
  nextNodeIds: string[];
}

export const NODE_REGISTRY: Record<string, NodeDef> = {
  "node.start": {
    id: "node.start",
    type: "start",
    title: "Roadside Camp",
    description: "Your party gathers at the edge of the haunted wilds.",
    layer: 0,
    nextNodeIds: ["node.combat_a", "node.combat_b"],
  },
  "node.combat_a": {
    id: "node.combat_a",
    type: "combat",
    title: "Ambush on the Old Road",
    description: "Goblins and wolves lurk among the ruins ahead.",
    layer: 1,
    encounterId: "encounter.road_ambush",
    nextNodeIds: ["node.shop_1", "node.event_1"],
  },
  "node.combat_b": {
    id: "node.combat_b",
    type: "combat",
    title: "Graveyard Watch",
    description: "Undead archers patrol the crumbling cemetery.",
    layer: 1,
    encounterId: "encounter.old_graveyard",
    nextNodeIds: ["node.event_1", "node.combat_c"],
  },
  "node.shop_1": {
    id: "node.shop_1",
    type: "shop",
    title: "Traveling Merchant",
    description: "A lantern-lit wagon waits beside the road.",
    layer: 2,
    shopPoolId: "shop.basic",
    nextNodeIds: ["node.camp_1"],
  },
  "node.event_1": {
    id: "node.event_1",
    type: "event",
    title: "Abandoned Shrine",
    description: "A crumbling shrine offers a choice.",
    layer: 2,
    nextNodeIds: ["node.camp_1", "node.recruit_1"],
  },
  "node.combat_c": {
    id: "node.combat_c",
    type: "combat",
    title: "Bandit Toll",
    description: "Brutes demand payment in blood.",
    layer: 2,
    encounterId: "encounter.bandit_toll",
    nextNodeIds: ["node.recruit_1"],
  },
  "node.camp_1": {
    id: "node.camp_1",
    type: "camp",
    title: "Safe Clearing",
    description: "A sheltered spot to rest and recover.",
    layer: 3,
    nextNodeIds: ["node.combat_d"],
  },
  "node.recruit_1": {
    id: "node.recruit_1",
    type: "recruit",
    title: "Friendly Traveler",
    description: "A stranger offers to join your cause.",
    layer: 3,
    nextNodeIds: ["node.combat_d"],
  },
  "node.combat_d": {
    id: "node.combat_d",
    type: "combat",
    title: "Cultist Ritual",
    description: "Cultists summon dark energy beneath the old tower.",
    layer: 4,
    encounterId: "encounter.cult_ritual",
    nextNodeIds: ["node.boss"],
  },
  "node.boss": {
    id: "node.boss",
    type: "boss",
    title: "The Hexbreaker's Lair",
    description: "The Ogre Hexbreaker awaits in the heart of the wilds.",
    layer: 5,
    encounterId: "encounter.boss_ogre_hexbreaker",
    nextNodeIds: [],
  },
};

export const ALL_NODES: NodeDef[] = Object.values(NODE_REGISTRY);
