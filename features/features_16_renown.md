# Feature 16 — Renown Calculation (M6.1)

## Goal
Calculate Renown at run end (win or loss) and show it on the run-end summary.

## Source Docs
- `PROGRESSION_AND_REWARDS.md` (Renown formula)
- `ROADMAP.md` (M6.1)

## Includes
- Renown formula (pick a simple one consistent with `PROGRESSION_AND_REWARDS.md`):
  - +1 per combat won, +5 for boss kill, +1 per uncommon+ item acquired, etc.
- Replace the placeholder Renown number on the run-end summary (from Feature 12) with the computed value.
- Show breakdown ("Combats: +4, Boss: +5, Items: +2 — Total: 11 Renown").
- Unit tests for the formula.

## Out of Scope
- Persistence (Feature 18).
- Spending Renown (Feature 17).

## Acceptance Criteria
- Both win and loss screens show a real Renown number with breakdown.
- Tests cover the formula.

## Suggested Session Prompt
> Implement Feature 16 — Renown Calculation. Read `PROGRESSION_AND_REWARDS.md`, `ROADMAP.md` (M6.1). Add a deterministic Renown formula, plug it into the run-end summary with a visible breakdown, and unit-test it.
