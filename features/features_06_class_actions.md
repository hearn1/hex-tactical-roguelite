# Feature 06 — Class Actions (M2.1)

## Goal
Give each hero their full starter action set (3 actions each) with tooltips, action buttons, and clear invalid-reason messaging.

## Source Docs
- `COMBAT_DESIGN.md` (action types, conditions)
- `CONTENT_CATALOG.md` (full action lists per class)
- `DATA_MODEL.md`
- `ROADMAP.md` (M2.1)

## Includes
- Implement all 9 hero actions from `CONTENT_CATALOG.md`:
  - Guardian: Slash, Shield Bash, Guard
  - Acolyte: Mace Strike, Mend Wounds, Bless
  - Arcanist: Fire Bolt, Frost Shard, Arcane Ward
- Implement the supporting conditions: Weakened, Guarded, Blessed, Slowed (minimal stat-effect implementations).
- Action bar UI for the active hero with one button per action.
- Tooltip per action: name, range, effect description.
- Invalid-action reason shown when an action can't be used (no valid target, out of range, etc.).
- Once-per-combat actions (if any) tracked on UnitState.
- Combat log records condition applications.

## Out of Scope
- Item-granted actions (Feature 07).
- Cooldown UI beyond once-per-combat.

## Acceptance Criteria
- Each hero plays differently.
- All 9 actions resolve correctly.
- Conditions visibly affect subsequent rolls (Weakened/Blessed/Guarded/Slowed).
- Disabled action buttons explain why.

## Suggested Session Prompt
> Implement Feature 06 — Class Actions. Read `COMBAT_DESIGN.md`, `CONTENT_CATALOG.md`, `DATA_MODEL.md`, `ROADMAP.md` (M2.1). Add the full 9 hero actions, the 4 starter conditions, action-bar UI with tooltips, and invalid-reason messages.
