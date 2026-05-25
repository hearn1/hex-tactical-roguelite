# Feature 08 — Victory Reward Screen (M3.1)

## Goal
After winning a combat, open a reward screen that grants XP, gold, and an item/potion choice, and updates the party inventory.

## Source Docs
- `PROGRESSION_AND_REWARDS.md`
- `CONTENT_CATALOG.md` (reward pools)
- `DATA_MODEL.md` (Reward, Inventory)
- `ROADMAP.md` (M3.1)

## Includes
- `RewardManager` that generates a reward set on victory: XP per surviving hero, gold pool, 1–2 item offers, possibly a potion.
- Reward screen UI with: per-hero XP shown, gold total, and an item-choice list.
- Inventory data structure (party-shared bag + per-hero equipment from Feature 07).
- Equip or stash decision for chosen item (simple modal — pick which hero equips it, or send to bag).
- "Continue" button returns to a stub map screen (or back to a new sandbox combat for now — map lands in Feature 10).

## Out of Scope
- Level-up math (Feature 09).
- Map node integration (Feature 11).

## Acceptance Criteria
- Winning combat opens the reward screen.
- XP and gold are added to run state.
- Player can pick at least one item reward and equip/stash it.
- Gold and items persist across the screen transition.

## Suggested Session Prompt
> Implement Feature 08 — Victory Reward Screen. Read `PROGRESSION_AND_REWARDS.md`, `CONTENT_CATALOG.md`, `DATA_MODEL.md`, `ROADMAP.md` (M3.1). Add `RewardManager`, post-victory reward UI with XP/gold/item-choice, and inventory updates.
