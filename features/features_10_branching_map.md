# Feature 10 — Branching Map (M4.1)

## Goal
Render a hardcoded branching node map (Slay-the-Spire style) and track current node + available next nodes.

## Source Docs
- `MAP_AND_NODES.md`
- `DATA_MODEL.md` (Node, MapGraph)
- `ROADMAP.md` (M4.1)

## Includes
- `MapGraph` data structure: nodes, edges, node types (Combat, Elite, Shop, Camp, Recruit, Event, Boss).
- Hardcoded prototype graph of 8–10 nodes ending in a single Boss node.
- Map screen renders nodes and edges; current node highlighted; next-reachable nodes clickable.
- Clicking an unreachable node does nothing (or shows a reason).
- Node completion state persists when returning to map.
- Node types other than Combat can be **stubs** for now (just "You visited X. Continue." — fleshed out in Features 11–15).

## Out of Scope
- Launching combat from a node (Feature 11).
- Boss-specific behavior (Feature 12).
- Non-combat node implementations (Features 13–15).

## Acceptance Criteria
- Player sees a branching map.
- Player can pick a connected next node.
- Map remembers visited nodes and current position.

## Suggested Session Prompt
> Implement Feature 10 — Branching Map. Read `MAP_AND_NODES.md`, `DATA_MODEL.md`, `ROADMAP.md` (M4.1). Add a `MapGraph`, render a hardcoded 8–10 node prototype map with a Boss endpoint, and let the player traverse it. Non-combat nodes can be stubs.
