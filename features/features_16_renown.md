# Feature 16 — Renown Calculation (M6.1)

## Goal
Replace the placeholder Renown number on the run-end summary with the canonical formula from `PROGRESSION_AND_REWARDS.md`, with a visible breakdown.

## Source Docs
- `PROGRESSION_AND_REWARDS.md` § Meta-Currency (canonical formula)
- `ROADMAP.md` (M6.1)

## Includes

### Formula (`src/meta/Renown.ts`)
Exactly per `PROGRESSION_AND_REWARDS.md`:

```
renownEarned = nodesCleared * 2
             + elitesDefeated * 5
             + bossDefeated   * 15
             + charactersLeveled * 1
minimum failed-run reward = 1
```

```ts
export interface RenownBreakdown {
  nodes: number;       // nodesCleared * 2
  elites: number;      // elitesDefeated * 5
  boss: number;        // 15 if boss defeated else 0
  characters: number;  // count of heroes with level >= 2
  minimumApplied: boolean;
  total: number;
}

export function computeRenown(run: RunState): RenownBreakdown;
```

`charactersLeveled` = count of heroes in `RunState.party` with `level >= 2` at run end.

Apply `Math.max(1, total)` only if the run was lost.

### RunState additions
Ensure these counters exist (some added in Feature 10/11/12, double-check):
- `nodesCleared: number`
- `elitesDefeated: number`
- `bossDefeated: boolean`
- `runStatus: "active" | "won" | "lost"`

`MetaProgressionState.renown` is added but **not yet persisted to disk** (that's Feature 18). In-memory only.

### Run summary update
On the `RunSummary` screen (from Feature 12), show:

```
Renown earned: 11
  Nodes cleared (×2): 6
  Elites (×5): 0
  Boss (×15): 0
  Characters leveled (×1): 5
```

Plus, after a win, increment `MetaProgressionState.renown += total` and (if applicable) `bossWins += 1`, `completedRuns += 1`. After a loss, increment `renown += total` and `completedRuns += 1`.

### Tests (`src/meta/Renown.test.ts`)
- Empty run (no nodes cleared, no boss, no levels) → 1 on loss, 0 on win.
- 4 nodes cleared, 1 elite, no boss, 3 chars leveled → `8 + 5 + 0 + 3 = 16`.
- 6 nodes cleared, 1 elite, boss defeated, 4 chars leveled → `12 + 5 + 15 + 4 = 36`.
- The minimum-1-on-loss rule is applied only on loss.

## Out of Scope
- Saving Renown to disk (Feature 18).
- Spending Renown (Feature 17).

## Acceptance Criteria
- Run summary's Renown number matches the formula with a visible breakdown.
- `MetaProgressionState.renown` increases after each run.
- All Renown tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/18 (Feature 16 — Renown Calculation).
>
> Read `PROGRESSION_AND_REWARDS.md` § Meta-Currency and `ROADMAP.md` (M6.1). Add `src/meta/Renown.ts` with `computeRenown` exactly matching the canonical formula, update the run summary to show the breakdown, increment `MetaProgressionState.renown` after each run (in-memory only), and pass the listed tests.
