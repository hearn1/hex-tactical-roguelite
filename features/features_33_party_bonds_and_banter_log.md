# Feature 33 - Party Bonds and Banter Log (Future)

## Goal
Add lightweight party personality through short banter lines and run summary notes.

## DnD-Feel Intent
Help the player imagine the party as adventurers without building dialogue trees.

## Source Docs
- `GAME_DESIGN.md`
- `SCOPE.md`
- `DATA_MODEL.md`

## Skeleton Scope
- Add short optional lines triggered by events such as level-up, low HP, boss victory, recruit join, or camp.
- Store recent notable moments for the run summary.
- Keep text original and compact.
- Allow lines to be data-driven by class or background.

## Out of Scope
- Interactive dialogue.
- Relationship simulation.
- Voice acting or portrait systems.

## Dependencies
- Existing combat/event logs.
- Feature 22 backgrounds if lines depend on background.

## Acceptance Criteria Draft
- Logs can show flavor lines without obscuring mechanical output.
- Run summary can show a few notable party moments.
- Flavor text can be disabled or kept secondary if needed.
- Tests cover notable-moment recording if it affects state.

## Planning Notes
- Keep mechanical logs primary for clarity.
- This is a polish issue and should not block core variety work.
