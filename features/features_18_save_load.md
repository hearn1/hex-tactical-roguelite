# Feature 18 — Save/Load Meta Progression (M6.3)

## Goal
Persist `MetaProgressionState` (Renown, purchased upgrade ranks, completed runs, boss wins) across app restarts via `localStorage`.

## Source Docs
- `ARCHITECTURE.md` § Save Schema
- `TECH_PLAN.md` § Save Data
- `ROADMAP.md` (M6.3)

## Includes

### Save schema (`src/meta/SaveLoad.ts`)
```ts
export const SAVE_KEY = "dnroguelite.meta.v1";

export interface SaveV1 {
  schemaVersion: 1;
  renown: number;
  upgradeRanks: Record<string, number>;
  completedRuns: number;
  bossWins: number;
}

export function saveMeta(meta: MetaProgressionState): void;
export function loadMeta(): MetaProgressionState;   // returns fresh defaults if missing/invalid
```

### Behavior
- `loadMeta()`:
  - Reads `localStorage[SAVE_KEY]`.
  - If absent → returns `{ renown: 0, upgradeRanks: {}, completedRuns: 0, bossWins: 0 }`.
  - If present but JSON parse fails → log warning, return defaults, do not overwrite the bad blob (so the user could potentially recover).
  - If present and `schemaVersion !== 1` → log warning, return defaults. Future migrations live here.
- `saveMeta(meta)`: writes JSON with `schemaVersion: 1`.

### Integration points
- Call `loadMeta()` once at app boot in `src/main.ts`. Assign to `gameState.meta`.
- Call `saveMeta(gameState.meta)`:
  - After any upgrade purchase in `MetaUpgrades` screen.
  - At the end of a run (after Renown is added to `gameState.meta` on the `RunSummary` screen).

### UI affordances
- Add a small "Wipe Save" button to the main menu (or the meta-upgrade screen) with a confirm step. On confirm: `localStorage.removeItem(SAVE_KEY)`, reset `gameState.meta` to defaults.

### Tests (`src/meta/SaveLoad.test.ts`)
- Use an injectable storage interface (default `localStorage`, tests pass a mock) to verify:
  - `saveMeta` writes the expected JSON shape.
  - `loadMeta` round-trips through `saveMeta` exactly.
  - Missing key → defaults.
  - Wrong schemaVersion → defaults + warning.
  - Corrupted JSON → defaults + warning, does not throw.

```ts
// Allow injection for tests:
export interface Storage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; }
export function saveMeta(meta: MetaProgressionState, storage: Storage = window.localStorage): void;
export function loadMeta(storage: Storage = window.localStorage): MetaProgressionState;
```

## Out of Scope
- Current-run save (excluded by `SCOPE.md`).
- Cloud saves.
- Schema v2 migration (no v2 exists yet).

## Acceptance Criteria
- Close and reopen the app: previously earned Renown and purchased upgrade ranks persist.
- Wipe Save resets to defaults.
- Corrupted save loads defaults without crashing.
- All save/load tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/20 (Feature 18 — Save/Load).
>
> Read `ARCHITECTURE.md` § Save Schema, `TECH_PLAN.md` § Save Data, and `ROADMAP.md` (M6.3). Add `src/meta/SaveLoad.ts` with `SAVE_KEY="dnroguelite.meta.v1"`, an injectable Storage interface for testability, `loadMeta` at boot, `saveMeta` after purchases and run end, a Wipe Save button, and pass the listed tests.
