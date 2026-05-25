# Feature 03 — Movement (M1.3)

## Goal
Let the active hero move on valid hexes within their `move` stat. Enemies still do not move (their AI comes in Feature 05).

## Source Docs
- `ARCHITECTURE.md`
- `COMBAT_DESIGN.md` § Unit Turn Structure (movement points = `move`, 1 action point)
- `CONTENT_CATALOG.md` (Move stats: heroes 3, Goblin 4, Wolf 5, etc.)
- `ROADMAP.md` (M1.3)

## Includes

### Movement model
- At turn start, set `unit.movePointsRemaining = unit.stats.move` (add field to `UnitInstance` — replaces/augments `hasMoved`).
- Movement consumes 1 point per hex stepped through (not a single "teleport to any reachable").
- A unit may move multiple times in one turn until points are exhausted, but does **not** need to commit to a full path — clicking a reachable hex pathfinds and moves.
- A unit cannot move into a hex occupied by another living unit. The unit's own current hex does not block.

### Reachable hex calculation (`src/combat/Movement.ts`)
```ts
export function reachableHexes(
  start: Hex,
  movePoints: number,
  occupiedKeys: Set<string>,   // exclude self
  gridKeys: Set<string>,       // valid grid hexes
): Map<string, number>;        // hexKey -> minimum cost to reach
```

BFS layer-by-layer: a hex is reachable if there's a path of length ≤ `movePoints` through unoccupied, in-grid hexes. Use `hexKey` from `core/hex.ts`.

Also expose `findPath(start, end, ...)` returning a list of hexes for animation/log purposes (optional for now — straight-line cost from `reachableHexes` is fine).

### UI
- When the active unit is a hero and has movement points, highlight reachable hexes with a translucent overlay.
- Clicking a reachable hex moves the unit there, decrements `movePointsRemaining` by the cost, re-highlights remaining reachable hexes.
- Hex hover during move-mode previews the destination cost (optional but easy: show "Move 2" near the cursor).
- A "Cancel" or "End Turn" still works as before.

### Combat log
- `[T2] Mara moves to (-1, 0). 1 move remaining.`

### Tests (`src/combat/Movement.test.ts`)
- A unit with 3 move on an open grid reaches exactly 19 hexes (radius-3 BFS minus blocked hexes outside the playable grid — verify count assuming a radius-3 grid; if center, all 19 of radius ≤ 3 from center).
- Occupied hexes are excluded from reachable.
- An occupied hex blocks **movement through** it (no path goes through occupied hexes).
- A unit with 0 move points reaches only itself (or empty set — pick one and document; recommend: empty set, since the unit's current position isn't a "destination").

## Out of Scope
- Enemy movement (Feature 05).
- Actions/attacks (Feature 04). The active hero still has an unused "action point" — leave it dangling.
- Opportunity attacks (explicitly excluded by `COMBAT_DESIGN.md`).

## Acceptance Criteria
- On a hero turn, valid moves are highlighted.
- Clicking a reachable hex moves the hero, deducts movement points, and updates the log.
- Occupied hexes and out-of-range hexes are not reachable.
- All movement tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/5 (Feature 03 — Movement).
>
> Read `ARCHITECTURE.md`, `COMBAT_DESIGN.md` § Unit Turn Structure, `CONTENT_CATALOG.md` Move stats, and `ROADMAP.md` (M1.3). Add `movePointsRemaining` to `UnitInstance`, implement BFS reachable-hex calc in `src/combat/Movement.ts`, highlight reachable hexes on hero turns, allow click-to-move with point deduction, log moves, and pass the listed tests.
