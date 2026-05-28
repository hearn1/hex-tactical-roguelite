# Feature 24 - Expanded Event Framework (Future)

## Goal
Upgrade events from a small set of hardcoded effects into a broader data-driven framework.

## DnD-Feel Intent
Make the run feel like a chain of adventure scenes, not only fights and shops.

## Source Docs
- `SCOPE.md`
- `DATA_MODEL.md`
- `MAP_AND_NODES.md`
- `CONTENT_CATALOG.md`

## Skeleton Scope
- Support reusable event effect types such as gold, damage, healing, XP, item, potion, buff, and check.
- Support choice requirements such as minimum gold, living hero, or item possession.
- Persist selected event per map node.
- Add clear event result logging.

## Out of Scope
- Dialogue trees.
- Multi-page quest chains.
- Complex scripting language.

## Dependencies
- Existing event screen.
- Feature 19 data repository.
- Feature 23 ability checks lite if checks are included.

## Acceptance Criteria Draft
- Multiple events can be defined in data without screen-specific code.
- Invalid choices are disabled or explained.
- Event outcomes update run state correctly.
- Tests cover each supported event effect type.

## Planning Notes
- This should be a system issue before large event content packs.
- Keep the first implementation deliberately small.
