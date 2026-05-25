# Feature 12 — Boss Encounter and Run End (M4.3)

## Goal
Add the boss encounter, its boss-specific AI, and the run-end summary screen.

## Source Docs
- `MAP_AND_NODES.md`
- `CONTENT_CATALOG.md` (Boss: Ogre Hexbreaker)
- `COMBAT_DESIGN.md` (boss AI tag)
- `ROADMAP.md` (M4.3)

## Includes
- Boss encounter definition (Ogre Hexbreaker) with 3 boss actions: Massive Swing, Ground Slam, Roar.
- Boss-tag AI: rotate through actions, prioritize highest-threat hero, trigger reinforcement at <50% HP (per catalog note: 1 Skeleton Archer optional).
- Run-end summary screen on victory (Boss defeated) showing: gold, items collected, fights won, Renown earned (placeholder value — actual Renown calc lands in Feature 16).
- Run-end summary screen on defeat with similar info.
- "Return to Main Menu" button.

## Out of Scope
- Renown calculation math (Feature 16).
- Meta-upgrade UI (Feature 17).

## Acceptance Criteria
- Boss node launches the boss encounter.
- Boss uses all 3 actions over a fight.
- Reinforcement triggers below 50% boss HP.
- Win or loss opens the run-end summary.

## Suggested Session Prompt
> Implement Feature 12 — Boss and Run End. Read `MAP_AND_NODES.md`, `CONTENT_CATALOG.md`, `COMBAT_DESIGN.md`, `ROADMAP.md` (M4.3). Add the Ogre Hexbreaker encounter, boss AI with action rotation and reinforcement trigger, and the run-end summary screen for both win and loss.
