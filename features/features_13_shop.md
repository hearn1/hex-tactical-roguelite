# Feature 13 — Shop Node (M5.1)

## Goal
Implement the shop node: spend gold to buy items/potions, optionally pay for a heal service.

## Source Docs
- `MAP_AND_NODES.md`
- `CONTENT_CATALOG.md` (shop inventory format)
- `ROADMAP.md` (M5.1)

## Includes
- Shop screen launched from a Shop node.
- Inventory: 2 common items, 1 uncommon item, 2 potions, 1 "Heal Party" service (per `CONTENT_CATALOG.md`).
- Item prices (define a small price table by rarity in code or in `data/items.json` if data-pipeline isn't built yet).
- Buy flow: deduct gold, add item to party bag or equip directly.
- Sold-out state for purchased items.
- "Leave" returns to the map.

## Out of Scope
- Selling items back.
- Restock mechanics.

## Acceptance Criteria
- Player can spend gold to acquire items/potions.
- Player can pay to heal the party.
- Shop persists sold-out state if revisited (or shop nodes are single-use — pick one and document).

## Suggested Session Prompt
> Implement Feature 13 — Shop Node. Read `MAP_AND_NODES.md`, `CONTENT_CATALOG.md`, `ROADMAP.md` (M5.1). Build the shop screen with the catalog's inventory, gold deduction, item acquisition, and a heal service.
