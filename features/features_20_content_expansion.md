# Feature 20 — Content Expansion and Difficulty (M7.2)

## Goal
Use the data repository to add more encounters, items, events, and a difficulty modifier without changing core systems.

## Source Docs
- `CONTENT_CATALOG.md`
- `DATA_MODEL.md`
- `ROADMAP.md` (M7.2)

## Includes
- Add via data only:
  - 2 new encounters (mix existing enemies in new combos).
  - 3 new items.
  - 2 new event scenarios.
- Difficulty tiers (Normal / Hard):
  - Hard: +20% enemy HP, +1 enemy damage, +20% rewards.
  - Selected at run start.
- New-run UI exposes difficulty choice.

## Out of Scope
- New enemy types (would need new AI/actions — keep scope tight).
- A full second act (`SCOPE.md` caps at 1 act).

## Acceptance Criteria
- New encounters/items/events appear in runs.
- Difficulty selection visibly changes enemy stats and rewards.
- Core system code did not need significant edits (validates Feature 19's pipeline).

## Suggested Session Prompt
> Implement Feature 20 — Content Expansion and Difficulty. Read `CONTENT_CATALOG.md`, `DATA_MODEL.md`, `ROADMAP.md` (M7.2). Add encounters/items/events via data only, add a Normal/Hard difficulty toggle on new-run setup, and confirm core code stayed mostly untouched.
