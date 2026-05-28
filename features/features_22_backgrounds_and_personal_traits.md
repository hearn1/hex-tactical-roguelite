# Feature 22 - Backgrounds and Personal Traits (Future)

## Goal
Add lightweight character backgrounds or traits that modify a hero in small, readable ways.

## DnD-Feel Intent
Make heroes feel more like tabletop adventurers with a simple identity hook beyond class.

## Source Docs
- `SCOPE.md`
- `GAME_DESIGN.md`
- `DATA_MODEL.md`
- `PROGRESSION_AND_REWARDS.md`

## Skeleton Scope
- Add a small set of original backgrounds or traits.
- Each background grants one minor stat, item, gold, or event modifier.
- Show background text and mechanical effect in run setup and hero panels.
- Store chosen background on the hero instance for the run.

## Out of Scope
- Long backstory generation.
- Dialogue trees.
- Official D&D background names or proprietary content.
- Trait effects that require broad combat refactors.

## Dependencies
- Feature 21 run setup and party creation.
- Feature 19 data repository.

## Acceptance Criteria Draft
- Each starting hero can have one background or trait.
- Background effects apply consistently at run start.
- Effects are visible in the UI.
- Repository validation catches invalid background references.

## Planning Notes
- Start with 4 to 6 backgrounds.
- Prefer simple effects like +1 check stat, +5 gold, or one starter potion.
