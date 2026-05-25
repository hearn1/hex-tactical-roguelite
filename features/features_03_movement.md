# Feature 03 — Movement (M1.3)

## Goal
Let the active hero move on valid hexes within their Move stat, blocked by occupied hexes.

## Source Docs
- `COMBAT_DESIGN.md` (movement rules)
- `CONTENT_CATALOG.md` (Move stats)
- `ROADMAP.md` (M1.3)

## Includes
- Reachable-hex calculation (BFS from unit position, distance ≤ Move, blocked by other units).
- Highlight reachable hexes when the active hero is the player's turn.
- Click a reachable hex → unit moves there; turn does not auto-end.
- Each unit may move once per turn (track `hasMoved`).
- Combat log records "X moved to (q,r)".
- Enemies do **not** move yet — they will get AI in Feature 05.

## Out of Scope
- Actions/attacks, AI, terrain, line-of-sight.

## Acceptance Criteria
- On a hero's turn, valid hexes are highlighted.
- Occupied hexes are not reachable.
- Hexes beyond Move range are not reachable.
- Clicking a reachable hex moves the unit and updates the log.
- Unit tests cover reachable-hex calculation for occupancy + range.

## Suggested Session Prompt
> Implement Feature 03 — Movement. Read `COMBAT_DESIGN.md`, `CONTENT_CATALOG.md`, `ROADMAP.md` (M1.3). Add reachable-hex BFS, highlight valid moves on hero turns, allow click-to-move, log movement, and unit-test the BFS.
