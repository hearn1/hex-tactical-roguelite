# Feature 23 - Ability Checks Lite (Future)

## Goal
Add a simple dice-check system for non-combat event choices.

## DnD-Feel Intent
Bring in recognizable tabletop moments like risky checks and partial success while staying fast and deterministic enough to test.

## Source Docs
- `SCOPE.md`
- `GAME_DESIGN.md`
- `DATA_MODEL.md`
- `MAP_AND_NODES.md`

## Skeleton Scope
- Define check stats using existing hero stats such as might, agility, and spirit.
- Support a simple formula like `d20 + stat >= DC`.
- Let event choices declare optional checks.
- Log roll result, DC, success, failure, and reward or consequence.
- Keep RNG seeded through the existing run RNG.

## Out of Scope
- Full skill list.
- Advantage/disadvantage unless separately scoped.
- Saving throw systems for combat.

## Dependencies
- Existing event system.
- Feature 19 data repository.

## Acceptance Criteria Draft
- Event choices can resolve through a stat check.
- Roll math is testable and deterministic with seeded RNG.
- UI shows the check target and possible outcomes before choosing.
- Logs clearly report the roll and result.

## Planning Notes
- Decide whether the player chooses which hero attempts the check.
- Consider tying backgrounds from Feature 22 into checks later.
