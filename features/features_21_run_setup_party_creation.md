# Feature 21 - Run Setup and Party Creation (Future)

## Goal
Add a pre-run setup flow where the player chooses or customizes the starting party before entering the map.

## DnD-Feel Intent
Give each run the feeling of assembling an adventuring party without building a full tabletop character creator.

## Source Docs
- `SCOPE.md`
- `GAME_DESIGN.md`
- `DATA_MODEL.md`
- `CONTENT_CATALOG.md`

## Skeleton Scope
- Choose starting heroes from available class options.
- Rename heroes for the current run.
- Show class role, stats, starting actions, and starting gear before confirmation.
- Apply existing meta upgrades to the setup flow where relevant.
- Keep default quick-start party available.

## Out of Scope
- Full 5E character sheets.
- Subclasses, feats, multiclassing, species rules, or point-buy ability generation.
- Cosmetic portrait generation.

## Dependencies
- Feature 18 save/load meta progression.
- Feature 19 data repository.
- Existing class and item definitions.

## Acceptance Criteria Draft
- Player can start a run with the default party or a chosen party.
- Player choices are visible before confirming the run.
- Invalid party setups are disabled or explained.
- Tests cover setup validation and meta-upgrade application.

## Planning Notes
- Decide minimum and maximum starting party size.
- Decide whether duplicate classes are allowed.
- Decide whether this replaces or extends the existing new-run difficulty setup.
