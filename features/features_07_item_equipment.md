# Feature 07 — Item Equipment (M2.2)

## Goal
Equip items in weapon/armor/trinket slots and have their stat bonuses and item-granted actions affect combat.

## Source Docs
- `CONTENT_CATALOG.md` (items)
- `DATA_MODEL.md` (Item, EquipmentSlot)
- `ROADMAP.md` (M2.2)

## Includes
- `Item` definition with slot, stat bonuses, optional granted-action ids.
- Equipment slots on each hero: Weapon, Armor, Trinket.
- Pre-equip the starting party with simple items for testing (e.g., Iron Sword on Guardian, Apprentice Wand on Arcanist).
- Stat bonuses apply when computing combat values.
- Item-granted actions appear on the action bar (e.g., Hunter Bow → Arrow Shot).
- Simple equipment UI (text panel or modal) showing each hero's slots; no swap UI needed yet.

## Out of Scope
- Inventory storage UI (Feature 08 reward screen).
- Buying/selling (Feature 13 shop).

## Acceptance Criteria
- Each starter hero has at least one item equipped at combat start.
- Stat bonuses are visible in unit stats and affect rolls.
- At least one item grants an action visible on the action bar.

## Suggested Session Prompt
> Implement Feature 07 — Item Equipment. Read `CONTENT_CATALOG.md`, `DATA_MODEL.md`, `ROADMAP.md` (M2.2). Add Item definitions, three equipment slots per hero, pre-equipped starter items, and verify granted actions and stat bonuses apply in combat.
