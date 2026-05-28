# Feature 32 - Magic Item Identity Pack (Future)

## Goal
Add a focused set of magic items with small, flavorful mechanical hooks.

## DnD-Feel Intent
Make loot feel more magical and characterful while avoiding a huge item database.

## Source Docs
- `CONTENT_CATALOG.md`
- `PROGRESSION_AND_REWARDS.md`
- `DATA_MODEL.md`
- `SCOPE.md`

## Skeleton Scope
- Add 8 to 12 original uncommon or rare items.
- Include a mix of weapons, armor, trinkets, and consumables.
- Prefer simple hooks such as once-per-combat bonuses, action modifiers, or conditional stat boosts.
- Add item flavor text to reward and inventory views.

## Out of Scope
- Large affix generation.
- Crafting or sockets.
- Official magic item names.
- Complex triggered effects that require hidden state.

## Dependencies
- Feature 19 data repository.
- Existing equipment and reward systems.

## Acceptance Criteria Draft
- New items can appear in reward and shop pools.
- Item effects are visible before selection or purchase.
- Item hooks are testable and do not bypass action validation.
- Repository validation covers new item references.

## Planning Notes
- Decide a maximum number of special-case item handlers allowed before creating a generic effect system.
