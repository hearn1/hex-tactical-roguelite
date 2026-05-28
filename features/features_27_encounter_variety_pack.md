# Feature 27 - Encounter Variety Pack (Future)

## Goal
Add more combat encounter compositions using existing and lightly expanded enemy content.

## DnD-Feel Intent
Make fights feel like different scenes with different tactical problems instead of repeated enemy bundles.

## Source Docs
- `COMBAT_DESIGN.md`
- `CONTENT_CATALOG.md`
- `DATA_MODEL.md`
- `SCOPE.md`

## Skeleton Scope
- Add new encounter definitions with varied enemy counts, starting positions, and reward pools.
- Add encounter tags such as ambush, ruins, road, camp, or ritual if useful.
- Reuse existing enemy AI tags wherever possible.
- Add a small number of new original enemies only if the planning session approves them.

## Out of Scope
- Large bestiary.
- New AI architecture.
- Terrain hazards or line-of-sight blockers unless separately scoped.

## Dependencies
- Feature 19 data repository.
- Existing encounter launch flow.

## Acceptance Criteria Draft
- Combat nodes can select from a broader encounter pool.
- Encounters stay within active enemy and grid-size caps.
- Tests validate enemy IDs, actions, and reward pools.
- Manual playthrough shows noticeably different fight shapes.

## Planning Notes
- Decide whether this is data-only or includes 1 to 2 new enemy types.
- Keep enemy count within the prototype complexity budget.
