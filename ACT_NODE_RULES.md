# Act Node Rules

> Structural rules for act map graphs.
> These rules constrain the map templates implemented in #161. They define node type mix,
> optional routing behavior, side-route mini-act behavior, and boss node behavior. No map
> templates are implemented here.

---

## 1. Node Type Mix Per Act

Each act map graph must include these node types in approximately the ratios below.
"Required" means the node must appear and the player will always encounter at least one.
"Optional" means the node exists in the graph but the player may skip it by choosing a
different branch.

| Node type | Act 1 | Act 2 | Act 3 | Act 4 | Notes |
|-----------|-------|-------|-------|-------|-------|
| Combat (normal) | 3–4 req | 4–5 req | 5–6 req | 4–5 req | Primary XP/gold source |
| Elite combat | 0–1 opt | 1 opt | 1–2 opt | 1 opt | Better rewards; harder fight |
| Shop | 1 opt | 1–2 opt | 1–2 opt | 1 opt | Optional route choice |
| Camp / Rest | 1 opt | 1 opt | 1–2 opt | 1 opt | Optional route choice |
| Event | 0–1 opt | 1 opt | 1–2 opt | 1 opt | Optional route choice |
| Recruit | 0–1 opt | 0–1 opt | 0–1 opt | 0 | Not in Act 4 (party locked) |
| Side route entry | 0–1 opt | 1 opt | 1–2 opt | 0–1 opt | Branch point into mini-act |
| Boss | 1 req | 1 req | 1 req | 1 req | Always the final node |

These counts are per typical expected path, not total graph nodes. The full graph includes
branching paths; the player resolves only the nodes on their chosen route.

---

## 2. Shop, Camp, and Rest as Optional Route Choices

Shops, camps, and rests are **optional route choices**, not mandatory pre-boss gates.

- The player must deliberately path toward them by selecting the branch that includes them.
- No act graph may place a shop, camp, or rest as the only way to reach the boss.
- A valid act graph must always have at least one route from start to boss that bypasses
  all shops, camps, and rests.
- The player is not penalized by the act structure for skipping recovery nodes. The
  incentive to visit them is game-mechanical (HP recovery, item purchases) not structural.

**Why:** The current single-act prototype has a "pre-boss rest/shop layer" that is mandatory.
That design makes the map feel railroaded for players who are healthy and well-stocked.
Optional routing gives the player agency and makes the map shape more replayable.

---

## 3. Side-Route Mini-Act Behavior

A side route is an **optional branch** that expands away from the main path, resolves one
or more nodes, and then returns the player to either:

- The node they branched from (if the side route dead-ends), or
- The continuation node immediately after the branch point (so the player does not lose
  progress by taking the side route).

### Side Route Structure Rules

1. A side route branches from a **side route entry node** on the main path.
2. The entry node is optional — the player may skip it by taking the other branch.
3. A side route contains 1–3 nodes before returning. It is not a full act.
4. The return point is always reachable after the side route resolves, regardless of which
   nodes the player chose inside the route.
5. A side route may not contain a boss node.
6. A side route may not contain another side route entry node (no nested side routes).
7. Placeholder side routes may use stub nodes (event or combat stubs) that do not yet have
   authored content.

### Side Route Return Point

```
Main path:   A → B → [SideEntry] → C → Boss
                          |
Side route:            X → Y → (returns to C)
```

After resolving Y (or X if the player stops), the next available node is C. The player
does not skip C by taking the side route.

---

## 4. Boss Node Behavior

A boss node is always the **final node in an act**. Its behavior differs from all other
node types:

- The boss node has no outgoing edges within the act. There are no navigable next nodes
  after the boss within the same act's map graph.
- Defeating the boss triggers the **act transition** (or campaign completion if this is
  the last act). The next navigable node is the first node of the next act, handled by the
  campaign runner, not by an edge in the act's map graph.
- The boss node is always reachable from every branch of the act's main path. No branch
  in the main path may dead-end before reaching the boss.
- Optional nodes (shops, camps, side routes) must not be positioned in a way that requires
  the player to complete them to unlock the boss.

---

## 5. Act Completion Condition

An act is considered complete when the boss node has been resolved and the boss encounter
won. The act completion condition does **not** depend on:

- How many optional nodes were visited.
- Whether any side routes were taken.
- Whether the player visited a shop or camp before the boss.

This must remain true regardless of the act's node count or map shape.

---

## 6. Relationship to Other Documents

- **`CAMPAIGN_TARGETS.md`** — Node count targets per act. The node type mix here must
  produce graphs consistent with those targets.
- **`MAP_AND_NODES.md`** — Node data schema and flow. Node types used here match those
  defined there.
- **`ACT_IDENTITIES.md`** — Per-act mechanical identity. Node type mix should reflect
  each act's identity (e.g. Act 3 has more combat nodes because of the multi-target theme).
- **`CAMPAIGN_ARC.md`** — Side quest hook locations. Side route entry nodes should be
  positioned to accommodate the side quest branches described there.
- **`SEEDED_RANDOMNESS.md`** — How node type selection during procedural map generation
  is seeded so tests can reproduce the same graph.
