# Feature 19 — Data Repository (M7.1)

## Goal
Move hardcoded game content (classes, actions, items, enemies, encounters, upgrades) into structured data files behind a central `DataRepository`, with validation.

## Source Docs
- `DATA_MODEL.md`
- `TECH_PLAN.md` (data-driven content folder layout)
- `ROADMAP.md` (M7.1)

## Includes
- Create `data/` files (or equivalent):
  - `classes.json`, `actions.json`, `items.json`, `enemies.json`, `encounters.json`, `nodes.json`, `rewards.json`, `upgrades.json`
- `DataRepository` loads and exposes definitions by id.
- Validation pass on load: missing id references (e.g., an enemy referencing a non-existent action) produce a clear error.
- Refactor existing systems (combat, rewards, shop, meta upgrades, map encounters) to fetch from `DataRepository` instead of hardcoded constants.
- Tests: validation catches broken references.

## Out of Scope
- Hot-reload / live-edit (nice-to-have, skip).

## Acceptance Criteria
- All content lives in `data/` files.
- Existing gameplay still works unchanged.
- Adding a new item/enemy/action requires editing only `data/` and (if needed) a small effect-handler hook — not core systems.
- Broken references produce a clear startup error.

## Suggested Session Prompt
> Implement Feature 19 — Data Repository. Read `DATA_MODEL.md`, `TECH_PLAN.md`, `ROADMAP.md` (M7.1). Move all content into `data/` JSON files, build `DataRepository` with validation, refactor systems to consume it, and verify gameplay is unchanged.
