import { selectEncounterFromPool } from "./encounters.ts";

export interface NodeDef {
  id: string;
  type: "start" | "combat" | "elite" | "boss" | "shop" | "camp" | "event" | "recruit" | "pet";
  title: string;
  description: string;
  layer: number;
  encounterId?: string;
  /**
   * Seeded combat-node pool (F27 / #58). When set, the node draws its encounter from this
   * pool at entry via the shared RNG, so the fight varies per run. `encounterId` (if also
   * present) is the documented default/fallback. Used by standard combat nodes; elite/boss
   * nodes keep a fixed `encounterId`.
   */
  encounterPoolId?: string;
  shopPoolId?: string;
  /** Curated event pool for this node (L2). Falls back to the default shared pool when absent. */
  eventPoolId?: string;
  /** Pins a specific event to this node, overriding pool selection (for signature scenes). */
  eventId?: string;
  nextNodeIds: string[];
}

/** A self-contained act map: an ordered set of nodes from a single start to a single boss. */
export interface MapTemplate {
  id: string;
  name: string;
  startNodeId: string;
  bossNodeId: string;
  nodes: NodeDef[];
}

/**
 * "short" template — the original compact prototype graph. Kept selectable for fast
 * dev/testing flows and as a stable target for the legacy integration fixtures.
 */
const SHORT_NODES: NodeDef[] = [
  {
    id: "node.start",
    type: "start",
    title: "Roadside Camp",
    description: "Your party gathers at the edge of the haunted wilds.",
    layer: 0,
    nextNodeIds: ["node.combat_a", "node.combat_b"],
  },
  {
    id: "node.combat_a",
    type: "combat",
    title: "Ambush on the Old Road",
    description: "Goblins and wolves lurk among the ruins ahead.",
    layer: 1,
    encounterId: "encounter.road_ambush",
    encounterPoolId: "pool.standard_combat",
    nextNodeIds: ["node.shop_1", "node.event_1"],
  },
  {
    id: "node.combat_b",
    type: "combat",
    title: "Graveyard Watch",
    description: "Undead archers patrol the crumbling cemetery.",
    layer: 1,
    encounterId: "encounter.old_graveyard",
    encounterPoolId: "pool.standard_combat",
    nextNodeIds: ["node.event_1", "node.combat_c", "node.combat_wolves"],
  },
  {
    id: "node.shop_1",
    type: "shop",
    title: "Traveling Merchant",
    description: "A lantern-lit wagon waits beside the road.",
    layer: 2,
    shopPoolId: "shop.basic",
    nextNodeIds: ["node.camp_1"],
  },
  {
    id: "node.event_1",
    type: "event",
    title: "Abandoned Shrine",
    description: "A crumbling shrine offers a choice.",
    layer: 2,
    nextNodeIds: ["node.camp_1", "node.recruit_1", "node.elite_1"],
  },
  {
    id: "node.combat_wolves",
    type: "combat",
    title: "Ravenous Swarm",
    description: "Wolves and brutes prowl the forest path.",
    layer: 2,
    encounterId: "encounter.wolf_pack",
    encounterPoolId: "pool.standard_combat",
    nextNodeIds: ["node.recruit_1"],
  },
  {
    id: "node.combat_c",
    type: "combat",
    title: "Bandit Toll",
    description: "Brutes demand payment in blood.",
    layer: 2,
    encounterId: "encounter.bandit_toll",
    encounterPoolId: "pool.standard_combat",
    nextNodeIds: ["node.recruit_1", "node.combat_wolves"],
  },
  {
    id: "node.elite_1",
    type: "elite",
    title: "Broken Banner",
    description: "A disciplined warband blocks the pass.",
    layer: 3,
    encounterId: "encounter.broken_banner_elite",
    nextNodeIds: ["node.combat_d"],
  },
  {
    id: "node.camp_1",
    type: "camp",
    title: "Safe Clearing",
    description: "A sheltered spot to rest and recover.",
    layer: 3,
    nextNodeIds: ["node.combat_d"],
  },
  {
    id: "node.recruit_1",
    type: "recruit",
    title: "Friendly Traveler",
    description: "A stranger offers to join your cause.",
    layer: 3,
    nextNodeIds: ["node.combat_d"],
  },
  {
    id: "node.combat_d",
    type: "combat",
    title: "Cultist Ritual",
    description: "Cultists summon dark energy beneath the old tower.",
    layer: 4,
    encounterId: "encounter.cult_ritual",
    encounterPoolId: "pool.standard_combat",
    nextNodeIds: ["node.boss"],
  },
  {
    id: "node.boss",
    type: "boss",
    title: "The Hexbreaker's Lair",
    description: "The Ogre Hexbreaker awaits in the heart of the wilds.",
    layer: 5,
    encounterId: "encounter.boss_ogre_hexbreaker",
    nextNodeIds: [],
  },
];

/**
 * "long" template - the expanded single-act expedition (#95). Fifteen nodes across the
 * haunted wilds with multiple meaningful branch points. Structural invariants (verified by tests in
 * MapGraph.test.ts):
 *   - The boss is reachable from every valid path.
 *   - `node.long_camp_a` and `node.long_camp_b` are cut vertices, so every root->boss path
 *     crosses both recovery segment boundaries.
 *   - The elite (`node.long_elite_a`) sits on an optional, skippable high-risk branch.
 * Fresh encounters are authored below in encounters.ts (`encounter.long_*`); per the
 * resolved plan they compose the existing enemy roster pending larger content packs.
 */
const LONG_NODES: NodeDef[] = [
  {
    id: "node.long_start",
    type: "start",
    title: "Wayfarer's Rest",
    description: "The party sets out into the depths of the haunted wilds.",
    layer: 0,
    nextNodeIds: ["node.long_combat_a", "node.long_combat_b"],
  },
  // Layer 1 - opening branch: a direct road fight or a mire route.
  {
    id: "node.long_combat_a",
    type: "combat",
    title: "Ruined Gatehouse",
    description: "Goblin raiders have barricaded the old gate.",
    layer: 1,
    encounterId: "encounter.long_gatehouse",
    nextNodeIds: ["node.long_shop_a", "node.long_combat_c"],
  },
  {
    id: "node.long_combat_b",
    type: "combat",
    title: "Mire Crossing",
    description: "Wolves harry travelers at the boggy ford.",
    layer: 1,
    encounterId: "encounter.long_mire_crossing",
    nextNodeIds: ["node.long_shop_a", "node.long_combat_c"],
  },
  // Layer 2 - optional early skirmish feeding the supply hub.
  {
    id: "node.long_combat_c",
    type: "combat",
    title: "Toll of Bones",
    description: "Skeletal sentries demand a grim toll from anyone leaving the mire.",
    layer: 2,
    encounterId: "encounter.long_toll_of_bones",
    nextNodeIds: ["node.long_shop_a"],
  },
  {
    id: "node.long_combat_d",
    type: "combat",
    title: "Thornwood Pursuit",
    description: "A fast raiding pack tries to drive the party away from the old trail.",
    layer: 5,
    encounterId: "encounter.long_thornwood_pursuit",
    encounterPoolId: "pool.long_combat",
    nextNodeIds: ["node.long_event_a"],
  },
  // Layer 3 - guaranteed supply hub: every path converges here.
  {
    id: "node.long_shop_a",
    type: "shop",
    title: "Crossroads Caravan",
    description: "A well-stocked caravan trades with passing wanderers.",
    layer: 3,
    shopPoolId: "shop.basic",
    nextNodeIds: ["node.long_camp_a"],
  },
  // Layer 6 - event beat between the middle fights.
  {
    id: "node.long_event_a",
    type: "event",
    title: "Weathered Waystone",
    description: "An old waystone hums with faded magic.",
    layer: 6,
    nextNodeIds: ["node.long_combat_f"],
  },
  {
    id: "node.long_combat_e",
    type: "combat",
    title: "Cult Vanguard",
    description: "The Hexbreaker's cultists make a desperate stand among broken idols.",
    layer: 5,
    encounterId: "encounter.long_cult_vanguard",
    encounterPoolId: "pool.long_combat",
    nextNodeIds: ["node.long_event_a"],
  },
  // Layer 4 - guaranteed recovery and first segment boundary.
  {
    id: "node.long_camp_a",
    type: "camp",
    title: "Sheltered Hollow",
    description: "A defensible hollow splits the journey into a new leg.",
    layer: 4,
    nextNodeIds: ["node.long_combat_d", "node.long_combat_e"],
  },
  // Layers 7-10 - final approach, including the second camp and optional elite.
  {
    id: "node.long_combat_f",
    type: "combat",
    title: "Blackwater Ford",
    description: "Archers and wolves wait where the black stream cuts the road.",
    layer: 7,
    encounterId: "encounter.long_blackwater_ford",
    encounterPoolId: "pool.long_combat",
    nextNodeIds: ["node.long_combat_g"],
  },
  {
    id: "node.long_camp_b",
    type: "camp",
    title: "Last Lantern Camp",
    description: "A wind-bent lantern marks the final safe ground before the lair.",
    layer: 9,
    nextNodeIds: ["node.long_combat_h", "node.long_elite_a"],
  },
  {
    id: "node.long_combat_g",
    type: "combat",
    title: "Ashen Lookout",
    description: "A hilltop watch has spotted the party's approach.",
    layer: 8,
    encounterId: "encounter.long_ashen_lookout",
    encounterPoolId: "pool.long_combat",
    nextNodeIds: ["node.long_camp_b"],
  },
  {
    id: "node.long_elite_a",
    type: "elite",
    title: "The Iron Sergeant",
    description: "A scarred veteran and her honor guard bar the direct route. (Optional, high risk.)",
    layer: 10,
    encounterId: "encounter.long_iron_sergeant_elite",
    nextNodeIds: ["node.long_combat_h"],
  },
  {
    id: "node.long_combat_h",
    type: "combat",
    title: "Hexscar Patrol",
    description: "The Hexbreaker's outer guards circle the cracked stone road.",
    layer: 10,
    encounterId: "encounter.long_hexscar_patrol",
    encounterPoolId: "pool.long_combat",
    nextNodeIds: ["node.long_boss"],
  },
  // Layer 11 - the boss.
  {
    id: "node.long_boss",
    type: "boss",
    title: "The Hexbreaker's Lair",
    description: "The Ogre Hexbreaker awaits in the heart of the wilds.",
    layer: 11,
    encounterId: "encounter.boss_ogre_hexbreaker",
    nextNodeIds: [],
  },
];

export const MAP_TEMPLATES: Record<string, MapTemplate> = {
  short: {
    id: "short",
    name: "Quick Expedition",
    startNodeId: "node.start",
    bossNodeId: "node.boss",
    nodes: SHORT_NODES,
  },
  long: {
    id: "long",
    name: "The Haunted Wilds",
    startNodeId: "node.long_start",
    bossNodeId: "node.long_boss",
    nodes: LONG_NODES,
  },
};

/** Template assigned to freshly-created runs. */
export const DEFAULT_MAP_TEMPLATE_ID = "long";
/** Fallback used when a run does not specify a template (legacy short-map fixtures). */
export const FALLBACK_MAP_TEMPLATE_ID = "short";

/**
 * Merged lookup across all templates. Node IDs are globally unique, so navigation and
 * validation can resolve any node by id regardless of the active template.
 */
export const NODE_REGISTRY: Record<string, NodeDef> = {};
for (const template of Object.values(MAP_TEMPLATES)) {
  for (const node of template.nodes) {
    NODE_REGISTRY[node.id] = node;
  }
}

export const ALL_NODES: NodeDef[] = Object.values(NODE_REGISTRY);

/** Resolves the active template for a run, falling back to the short prototype graph. */
export function getMapTemplate(id: string | undefined): MapTemplate {
  if (id && MAP_TEMPLATES[id]) return MAP_TEMPLATES[id];
  return MAP_TEMPLATES[FALLBACK_MAP_TEMPLATE_ID];
}

/**
 * Resolves which encounter a node launches. Combat nodes with an `encounterPoolId` draw a
 * seeded pick from that pool (using the shared RNG); otherwise the fixed `encounterId` is
 * used. Returns `undefined` only for nodes that declare neither (non-combat nodes).
 */
export function resolveNodeEncounterId(node: NodeDef, rng: () => number): string | undefined {
  if (node.encounterPoolId) return selectEncounterFromPool(node.encounterPoolId, rng);
  return node.encounterId;
}
