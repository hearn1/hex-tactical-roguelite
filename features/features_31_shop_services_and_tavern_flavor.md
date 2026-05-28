# Feature 31 - Shop Services and Tavern Flavor (Future)

## Goal
Expand non-combat merchant nodes with services and light adventuring flavor.

## DnD-Feel Intent
Make shops feel like places adventurers stop between dangers, not just item lists.

## Source Docs
- `MAP_AND_NODES.md`
- `PROGRESSION_AND_REWARDS.md`
- `CONTENT_CATALOG.md`
- `SCOPE.md`

## Skeleton Scope
- Add shop services such as heal, remove temporary drawback, identify/upgrade item, buy rumor, or hire guide.
- Add short original flavor text per shop type.
- Keep prices visible and disabled when unaffordable.
- Persist shop inventory and purchased services per node.

## Out of Scope
- Large economy simulation.
- Crafting, sockets, affixes, or item identification complexity.
- Dialogue trees.

## Dependencies
- Existing shop screen.
- Feature 24 expanded event framework if rumors create events.

## Acceptance Criteria Draft
- Shop has at least two service options beyond buying items.
- Services apply clear, testable run-state changes.
- UI shows prices and effects before purchase.
- Tests cover service affordability and state updates.

## Planning Notes
- "Buy rumor" could preview an upcoming node or reveal an event, but keep first pass simple.
