# Feature 28 - Elite and Boss Mechanics (Future)

## Goal
Give elite and boss encounters more distinct mechanics without expanding into full tabletop complexity.

## DnD-Feel Intent
Make major fights feel like memorable set pieces with readable threats and phases.

## Source Docs
- `COMBAT_DESIGN.md`
- `CONTENT_CATALOG.md`
- `SCOPE.md`
- `GAME_DESIGN.md`

## Skeleton Scope
- Add one or two simple elite/boss mechanics such as telegraphed area attacks, reinforcement triggers, or phase thresholds.
- Show clear combat logs and UI warnings before major effects.
- Keep boss behavior deterministic and testable.
- Use existing action and condition systems where possible.

## Out of Scope
- Complex raid mechanics.
- Multiple bosses.
- Hidden boss rules.
- Full terrain hazard system unless separately scoped.

## Dependencies
- Existing boss encounter.
- Existing combat log and action validation.

## Acceptance Criteria Draft
- Boss has at least one visible special behavior.
- Player can understand and react to the behavior.
- Tests cover trigger timing and outcome.
- Victory and defeat flow still work after special behavior resolves.

## Planning Notes
- Start with the existing boss before adding new bosses.
- Prefer one polished mechanic over several opaque ones.
