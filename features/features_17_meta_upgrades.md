# Feature 17 — Meta Upgrade Menu (M6.2)

## Goal
Add a meta-upgrade menu accessible from the main menu where the player spends Renown on permanent starting bonuses applied to each new run.

## Source Docs
- `PROGRESSION_AND_REWARDS.md`
- `CONTENT_CATALOG.md` (Permanent Upgrades table)
- `ROADMAP.md` (M6.2)

## Includes
- Implement the 5 starter upgrades from `CONTENT_CATALOG.md`:
  - Coin Purse I (5R, +5 starting gold)
  - Coin Purse II (10R, +5 more starting gold)
  - Training Manual I (8R, +10 starting XP)
  - Potion Belt I (8R, +1 Healing Potion at start)
  - Veteran Guardian (12R, Guardian +1 Might)
  - (Apprentice Kit can be a stretch.)
- Meta-upgrade menu screen reachable from main menu.
- Purchased upgrades stored in `MetaProgressionState`.
- New runs apply purchased upgrades to starting state (gold, party XP, party items, party stats).

## Out of Scope
- Save/load to disk (Feature 18).

## Acceptance Criteria
- Player can buy at least one upgrade after a run that earned enough Renown.
- New runs reflect the upgrade.
- Insufficient Renown disables a purchase with a clear reason.

## Suggested Session Prompt
> Implement Feature 17 — Meta Upgrade Menu. Read `PROGRESSION_AND_REWARDS.md`, `CONTENT_CATALOG.md`, `ROADMAP.md` (M6.2). Add the upgrade catalog, a purchase UI, and apply purchased upgrades to new-run starting state.
