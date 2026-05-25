# Feature 09 — Leveling (M3.2)

## Goal
Apply XP thresholds, level up heroes with stat gains, and show level-up feedback.

## Source Docs
- `PROGRESSION_AND_REWARDS.md` (XP thresholds, level-up rules)
- `DATA_MODEL.md`
- `ROADMAP.md` (M3.2)

## Includes
- XP threshold table (e.g., level 2 at 50, level 3 at 120, etc. — pick small numbers from `PROGRESSION_AND_REWARDS.md`).
- On XP gain: detect threshold crossings, increment level, apply stat gains (max HP, primary stat), heal to new max HP (or by some amount — see design doc).
- Level-up panel inside or after the reward screen.
- Combat log / reward log records each level-up.
- Unit tests for threshold detection and stat gain application.

## Out of Scope
- Per-level action unlocks (out of prototype scope unless trivial).

## Acceptance Criteria
- Winning fights eventually levels up heroes.
- Level-up is visible to the player.
- Subsequent combat uses updated stats.
- Tests cover threshold math.

## Suggested Session Prompt
> Implement Feature 09 — Leveling. Read `PROGRESSION_AND_REWARDS.md`, `DATA_MODEL.md`, `ROADMAP.md` (M3.2). Add XP thresholds, level-up stat gains, level-up UI, and tests for the math.
