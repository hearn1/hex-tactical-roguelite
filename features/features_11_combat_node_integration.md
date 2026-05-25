# Feature 11 — Combat Node Integration (M4.2)

## Goal
Launch the combat sandbox from a Combat node on the map and return to the map (via the reward screen) on victory.

## Source Docs
- `MAP_AND_NODES.md`
- `CONTENT_CATALOG.md` (encounters)
- `ROADMAP.md` (M4.2)

## Includes
- Node → Encounter mapping (a Combat node references an encounter id from `CONTENT_CATALOG.md`, e.g., Road Ambush, Old Graveyard).
- State flow: Map → Combat → Reward → Map.
- Persist hero HP/conditions between fights (cleared conditions but HP carries unless healed).
- "Game Over" if defeat — return to main menu (run lost).
- Multiple combat nodes use different encounters from the catalog.

## Out of Scope
- Boss node (Feature 12).
- Shop/Camp/Recruit/Event flows (Features 13–15).

## Acceptance Criteria
- Player can complete ≥2 different combats from the map.
- HP carries between fights.
- Defeat returns to main menu and ends the run.
- Victory returns to the map with the previous combat node marked complete.

## Suggested Session Prompt
> Implement Feature 11 — Combat Node Integration. Read `MAP_AND_NODES.md`, `CONTENT_CATALOG.md`, `ROADMAP.md` (M4.2). Wire the map's Combat nodes to launch encounters, return through the reward screen, persist HP, and handle defeat.
