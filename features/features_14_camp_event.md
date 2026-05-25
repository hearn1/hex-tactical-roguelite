# Feature 14 — Camp / Event Node (M5.2)

## Goal
Add a Camp/Rest node that lets the player heal or apply a small training bonus, plus a simple Event node with a 2-choice decision.

## Source Docs
- `MAP_AND_NODES.md`
- `ROADMAP.md` (M5.2)

## Includes
- Camp/Rest node screen with a choice: "Rest" (heal each hero by X HP) vs "Train" (one hero gains +1 to a chosen stat for the rest of the run, or +5 XP — pick one simple option).
- One Event node with one 2-choice scenario (any flavor: "A traveling merchant offers a Lucky Charm for 10g vs ignore", "A mystery shrine grants +1 Spirit vs -2 HP", etc.). Outcomes apply immediately.
- Both node types return to the map after resolving.

## Out of Scope
- Multiple event scenarios (Feature 20 content expansion).
- Recruits/pets (Feature 15).

## Acceptance Criteria
- Camp node heals or upgrades on choice.
- Event node presents one 2-choice decision with an immediate effect.
- Both nodes return to map and mark complete.

## Suggested Session Prompt
> Implement Feature 14 — Camp/Event Node. Read `MAP_AND_NODES.md`, `ROADMAP.md` (M5.2). Add a Rest-or-Train Camp node and one 2-choice Event node, both returning to the map after resolving.
