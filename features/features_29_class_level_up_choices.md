# Feature 29 - Class Level-Up Choices (Future)

## Goal
Replace or supplement automatic level-ups with small player choices.

## DnD-Feel Intent
Make character growth feel personal during a run, like choosing how an adventurer develops.

## Source Docs
- `PROGRESSION_AND_REWARDS.md`
- `CONTENT_CATALOG.md`
- `DATA_MODEL.md`
- `SCOPE.md`

## Skeleton Scope
- Offer 2 to 3 choices on level-up.
- Choices may include stat increases, max HP, action upgrades, or class-specific passive effects.
- Show selected upgrades on hero panels.
- Keep level caps aligned with prototype run length.

## Out of Scope
- Full feat system.
- Large spell lists.
- Subclasses.
- Respec UI.

## Dependencies
- Existing leveling system.
- Feature 19 data repository.

## Acceptance Criteria Draft
- Level-up pauses at a clear choice screen.
- Player can inspect choices before confirming.
- Chosen upgrade applies immediately and persists for the run.
- Tests cover applying each level-up reward type.

## Planning Notes
- Decide whether each class has unique upgrade tables.
- Keep first pass to level 2 or 3 choices.
