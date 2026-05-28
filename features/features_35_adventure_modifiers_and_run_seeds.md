# Feature 35 - Adventure Modifiers and Run Seeds (Future)

## Goal
Add run-level modifiers that change the feel of an adventure without adding new core systems.

## DnD-Feel Intent
Let runs feel like different adventure premises, such as cursed roads, generous patrons, or dangerous ruins.

## Source Docs
- `GAME_DESIGN.md`
- `DATA_MODEL.md`
- `PROGRESSION_AND_REWARDS.md`
- `SCOPE.md`

## Skeleton Scope
- Define a small set of run modifiers with clear bonuses and drawbacks.
- Select one modifier during run setup or through meta progression.
- Show modifier rules on the map and run summary.
- Use seeded RNG for reproducibility.

## Out of Scope
- Daily runs or online leaderboards.
- Complex challenge modes.
- Multiple difficulty ladders beyond existing difficulty tiers.

## Dependencies
- Feature 21 run setup and party creation.
- Existing difficulty system from Feature 20 if present.

## Acceptance Criteria Draft
- A run can start with one visible adventure modifier.
- Modifier effects apply consistently and are logged where relevant.
- Tests cover modifier application and deterministic selection.
- Modifier does not invalidate the base difficulty toggle.

## Planning Notes
- Keep modifiers few and readable.
- Consider unlocking modifiers through Renown later.
