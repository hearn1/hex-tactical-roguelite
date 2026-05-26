# Feature 10 — Branching Map (M4.1)

## Goal
Render a hardcoded branching node map, track the current node and the available next nodes, and let the player advance through it. Combat/shop/etc. nodes are stubs in this feature — real integration lands in Features 11–15.

## Source Docs
- `MAP_AND_NODES.md` ← prototype act structure
- `DATA_MODEL.md` § NodeDef
- `ARCHITECTURE.md`
- `ROADMAP.md` (M4.1)

## Includes

### Node defs (`src/data/nodes.ts`)
Hardcode a single prototype map with exactly **10 nodes** in 5 layers, matching `MAP_AND_NODES.md`'s example shape:

```
Layer 0: node.start
Layer 1: node.combat_a, node.combat_b
Layer 2: node.shop_1, node.event_1, node.combat_c
Layer 3: node.camp_1, node.recruit_1
Layer 4: node.combat_d
Layer 5: node.boss
```

Edges (`nextNodeIds`):
- `start → combat_a, combat_b`
- `combat_a → shop_1, event_1`
- `combat_b → event_1, combat_c`
- `shop_1 → camp_1`
- `event_1 → camp_1, recruit_1`
- `combat_c → recruit_1`
- `camp_1 → combat_d`
- `recruit_1 → combat_d`
- `combat_d → boss`
- `boss → (none)`

Each node has `id, type, title, description, nextNodeIds`, plus `encounterId` for combat/elite/boss, `shopPoolId` for shop. Use sensible placeholders for `title`/`description`.

Combat nodes reference these encounters (defined in `src/data/encounters.ts`):
- `combat_a` → `encounter.road_ambush`
- `combat_b` → `encounter.old_graveyard`
- `combat_c` → `encounter.bandit_toll`
- `combat_d` → `encounter.cult_ritual`
- `boss` → `encounter.boss_ogre_hexbreaker`

Encounter definitions follow `CONTENT_CATALOG.md` § Encounters. Use the existing enemy defs from Feature 02 plus the new ones (`enemy.skeleton_archer`, `enemy.bandit_brute`, `enemy.cult_acolyte`). Use the **exact stats from `CONTENT_CATALOG.md`** for the new enemies:

- `enemy.skeleton_archer` — HP 9, Armor 12, Move 3, agility 3; `actionIds: ["action.bone_arrow"]` (Bone Arrow already defined in Feature 04).
- `enemy.bandit_brute` — HP 16, Armor 13, Move 3, might 3; `actionIds: ["action.heavy_club"]` — add `action.heavy_club` to `src/data/actions.ts` (range 1, might, `1d8 + might`).
- `enemy.cult_acolyte` — HP 12, Armor 11, Move 3, spirit 2; `actionIds: ["action.dark_bolt", "action.minor_heal"]` — add both: Dark Bolt (range 4, spirit, `1d6 + spirit` dmg) and Minor Heal (range 3, spirit, heal `1d4 + spirit`).

Boss def itself is fully wired in Feature 12; for this feature, a stub OgreHexbreaker (HP 42, Move 3, one melee action — reuse `action.heavy_club`) is enough so the map renders.

### Map graph (`src/run/MapGraph.ts`)
```ts
export interface MapState {
  currentNodeId: string;
  visitedNodeIds: Set<string>;
}

export function availableNextNodes(map: MapState): string[];
export function visit(map: MapState, nodeId: string): void;   // mutates
```

`availableNextNodes` returns nodes in `nodes[currentNodeId].nextNodeIds` that have not yet been visited.

### RunState integration
Add to `RunState`:
```ts
mapState: MapState;
nodesCleared: number;
elitesDefeated: number;
bossDefeated: boolean;
```

A "New Run" action initializes `mapState = { currentNodeId: "node.start", visitedNodeIds: new Set(["node.start"]) }`.

### Main menu wiring
- Replace the existing "Start Combat Sandbox" button with **"New Run"**. (Keep a hidden dev shortcut to the old sandbox if helpful.)
- "New Run" initializes a fresh `RunState`, creates 3 heroes at level 1 with starting items, and navigates to the map screen.

### `src/ui/screens/MapScreen.ts`
- Render the 10 nodes laid out by layer (left→right) with edges.
- Visual states: current (filled), visited (faded), available next (highlighted), locked/disconnected (greyed out).
- Click an available next node → call `visit(...)` and, depending on node type:
  - **combat / elite / boss** → "Combat coming soon" placeholder banner; immediately mark complete and return to map (real wiring in Features 11–12).
  - **shop / camp / event / recruit** → similar "X coming soon" placeholder; mark complete and return.
- All node types are stubs in this feature — the goal is verifying traversal.

### Tests (`src/run/MapGraph.test.ts`)
- From `node.start`, available next nodes are exactly `[combat_a, combat_b]`.
- After visiting `combat_a`, available next is `[shop_1, event_1]`.
- Every path from start leads to boss (sanity check: BFS from start reaches `node.boss` through any branch).
- No node points to itself; no edge points to a non-existent node.

## Out of Scope
- Real combat launch (Feature 11).
- Boss encounter (Feature 12).
- Shop/Camp/Event/Recruit screens (Features 13–15).
- Procedural map generation (out of prototype scope).

## Acceptance Criteria
- "New Run" opens the map screen with the hardcoded 10-node layout.
- The current node and reachable nexts are visually distinct.
- Clicking an available next node advances through it (with placeholder content) and updates visuals.
- All graph tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/12 (Feature 10 — Branching Map).
>
> Read `MAP_AND_NODES.md`, `DATA_MODEL.md` § NodeDef, `ARCHITECTURE.md`, and `ROADMAP.md` (M4.1). Hardcode the 10-node graph in `src/data/nodes.ts`, add `src/run/MapGraph.ts`, replace the main menu sandbox button with "New Run", add `MapScreen` rendering layers with current/visited/available states, stub all node-type effects (no real combat/shop/etc. yet), and pass the listed graph tests.
