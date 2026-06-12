import { selectEncounterFromPool } from "./encounters.ts";

export interface NodeDef {
  id: string;
  type: NodeType;
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
  /**
   * For side_route_return nodes: the main-branch node this route rejoins.
   * Must equal the single entry in nextNodeIds for return nodes; kept as metadata
   * so callers can distinguish return edges from ordinary forward edges.
   */
  returnNodeId?: string;
  /** True when this node is an optional detour (shops, camps, side routes) off the critical path. */
  optional?: boolean;
  /** Lightweight presentation coordinates — graph logic must not depend on these. */
  layout?: { x: number; y: number };

  // ── Side quest chain metadata (#364) ────────────────────────────────────────
  /** Side quest this node participates in. Matches SideQuestDefinition.id. */
  questId?: string;
  /** Stage id within the quest that this node is associated with (metadata/validation). */
  questStageId?: string;
  /** Step id within the stage that this node is associated with (metadata/validation). */
  questStepId?: string;
  /**
   * What this node does to quest state when completed:
   * - "start"    — opens the quest (idempotent if already active)
   * - "advance"  — moves the quest to the next step/stage
   * - "complete" — resolves the quest as completed (requires questOutcomeHookId)
   * - "fail"     — resolves the quest as failed
   */
  questNodeRole?: "start" | "advance" | "complete" | "fail";
  /** Outcome hook id to fire on "complete" nodes. Must be in SideQuestDefinition.outcomeHookIds. */
  questOutcomeHookId?: string;
  /**
   * Flag-gated encounter overrides for this node. Maps campaignFlag key → encounterId.
   * At runtime, `resolveNodeEncounterId` checks each flag against campaign.eventSelections;
   * the first match wins and overrides `encounterId`. Falls back to `encounterId` when no
   * flag matches or when no campaign context is available.
   */
  conditionalEncounterId?: Record<string, string>;
}

export type NodeType =
  | "start"
  | "combat"
  | "elite"
  | "boss"
  | "shop"
  | "camp"
  | "event"
  | "recruit"
  | "pet"
  | "shrine"
  | "side_route_start"
  | "side_route_node"
  | "side_route_return";

/** A self-contained act map: an ordered set of nodes from a single start to a single boss. */
export interface MapTemplate {
  id: string;
  name: string;
  startNodeId: string;
  bossNodeId: string;
  nodes: NodeDef[];
  /** Campaign this template belongs to. Used for generic act-routing lookups. */
  campaignId?: string;
  /** Act this template covers ("act_1" … "act_4"). */
  actId?: string;
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

// ---------------------------------------------------------------------------
// Canonical Act 1 map template (#344).
// 15 nodes across 7 layers with one side-route mini-act (Captured Merchant Trail).
// Branch structure: two opening combat paths → event/combat mid-layer →
// shop/shrine/combat convergence → camp gate → optional elite → combat → boss.
// ---------------------------------------------------------------------------

const ACT_1_NODES: NodeDef[] = [
  {
    id: "node.a1_start",
    type: "start",
    title: "Verdant Frontier",
    description: "The party sets out from the last safe settlement into the threatened wilds.",
    layer: 0,
    nextNodeIds: ["node.a1_combat_a", "node.a1_combat_b"],
  },
  {
    id: "node.a1_combat_a",
    type: "combat",
    title: "Goblin Ambush",
    description: "Raiders surge from the treeline along the old road.",
    layer: 1,
    encounterId: "encounter.road_ambush",
    encounterPoolId: "pool.act_1_combat",
    nextNodeIds: ["node.a1_event_a", "node.a1_combat_c"],
  },
  {
    id: "node.a1_combat_b",
    type: "combat",
    title: "Mire Patrol",
    description: "Wolves harry the boggy shortcut through the fens.",
    layer: 1,
    encounterId: "encounter.long_mire_crossing",
    encounterPoolId: "pool.act_1_combat",
    nextNodeIds: ["node.a1_event_a", "node.a1_combat_c"],
  },
  {
    id: "node.a1_event_a",
    type: "event",
    title: "Abandoned Waypost",
    description: "A weathered signpost marks a crossroads of uncertain paths.",
    layer: 2,
    nextNodeIds: ["node.a1_shop_a", "node.a1_shrine_a", "node.a1_combat_d"],
  },
  {
    id: "node.a1_combat_c",
    type: "combat",
    title: "Toll Bridge Brutes",
    description: "Bandits demand blood payment at the narrow crossing.",
    layer: 2,
    encounterId: "encounter.bandit_toll",
    encounterPoolId: "pool.act_1_combat",
    nextNodeIds: ["node.a1_shop_a", "node.a1_shrine_a", "node.a1_combat_d"],
  },
  {
    id: "node.a1_shop_a",
    type: "shop",
    title: "Traveling Merchant",
    description: "A cautious merchant trades from a fortified wagon.",
    layer: 3,
    shopPoolId: "shop.basic",
    optional: true,
    nextNodeIds: ["node.a1_camp_a"],
  },
  {
    id: "node.a1_shrine_a",
    type: "shrine",
    title: "Mossy War-Shrine",
    description: "An ancient shrine hums with faded protective magic.",
    layer: 3,
    optional: true,
    nextNodeIds: ["node.a1_camp_a", "node.a1_side1_start"],
  },
  {
    id: "node.a1_combat_d",
    type: "combat",
    title: "Cultist Outriders",
    description: "Robed soldiers guard the road into the deeper wilds.",
    layer: 3,
    encounterId: "encounter.cult_ritual",
    encounterPoolId: "pool.act_1_combat",
    nextNodeIds: ["node.a1_camp_a"],
  },
  // Side route: Captured Merchant Trail → sq.act1.goblin_relic (start→advance→complete)
  {
    id: "node.a1_side1_start",
    type: "side_route_start",
    title: "Captured Merchant Trail",
    description: "Cries from the undergrowth hint at prisoners nearby.",
    layer: 4,
    optional: true,
    nextNodeIds: ["node.a1_side1_combat"],
    questId: "sq.act1.goblin_relic",
    questStageId: "sq.act1.goblin_relic.stage_1",
    questStepId: "sq.act1.goblin_relic.stage_1.step_1",
    questNodeRole: "start",
  },
  {
    id: "node.a1_side1_combat",
    type: "side_route_node",
    title: "Bandit Camp Raid",
    description: "A hidden camp holds captives under armed guard.",
    layer: 5,
    encounterId: "encounter.bandit_toll",
    encounterPoolId: "pool.act_1_combat",
    nextNodeIds: ["node.a1_side1_puzzle"],
    questId: "sq.act1.goblin_relic",
    questStageId: "sq.act1.goblin_relic.stage_1",
    questStepId: "sq.act1.goblin_relic.stage_1.step_2",
    questNodeRole: "advance",
  },
  {
    id: "node.a1_side1_puzzle",
    type: "side_route_node",
    title: "Carved Inscription",
    description: "A stone slab near the relic bears carved runes.",
    layer: 6,
    eventId: "event.sq.goblin_relic.inscription_puzzle",
    nextNodeIds: ["node.a1_side1_return"],
    questId: "sq.act1.goblin_relic",
    questStageId: "sq.act1.goblin_relic.stage_2",
    questStepId: "sq.act1.goblin_relic.stage_2.step_1",
    questNodeRole: "advance",
  },
  {
    id: "node.a1_side1_return",
    type: "side_route_return",
    title: "Freed Captives",
    description: "The rescued merchants share supplies before parting ways.",
    layer: 7,
    returnNodeId: "node.a1_camp_a",
    nextNodeIds: ["node.a1_camp_a"],
    questId: "sq.act1.goblin_relic",
    questNodeRole: "complete",
    questOutcomeHookId: "outcome.sq.act1.goblin_relic.completed",
  },
  {
    id: "node.a1_camp_a",
    type: "camp",
    title: "Sheltered Hollow",
    description: "A defensible clearing offers rest before the final approach.",
    layer: 7,
    nextNodeIds: ["node.a1_combat_e", "node.a1_elite_a"],
  },
  {
    id: "node.a1_elite_a",
    type: "elite",
    title: "Warband Commander",
    description: "A scarred officer leads a disciplined warband. (Optional, high risk.)",
    layer: 8,
    encounterId: "encounter.broken_banner_elite",
    optional: true,
    nextNodeIds: ["node.a1_combat_e"],
  },
  {
    id: "node.a1_combat_e",
    type: "combat",
    title: "Primal Heart Sentinels",
    description: "The primal source's guardian force holds the threshold.",
    layer: 9,
    encounterId: "encounter.long_hexscar_patrol",
    encounterPoolId: "pool.act_1_combat",
    nextNodeIds: ["node.a1_boss"],
  },
  {
    id: "node.a1_boss",
    type: "boss",
    title: "The Verdant Heart",
    description: "The primal force driving the goblin surge pulses at the center of the wilds.",
    layer: 10,
    encounterId: "encounter.boss_goblin_warchief",
    nextNodeIds: [],
  },
];

// ---------------------------------------------------------------------------
// Canonical Act 2 map template (#344).
// 17 nodes. The warlord's fortified pass with ogre-deserter side route.
// ---------------------------------------------------------------------------

const ACT_2_NODES: NodeDef[] = [
  {
    id: "node.act2_start",
    type: "start",
    title: "The Iron Gate",
    description: "The party reaches the fortified mountain pass.",
    layer: 0,
    nextNodeIds: ["node.act2_combat_a", "node.act2_event_a"],
  },
  {
    id: "node.act2_combat_a",
    type: "combat",
    title: "Pass Defenders",
    description: "The warlord's vanguard holds the outer gate.",
    layer: 1,
    encounterId: "encounter.road_ambush",
    encounterPoolId: "pool.act_2_combat",
    nextNodeIds: ["node.act2_combat_b", "node.act2_shop_a"],
  },
  {
    id: "node.act2_event_a",
    type: "event",
    title: "Ogre Deserter",
    description: "A weary ogre soldier offers intel about the keep's layout.",
    layer: 1,
    nextNodeIds: ["node.act2_relic_echo", "node.act2_combat_b", "node.act2_shop_a"],
  },
  {
    id: "node.act2_relic_echo",
    type: "event",
    title: "Messenger on the Pass Road",
    description: "A hooded courier awaits your party at a rocky outcrop along the pass.",
    layer: 2,
    optional: true,
    eventId: "event.sq.act1.goblin_relic.echo",
    nextNodeIds: ["node.act2_combat_b", "node.act2_shop_a"],
  },
  {
    id: "node.act2_combat_b",
    type: "combat",
    title: "Siege Platform",
    description: "Archers and brutes hold the elevated firing positions.",
    layer: 2,
    encounterId: "encounter.long_gatehouse",
    encounterPoolId: "pool.act_2_combat",
    nextNodeIds: ["node.act2_elite_a", "node.act2_combat_c"],
  },
  {
    id: "node.act2_shop_a",
    type: "shop",
    title: "Black Market Stockpile",
    description: "Contraband salvage from fallen soldiers lines a hidden alcove.",
    layer: 2,
    shopPoolId: "shop.basic",
    optional: true,
    nextNodeIds: ["node.act2_elite_a", "node.act2_combat_c"],
  },
  {
    id: "node.act2_elite_a",
    type: "elite",
    title: "The Iron Prefect",
    description: "The warlord's disciplinarian and his honor guard bar the inner gate.",
    layer: 3,
    encounterId: "encounter.long_iron_sergeant_elite",
    nextNodeIds: ["node.act2_camp_a"],
  },
  {
    id: "node.act2_combat_c",
    type: "combat",
    title: "Undead Pickets",
    description: "Risen soldiers guard the necromancer's wing of the keep.",
    layer: 3,
    encounterId: "encounter.old_graveyard",
    encounterPoolId: "pool.act_2_combat",
    nextNodeIds: ["node.act2_camp_a"],
  },
  {
    id: "node.act2_camp_a",
    type: "camp",
    title: "Captured Barracks",
    description: "A cleared barracks room offers a brief respite.",
    layer: 4,
    nextNodeIds: ["node.act2_combat_d", "node.act2_shrine_a", "node.act2_side1_start"],
  },
  {
    id: "node.act2_shrine_a",
    type: "shrine",
    title: "Soldier's Offering Stone",
    description: "An old shrine in the keep's courtyard still holds power.",
    layer: 5,
    optional: true,
    nextNodeIds: ["node.act2_combat_e", "node.act2_event_b"],
  },
  {
    id: "node.act2_combat_d",
    type: "combat",
    title: "Courtyard Garrison",
    description: "The remaining garrison makes a desperate stand.",
    layer: 5,
    encounterId: "encounter.long_blackwater_ford",
    encounterPoolId: "pool.act_2_combat",
    nextNodeIds: ["node.act2_combat_e", "node.act2_event_b"],
  },
  // Side route: Ogre Deserter Route → sq.act2.deserter_cache (start→advance→advance→complete)
  {
    id: "node.act2_side1_start",
    type: "side_route_start",
    title: "Deserter's Hidden Pass",
    description: "The ogre deserter's secret route cuts through the keep's undercroft.",
    layer: 5,
    optional: true,
    nextNodeIds: ["node.act2_side1_event"],
    questId: "sq.act2.deserter_cache",
    questStageId: "sq.act2.deserter_cache.stage_1",
    questStepId: "sq.act2.deserter_cache.stage_1.step_1",
    questNodeRole: "start",
  },
  {
    id: "node.act2_side1_event",
    type: "side_route_node",
    title: "Undercroft Discovery",
    description: "The hidden passage reveals the keep's dark secrets.",
    layer: 6,
    nextNodeIds: ["node.act2_side1_combat"],
    questId: "sq.act2.deserter_cache",
    questStageId: "sq.act2.deserter_cache.stage_1",
    questStepId: "sq.act2.deserter_cache.stage_1.step_2",
    questNodeRole: "advance",
  },
  {
    id: "node.act2_side1_combat",
    type: "side_route_node",
    title: "Shadow Guard Ambush",
    description: "The keep's hidden sentinels spring an ambush in the dark.",
    layer: 7,
    encounterId: "encounter.bandit_toll",
    encounterPoolId: "pool.act_2_combat",
    conditionalEncounterId: {
      "flag.sq.act1.goblin_relic.completed": "encounter.sq.deserter_cache.weakened_patrol",
    },
    nextNodeIds: ["node.a2_side1_puzzle"],
    questId: "sq.act2.deserter_cache",
    questStageId: "sq.act2.deserter_cache.stage_2",
    questStepId: "sq.act2.deserter_cache.stage_2.step_1",
    questNodeRole: "advance",
  },
  {
    id: "node.a2_side1_puzzle",
    type: "side_route_node",
    title: "Locked Supply Cache",
    description: "A heavy iron lock secures a chest left behind in the deserters' camp.",
    layer: 8,
    eventId: "event.sq.deserter_cache.locked_chest",
    nextNodeIds: ["node.act2_side1_return"],
    questId: "sq.act2.deserter_cache",
    questNodeRole: "advance",
  },
  {
    id: "node.act2_side1_return",
    type: "side_route_return",
    title: "Undercroft Exit",
    description: "The passage emerges behind the main keep's inner defenses.",
    layer: 9,
    returnNodeId: "node.act2_combat_e",
    nextNodeIds: ["node.act2_combat_e"],
    questId: "sq.act2.deserter_cache",
    questNodeRole: "complete",
    questOutcomeHookId: "outcome.sq.act2.deserter_cache.cache_secured",
  },
  {
    id: "node.act2_event_b",
    type: "event",
    title: "Warlord's War Room",
    description: "Captured battle plans reveal the alliance's true scope.",
    layer: 9,
    nextNodeIds: ["node.act2_boss"],
  },
  {
    id: "node.act2_combat_e",
    type: "combat",
    title: "Inner Keep Defenders",
    description: "Elite soldiers make a last stand at the throne room door.",
    layer: 9,
    encounterId: "encounter.long_ashen_lookout",
    encounterPoolId: "pool.act_2_combat",
    nextNodeIds: ["node.act2_boss"],
  },
  {
    id: "node.act2_boss",
    type: "boss",
    title: "The Warlord's Keep",
    description: "The ogre warlord and necromancer lieutenant take the field.",
    layer: 10,
    encounterId: "encounter.boss_ogre_warlord",
    nextNodeIds: [],
  },
];

const ACT_2_ALT_NODES: NodeDef[] = [
  {
    id: "node.act2_alt_start",
    type: "start",
    title: "The Deserter's Trail",
    description: "A hidden path offered by an ogre deserter.",
    layer: 0,
    nextNodeIds: ["node.act2_alt_relic_echo", "node.act2_alt_boss"],
  },
  {
    id: "node.act2_alt_relic_echo",
    type: "event",
    title: "Messenger on the Pass Road",
    description: "A hooded courier awaits your party at a rocky outcrop along the pass.",
    layer: 1,
    optional: true,
    eventId: "event.sq.act1.goblin_relic.echo",
    nextNodeIds: ["node.act2_alt_boss"],
  },
  {
    id: "node.act2_alt_boss",
    type: "boss",
    title: "The Warlord's Keep (Alternate Route)",
    description: "The deserter's path reaches the same final confrontation.",
    layer: 2,
    encounterId: "encounter.boss_ogre_warlord",
    nextNodeIds: [],
  },
];

// ---------------------------------------------------------------------------
// Canonical Act 3 map template (#345).
// 21 nodes. The cult's scarred reach with prisoner-rescue and ancient-tomb side routes.
// ---------------------------------------------------------------------------

const ACT_3_NODES: NodeDef[] = [
  {
    id: "node.act3_start",
    type: "start",
    title: "The Scarred Reach",
    description: "The cult's territory stretches across ruined, ashen land.",
    layer: 0,
    nextNodeIds: ["node.act3_combat_a", "node.act3_combat_b", "node.act3_event_a"],
  },
  {
    id: "node.act3_combat_a",
    type: "combat",
    title: "Cult Vanguard",
    description: "Cultist cells guard the outer approach.",
    layer: 1,
    encounterId: "encounter.cult_ritual",
    encounterPoolId: "pool.act_3_combat",
    nextNodeIds: ["node.act3_shrine_a", "node.act3_combat_c"],
  },
  {
    id: "node.act3_combat_b",
    type: "combat",
    title: "Ash Field Patrol",
    description: "Cult soldiers sweep the burned fields for intruders.",
    layer: 1,
    encounterId: "encounter.long_gatehouse",
    encounterPoolId: "pool.act_3_combat",
    nextNodeIds: ["node.act3_shrine_a", "node.act3_combat_c"],
  },
  {
    id: "node.act3_event_a",
    type: "event",
    title: "Survivor's Cache",
    description: "A local survivor hidden in rubble offers help and information.",
    layer: 1,
    nextNodeIds: ["node.act3_shrine_a", "node.act3_combat_c"],
  },
  {
    id: "node.act3_shrine_a",
    type: "shrine",
    title: "Defaced War-Shrine",
    description: "The cult partially defaced this shrine, but power still lingers.",
    layer: 2,
    optional: true,
    nextNodeIds: ["node.act3_elite_a", "node.act3_combat_d", "node.act3_camp_a"],
  },
  {
    id: "node.act3_combat_c",
    type: "combat",
    title: "Summoning Circle Guards",
    description: "Fanatics protect a mid-reach ritual site.",
    layer: 2,
    encounterId: "encounter.long_cult_vanguard",
    encounterPoolId: "pool.act_3_combat",
    nextNodeIds: ["node.act3_elite_a", "node.act3_combat_d", "node.act3_camp_a"],
  },
  {
    id: "node.act3_elite_a",
    type: "elite",
    title: "The Choir Commander",
    description: "The first cult commander and her summoned chorus.",
    layer: 3,
    encounterId: "encounter.long_iron_sergeant_elite",
    nextNodeIds: ["node.act3_event_b", "node.act3_combat_e"],
  },
  {
    id: "node.act3_combat_d",
    type: "combat",
    title: "Ritual Enforcers",
    description: "Enforcers punish any who stray from cult doctrine.",
    layer: 3,
    encounterId: "encounter.long_blackwater_ford",
    encounterPoolId: "pool.act_3_combat",
    nextNodeIds: ["node.act3_event_b", "node.act3_combat_e"],
  },
  {
    id: "node.act3_camp_a",
    type: "camp",
    title: "Abandoned Mill",
    description: "A derelict mill offers cover to rest and tend wounds.",
    layer: 3,
    optional: true,
    nextNodeIds: ["node.act3_event_b", "node.act3_combat_e", "node.act3_side1_start"],
  },
  // Side route 1: Prisoner Rescue Branch (branches from camp, returns to elite_b)
  {
    id: "node.act3_side1_start",
    type: "side_route_start",
    title: "Prisoner Rescue",
    description: "Muffled voices behind a locked door suggest captives nearby.",
    layer: 4,
    optional: true,
    questId: "sq.act3.prisoner_rescue",
    questNodeRole: "start",
    questStageId: "sq.act3.prisoner_rescue.stage_1",
    questStepId: "sq.act3.prisoner_rescue.stage_1.step_1",
    nextNodeIds: ["node.act3_side1_combat"],
  },
  {
    id: "node.act3_side1_combat",
    type: "side_route_node",
    title: "Holding Pen Clash",
    description: "Guards must be overcome before the captives can be freed.",
    layer: 5,
    encounterId: "encounter.bandit_toll",
    encounterPoolId: "pool.act_3_combat",
    questId: "sq.act3.prisoner_rescue",
    questNodeRole: "advance",
    questStageId: "sq.act3.prisoner_rescue.stage_1",
    questStepId: "sq.act3.prisoner_rescue.stage_1.step_2",
    nextNodeIds: ["node.a3_side1_ward_puzzle"],
  },
  {
    id: "node.a3_side1_ward_puzzle",
    type: "side_route_node",
    title: "Warding Seals",
    description: "Arcane seals guard the final approach to the captive's cell.",
    layer: 6,
    eventId: "event.sq.prisoner_rescue.ward_puzzle",
    questId: "sq.act3.prisoner_rescue",
    questNodeRole: "advance",
    questStageId: "sq.act3.prisoner_rescue.stage_2",
    questStepId: "sq.act3.prisoner_rescue.stage_2.step_1",
    nextNodeIds: ["node.act3_side1_return"],
  },
  {
    id: "node.act3_side1_return",
    type: "side_route_return",
    title: "Liberated Captives",
    description: "The freed prisoners share what they know about the sanctum's interior.",
    layer: 6,
    returnNodeId: "node.act3_elite_b",
    questId: "sq.act3.prisoner_rescue",
    questNodeRole: "complete",
    questOutcomeHookId: "outcome.sq.act3.prisoner_rescue.rescued",
    nextNodeIds: ["node.act3_elite_b"],
  },
  {
    id: "node.act3_event_b",
    type: "event",
    title: "Cult Communique",
    description: "Intercepted messages reveal the high priest's ritual schedule.",
    layer: 7,
    nextNodeIds: ["node.act3_elite_b", "node.act3_shop_a"],
  },
  {
    id: "node.act3_combat_e",
    type: "combat",
    title: "Sanctum Approaches",
    description: "The path to the sanctum narrows and hardens.",
    layer: 7,
    encounterId: "encounter.long_ashen_lookout",
    encounterPoolId: "pool.act_3_combat",
    nextNodeIds: ["node.act3_elite_b", "node.act3_shop_a"],
  },
  {
    id: "node.act3_elite_b",
    type: "elite",
    title: "The Second Commander",
    description: "A veteran commander guards the sanctum's antechamber.",
    layer: 8,
    encounterId: "encounter.broken_banner_elite",
    nextNodeIds: ["node.act3_combat_f"],
  },
  {
    id: "node.act3_shop_a",
    type: "shop",
    title: "Salvaged Supply Depot",
    description: "Supplies looted from the cult's own stores.",
    layer: 8,
    shopPoolId: "shop.basic",
    optional: true,
    nextNodeIds: ["node.act3_combat_f", "node.act3_side2_start"],
  },
  // Side route 2: Ancient Tomb Relic Branch (branches from shop, returns to combat_f)
  {
    id: "node.act3_side2_start",
    type: "side_route_start",
    title: "Ancient Tomb Entrance",
    description: "A pre-cult tomb lies partially excavated beneath the sanctum.",
    layer: 9,
    optional: true,
    questNodeRole: "start",
    nextNodeIds: ["node.act3_side2_combat"],
  },
  {
    id: "node.act3_side2_combat",
    type: "side_route_node",
    title: "Tomb Guardian",
    description: "An ancient ward has been disturbed by the cult's digging.",
    layer: 10,
    encounterId: "encounter.old_graveyard",
    encounterPoolId: "pool.act_3_combat",
    questNodeRole: "advance",
    nextNodeIds: ["node.act3_side2_return"],
  },
  {
    id: "node.act3_side2_return",
    type: "side_route_return",
    title: "Relic Recovery",
    description: "A pre-cult relic is recovered before ascending to the final approach.",
    layer: 11,
    returnNodeId: "node.act3_combat_f",
    questNodeRole: "complete",
    nextNodeIds: ["node.act3_combat_f"],
  },
  {
    id: "node.act3_combat_f",
    type: "combat",
    title: "Sanctum Threshold",
    description: "The final outer ring of cult defenders holds the sanctum door.",
    layer: 12,
    encounterId: "encounter.long_hexscar_patrol",
    encounterPoolId: "pool.act_3_combat",
    nextNodeIds: ["node.act3_boss"],
  },
  {
    id: "node.act3_boss",
    type: "boss",
    title: "The Ashen Sanctum",
    description: "The high priest of the Ashen Choir activates as the sanctum is breached.",
    layer: 13,
    encounterId: "encounter.boss_high_priest",
    nextNodeIds: [],
  },
];

const ACT_3_ALT_NODES: NodeDef[] = [
  {
    id: "node.act3_alt_start",
    type: "start",
    title: "The Prisoner's Road",
    description: "A rescue route through the cult's holding pens.",
    layer: 0,
    nextNodeIds: ["node.act3_alt_boss"],
  },
  {
    id: "node.act3_alt_boss",
    type: "boss",
    title: "The Ashen Sanctum (Rescue Route)",
    description: "The prisoner route converges on the same sanctum.",
    layer: 1,
    encounterId: "encounter.boss_high_priest",
    nextNodeIds: [],
  },
];

// ---------------------------------------------------------------------------
// Canonical Act 4 map template (#345).
// 20 nodes. The draconid spire with draconid-courier and planar-anchor side routes.
// The final boss node is the campaign completion gate.
// ---------------------------------------------------------------------------

const ACT_4_NODES: NodeDef[] = [
  {
    id: "node.act4_start",
    type: "start",
    title: "The Ascending Spire",
    description: "The draconid arcane lord's sanctum towers against the sky.",
    layer: 0,
    nextNodeIds: ["node.act4_combat_a", "node.act4_shop_a", "node.act4_event_a"],
  },
  {
    id: "node.act4_combat_a",
    type: "combat",
    title: "Sanctum Outer Ring",
    description: "Draconid soldiers and arcane constructs hold the outer perimeter.",
    layer: 1,
    encounterId: "encounter.road_ambush",
    encounterPoolId: "pool.act_4_combat",
    nextNodeIds: ["node.act4_combat_b", "node.act4_elite_a"],
  },
  {
    id: "node.act4_shop_a",
    type: "shop",
    title: "Arcane Contraband Cache",
    description: "Confiscated artifacts from the arcane lord's raids.",
    layer: 1,
    shopPoolId: "shop.basic",
    optional: true,
    nextNodeIds: ["node.act4_combat_b", "node.act4_elite_a"],
  },
  {
    id: "node.act4_event_a",
    type: "event",
    title: "Draconid Defector",
    description: "A disillusioned draconid warrior shares the spire's layout.",
    layer: 1,
    nextNodeIds: ["node.act4_combat_b", "node.act4_elite_a"],
  },
  {
    id: "node.act4_combat_b",
    type: "combat",
    title: "Spire Sentinels",
    description: "The mid-ring defense is better organized and forewarned.",
    layer: 2,
    encounterId: "encounter.long_cult_vanguard",
    encounterPoolId: "pool.act_4_combat",
    nextNodeIds: ["node.act4_camp_a", "node.act4_combat_c", "node.act4_shrine_a"],
  },
  {
    id: "node.act4_elite_a",
    type: "elite",
    title: "The Arcane Warden",
    description: "The lord's chief enforcer and her arcane golem escort.",
    layer: 2,
    encounterId: "encounter.long_iron_sergeant_elite",
    nextNodeIds: ["node.act4_camp_a", "node.act4_combat_c", "node.act4_shrine_a"],
  },
  {
    id: "node.act4_camp_a",
    type: "camp",
    title: "Reclaimed Garrison Post",
    description: "A cleared post offers the last chance to rest before the inner spire.",
    layer: 3,
    optional: true,
    nextNodeIds: ["node.act4_event_b", "node.act4_elite_b"],
  },
  {
    id: "node.act4_combat_c",
    type: "combat",
    title: "Arcane Construct Wing",
    description: "The lord's constructs patrol the inner ring autonomously.",
    layer: 3,
    encounterId: "encounter.long_ashen_lookout",
    encounterPoolId: "pool.act_4_combat",
    nextNodeIds: ["node.act4_event_b", "node.act4_elite_b"],
  },
  {
    id: "node.act4_shrine_a",
    type: "shrine",
    title: "Ley Nexus",
    description: "A natural arcane focus point beneath the spire still holds old power.",
    layer: 3,
    optional: true,
    nextNodeIds: ["node.act4_event_b", "node.act4_elite_b", "node.act4_side1_start"],
  },
  // Side route 1: Draconid Courier Intercept (branches from shrine, returns to event_b)
  {
    id: "node.act4_side1_start",
    type: "side_route_start",
    title: "Courier Intercept",
    description: "A fast courier carries orders from the arcane lord — intercept them.",
    layer: 4,
    optional: true,
    questNodeRole: "start",
    nextNodeIds: ["node.act4_side1_combat"],
  },
  {
    id: "node.act4_side1_combat",
    type: "side_route_node",
    title: "Courier Escort Clash",
    description: "Elite draconid guards escort the courier at speed.",
    layer: 5,
    encounterId: "encounter.broken_banner_elite",
    encounterPoolId: "pool.act_4_combat",
    questNodeRole: "advance",
    nextNodeIds: ["node.act4_side1_return"],
  },
  {
    id: "node.act4_side1_return",
    type: "side_route_return",
    title: "Orders Seized",
    description: "The captured courier's orders reveal the arcane lord's endgame.",
    layer: 6,
    returnNodeId: "node.act4_event_b",
    questNodeRole: "complete",
    nextNodeIds: ["node.act4_event_b"],
  },
  {
    id: "node.act4_event_b",
    type: "event",
    title: "Inner Sanctum Gate",
    description: "The arcane seals on the inner gate require a key — or brute force.",
    layer: 7,
    nextNodeIds: ["node.act4_combat_d", "node.act4_combat_e"],
  },
  {
    id: "node.act4_elite_b",
    type: "elite",
    title: "The Lord's Champion",
    description: "The arcane lord's personal champion stands at the sanctum threshold.",
    layer: 7,
    encounterId: "encounter.broken_banner_elite",
    nextNodeIds: ["node.act4_combat_d", "node.act4_combat_e"],
  },
  {
    id: "node.act4_combat_d",
    type: "combat",
    title: "Sanctum Vestibule",
    description: "The antechamber before the arcane lord's chamber.",
    layer: 8,
    encounterId: "encounter.long_blackwater_ford",
    encounterPoolId: "pool.act_4_combat",
    nextNodeIds: ["node.act4_boss"],
  },
  {
    id: "node.act4_combat_e",
    type: "combat",
    title: "Arcane Battery Room",
    description: "Power conduits feed the final chamber — they can be disabled.",
    layer: 8,
    encounterId: "encounter.long_hexscar_patrol",
    encounterPoolId: "pool.act_4_combat",
    nextNodeIds: ["node.act4_side2_start", "node.act4_boss"],
  },
  // Side route 2: Planar Anchor Stabilization (branches from combat_e, returns to final boss)
  {
    id: "node.act4_side2_start",
    type: "side_route_start",
    title: "Planar Anchor Chamber",
    description: "An unstable rift node offers a dangerous shortcut — or a catastrophe.",
    layer: 9,
    optional: true,
    questId: "sq.act4.planar_echo",
    questNodeRole: "start",
    questStageId: "sq.act4.planar_echo.stage_1",
    questStepId: "sq.act4.planar_echo.stage_1.step_1",
    nextNodeIds: ["node.act4_side2_combat"],
  },
  {
    id: "node.act4_side2_combat",
    type: "side_route_node",
    title: "Rift Stabilization Fight",
    description: "Planar invaders pour through the destabilized anchor.",
    layer: 10,
    encounterId: "encounter.old_graveyard",
    encounterPoolId: "pool.act_4_combat",
    questId: "sq.act4.planar_echo",
    questNodeRole: "advance",
    nextNodeIds: ["node.a4_side1_anchor"],
  },
  {
    id: "node.a4_side1_anchor",
    type: "side_route_node",
    title: "Resonant Anchor",
    description: "The fractured anchor stone pulses with planar energy at the heart of the chamber.",
    layer: 11,
    eventId: "event.sq.planar_echo.anchor_attunement",
    questId: "sq.act4.planar_echo",
    questNodeRole: "advance",
    questStageId: "sq.act4.planar_echo.stage_1",
    questStepId: "sq.act4.planar_echo.stage_1.step_1",
    nextNodeIds: ["node.act4_side2_return"],
  },
  {
    id: "node.act4_side2_return",
    type: "side_route_return",
    title: "Anchor Sealed",
    description: "The rift collapses inward, depositing the party inside the lord's chamber.",
    layer: 11,
    returnNodeId: "node.act4_boss",
    questId: "sq.act4.planar_echo",
    questNodeRole: "complete",
    questOutcomeHookId: "outcome.sq.act4.planar_echo.ward_broken",
    nextNodeIds: ["node.act4_boss"],
  },
  {
    id: "node.act4_boss",
    type: "boss",
    title: "The Arcane Lord's Chamber",
    description: "The draconid arcane lord and his elite bodyguard await. This is the campaign's final gate.",
    layer: 12,
    encounterId: "encounter.boss_arcane_lord",
    nextNodeIds: [],
  },
];

const ACT_4_ALT_NODES: NodeDef[] = [
  {
    id: "node.act4_alt_start",
    type: "start",
    title: "The Planar Anchor",
    description: "A destabilized rift node offers a riskier path through the sanctum.",
    layer: 0,
    nextNodeIds: ["node.act4_alt_boss"],
  },
  {
    id: "node.act4_alt_boss",
    type: "boss",
    title: "The Arcane Lord's Chamber (Anchor Route)",
    description: "The planar anchor path emerges at the same final chamber.",
    layer: 1,
    encounterId: "encounter.boss_arcane_lord",
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
  act_1_map: {
    id: "act_1_map",
    name: "The Verdant Threat",
    campaignId: "campaign.verdant_dark",
    actId: "act_1",
    startNodeId: "node.a1_start",
    bossNodeId: "node.a1_boss",
    nodes: ACT_1_NODES,
  },
  act_2_map: {
    id: "act_2_map",
    name: "The Iron Wall",
    campaignId: "campaign.verdant_dark",
    actId: "act_2",
    startNodeId: "node.act2_start",
    bossNodeId: "node.act2_boss",
    nodes: ACT_2_NODES,
  },
  act_2_map_deserter_route: {
    id: "act_2_map_deserter_route",
    name: "The Iron Wall — Deserter Route",
    campaignId: "campaign.verdant_dark",
    actId: "act_2",
    startNodeId: "node.act2_alt_start",
    bossNodeId: "node.act2_alt_boss",
    nodes: ACT_2_ALT_NODES,
  },
  act_3_map: {
    id: "act_3_map",
    name: "The Ashen Choir",
    campaignId: "campaign.verdant_dark",
    actId: "act_3",
    startNodeId: "node.act3_start",
    bossNodeId: "node.act3_boss",
    nodes: ACT_3_NODES,
  },
  act_3_map_prisoner_rescue: {
    id: "act_3_map_prisoner_rescue",
    name: "The Ashen Choir — Prisoner Rescue",
    campaignId: "campaign.verdant_dark",
    actId: "act_3",
    startNodeId: "node.act3_alt_start",
    bossNodeId: "node.act3_alt_boss",
    nodes: ACT_3_ALT_NODES,
  },
  act_4_map: {
    id: "act_4_map",
    name: "The Ascending Dark",
    campaignId: "campaign.verdant_dark",
    actId: "act_4",
    startNodeId: "node.act4_start",
    bossNodeId: "node.act4_boss",
    nodes: ACT_4_NODES,
  },
  act_4_map_planar_anchor: {
    id: "act_4_map_planar_anchor",
    name: "The Ascending Dark — Planar Anchor",
    campaignId: "campaign.verdant_dark",
    actId: "act_4",
    startNodeId: "node.act4_alt_start",
    bossNodeId: "node.act4_alt_boss",
    nodes: ACT_4_ALT_NODES,
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
 * Resolves which encounter a node launches. When `campaignFlags` is provided and the node
 * has a `conditionalEncounterId` map, the first matching flag wins and overrides normal
 * resolution. Otherwise, combat nodes with an `encounterPoolId` draw a seeded pick from
 * that pool; otherwise the fixed `encounterId` is used. Returns `undefined` only for nodes
 * that declare neither (non-combat nodes).
 */
export function resolveNodeEncounterId(
  node: NodeDef,
  rng: () => number,
  campaignFlags?: Record<string, string>,
): string | undefined {
  if (node.conditionalEncounterId && campaignFlags) {
    for (const [flag, encounterId] of Object.entries(node.conditionalEncounterId)) {
      if (campaignFlags[flag] !== undefined) {
        return encounterId;
      }
    }
  }
  if (node.encounterPoolId) return selectEncounterFromPool(node.encounterPoolId, rng);
  return node.encounterId;
}
