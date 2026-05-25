# Feature 09 — Leveling (M3.2)

## Goal
Apply the XP thresholds from `PROGRESSION_AND_REWARDS.md`, level up heroes with the documented stat gains, and show level-up feedback on the reward screen.

## Source Docs
- `PROGRESSION_AND_REWARDS.md` § XP and Leveling (canonical table + class gains)
- `COMBAT_DESIGN.md` § Stats (proficiency scales with level)
- `ROADMAP.md` (M3.2)

## Includes

### XP table (`src/run/Leveling.ts`)
Use exactly the table from `PROGRESSION_AND_REWARDS.md`:

```ts
export const XP_THRESHOLDS = [0, 20, 50, 90, 140] as const;   // index = level - 1
export const MAX_LEVEL = 5;

export function levelForXp(xp: number): number;             // 1..5
export function nextThresholdXp(level: number): number | null;  // null at MAX_LEVEL
```

### Stat gains (per `PROGRESSION_AND_REWARDS.md` § Level-Up Reward Phase 1)
Automatic per-class on level-up:
- Guardian: `maxHp +2`, `might +1`
- Acolyte: `maxHp +1`, `spirit +1`
- Arcanist: `maxHp +1`, `spirit +1`

Apply by incrementing `unit.bonusStats` (introduced in Feature 07). Then re-resolve `unit.stats` and **also** increase `unit.hp` by the maxHp gain (so the hero is not auto-healed to full — only the maxHp delta is added to current HP).

### Award flow
```ts
export function applyXp(unit: UnitInstance, xp: number): LevelUpResult;

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  gains: Partial<UnitStats>;
}
```

A single XP award can cross multiple thresholds (rare but possible) — loop until the unit's XP no longer crosses the next threshold.

### Reward screen integration
- After the existing "+XP per hero" display, check each hero for level-ups via `applyXp`.
- For each level-up, render an additional line: `"Mara reaches Level 2! (+2 max HP, +1 Might)"`.
- Update the combat log too (carry over from the previous combat or push to a run-level log).

### Tests (`src/run/Leveling.test.ts`)
- `levelForXp(0) === 1`, `levelForXp(19) === 1`, `levelForXp(20) === 2`, `levelForXp(140) === 5`, `levelForXp(999) === 5`.
- `applyXp` on a Guardian crossing from 19 → 20 XP yields `gains.maxHp === 2`, `gains.might === 1`.
- `applyXp(unit, 200)` on a level-1 Arcanist results in `unit.level === 5` and gains summed correctly across crossings.
- Current HP increases by the maxHp delta (not refilled to max).

## Out of Scope
- Per-level action unlocks (out of prototype scope unless trivial).
- Player-chosen stat gains (Phase 1 uses fixed gains per `PROGRESSION_AND_REWARDS.md`).

## Acceptance Criteria
- Winning a fight that pushes a hero past a threshold triggers level-up.
- The reward screen shows the level-up clearly.
- Subsequent combat uses updated stats (proficiency increase becomes visible at level 4: `2 + floor((4-1)/3) = 3`).
- All leveling tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/11 (Feature 09 — Leveling).
>
> Read `PROGRESSION_AND_REWARDS.md` § XP and Leveling and `ROADMAP.md` (M3.2). Add `src/run/Leveling.ts` with the canonical XP table and class-specific stat gains, wire `applyXp` into the reward screen flow with visible level-up messages, and pass the listed tests. Do not let leveling auto-heal heroes — only the maxHp delta is added to current HP.
