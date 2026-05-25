# Feature 18 — Save/Load Meta Progression (M6.3)

## Goal
Persist meta progression (Renown, purchased upgrades, completed runs) across app restarts.

## Source Docs
- `TECH_PLAN.md` (save fields)
- `ROADMAP.md` (M6.3)

## Includes
- Serialize `MetaProgressionState` matching the schema in `TECH_PLAN.md`:
  ```json
  {
    "renown": 0,
    "purchasedUpgradeIds": [],
    "upgradeRanks": {},
    "completedRuns": 0,
    "bossWins": 0
  }
  ```
- Save target depends on stack:
  - Web: `localStorage` under a versioned key (e.g., `dnroguelite.meta.v1`).
  - Desktop: a save file in the app data folder.
- Save on run end and on upgrade purchase.
- Load on app start; default to fresh state if absent or invalid.
- Handle schema-version mismatch by resetting (with a console warning).

## Out of Scope
- Current-run save/load (explicitly out of prototype scope per `SCOPE.md`).
- Cloud save.

## Acceptance Criteria
- Close and reopen the app: previously purchased upgrades and Renown persist.
- Corrupted save resets safely.

## Suggested Session Prompt
> Implement Feature 18 — Save/Load. Read `TECH_PLAN.md`, `ROADMAP.md` (M6.3). Serialize `MetaProgressionState` to localStorage (or platform equivalent), load on app start, and verify persistence across restarts.
