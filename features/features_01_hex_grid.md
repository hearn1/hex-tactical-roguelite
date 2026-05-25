# Feature 01 — Hex Grid (M1.1)

## Goal
Implement pure hex-grid logic and a visual hex grid the player can see and click. Combat units do not exist yet — this milestone is grid + rendering + selection only.

## Source Docs
- `COMBAT_DESIGN.md` (hex coordinate system, grid size)
- `TECH_PLAN.md` (testing guidance for hex distance)
- `ROADMAP.md` (M1.1)
- `CLAUDE.md`

## Includes
- Axial-coordinate hex math module:
  - Coordinate type (q, r).
  - `neighbors(hex)` → 6 directions.
  - `distance(a, b)` (axial).
  - `range(center, radius)` → all hexes within N steps.
- Hex grid rendering (~7x7 or radius-3 equivalent, ~37–61 hexes).
- Hover highlight and click selection.
- Coordinate display in a debug overlay (toggleable).

## Out of Scope
- Units, turns, movement validation, combat.
- Line-of-sight, terrain, hazards.

## Acceptance Criteria
- Player sees a hex grid on screen.
- Clicking a hex highlights it.
- Hovering a hex highlights it differently.
- Unit tests cover: distance is symmetric, neighbors returns 6, `range` returns the correct count for small radii.

## Suggested Session Prompt
> Implement Feature 01 — Hex Grid. Read `COMBAT_DESIGN.md`, `TECH_PLAN.md`, `ROADMAP.md` (M1.1), and `CLAUDE.md`. Build axial-coordinate hex math, render a ~7x7 grid, support hover/click selection, and add unit tests for distance/neighbors/range.
