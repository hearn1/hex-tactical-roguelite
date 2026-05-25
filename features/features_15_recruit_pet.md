# Feature 15 — Recruit / Pet Node (M5.3)

## Goal
Add a node that lets the player add a recruit to the party (up to 4 heroes total) or take a pet buff.

## Source Docs
- `MAP_AND_NODES.md`
- `CONTENT_CATALOG.md` (party cap 4)
- `ROADMAP.md` (M5.3)

## Includes
- Recruit node screen: offers 1–2 candidate recruits (use one of the existing classes with a different name) or a pet-buff option (e.g., "Wolf Companion: +1 Might to all heroes for the rest of the run").
- Adding a recruit appends them to the party (cap 4). If already at 4, the recruit option is disabled with reason.
- Pet buff is a flat run-wide stat modifier — implement as a `RunModifier` list on `RunState`.
- Return to map after choosing or skipping.

## Out of Scope
- Full pet-unit-on-grid implementation (out of prototype scope).
- Dismissing recruits.

## Acceptance Criteria
- Player can grow party from 3 → 4 via a recruit node.
- Pet-buff option applies a run-wide stat bonus.
- Disabled options explain why (e.g., party full).

## Suggested Session Prompt
> Implement Feature 15 — Recruit/Pet Node. Read `MAP_AND_NODES.md`, `CONTENT_CATALOG.md`, `ROADMAP.md` (M5.3). Add a recruit option (up to party cap 4) and a pet-buff option that applies a run-wide stat modifier.
