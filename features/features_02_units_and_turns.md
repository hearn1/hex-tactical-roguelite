# Feature 02 — Units and Turn Order (M1.2)

## Goal
Spawn units on the grid and run a deterministic turn queue. No movement or combat yet — just placement, an active unit indicator, and an "End Turn" control that advances the queue.

## Source Docs
- `COMBAT_DESIGN.md` (initiative, turn structure)
- `CONTENT_CATALOG.md` (Guardian/Acolyte/Arcanist starter stats; starter enemies)
- `DATA_MODEL.md` (Unit/UnitState)
- `ROADMAP.md` (M1.2)

## Includes
- `Unit` and `UnitState` data structures (id, kind, team, hp, max hp, stats, position).
- Spawn 3 heroes (Guardian, Acolyte, Arcanist) and 2–3 enemies (e.g., Goblin Skirmisher, Wolf) at fixed positions.
- Render unit tokens on hexes with color/text indicating team and class.
- Initiative roll (or fixed for now) to build a turn queue.
- Active-unit highlight.
- "End Turn" button advances to next unit in queue.
- Combat log panel that records "Turn started: X".

## Out of Scope
- Movement, actions, AI, damage.

## Acceptance Criteria
- 3 heroes + 2–3 enemies are visible on the grid.
- One unit is marked as active.
- Clicking "End Turn" cycles through every unit and loops back.
- Combat log records each turn start.

## Suggested Session Prompt
> Implement Feature 02 — Units and Turn Order. Read `COMBAT_DESIGN.md`, `CONTENT_CATALOG.md`, `DATA_MODEL.md`, and `ROADMAP.md` (M1.2). Spawn heroes and enemies on the hex grid (from Feature 01), build a turn queue, render the active-unit highlight, and wire up an End Turn button with a combat log.
