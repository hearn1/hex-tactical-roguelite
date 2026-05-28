# Feature 36 - Bestiary and Rules Glossary (Future)

## Goal
Add an in-game reference for enemies, conditions, actions, and common rules.

## DnD-Feel Intent
Give the game a tabletop manual feel while making decisions clearer for the player.

## Source Docs
- `COMBAT_DESIGN.md`
- `CONTENT_CATALOG.md`
- `DATA_MODEL.md`
- `SCOPE.md`

## Skeleton Scope
- Add a simple glossary screen or panel.
- Include known enemy entries, action keywords, conditions, and basic roll explanations.
- Reveal enemy entries after first encounter or show all prototype entries, pending planning.
- Link or surface glossary text from existing tooltips where practical.

## Out of Scope
- Full codex with lore chapters.
- Achievement tracking.
- Spoiler-heavy boss strategy guide.

## Dependencies
- Feature 19 data repository.
- Existing UI shell and tooltips.

## Acceptance Criteria Draft
- Player can inspect rules and known enemies without leaving the run.
- Glossary pulls from existing definitions where possible.
- Text stays concise and original.
- Tests cover data extraction if implemented as pure logic.

## Planning Notes
- This may be valuable before adding many events and items.
- Decide whether entries are always visible or discovered over time.
