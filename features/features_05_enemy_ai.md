# Feature 05 — Enemy AI (M1.5)

## Goal
Make enemy turns resolve automatically. Closes the M1 sandbox: a full combat plays start to finish without player input on enemy turns.

## Source Docs
- `ARCHITECTURE.md`
- `COMBAT_DESIGN.md` § Enemy AI (basic priority + tags)
- `CONTENT_CATALOG.md` (AI tags per enemy)
- `ROADMAP.md` (M1.5)

## Includes

### `src/combat/EnemyAI.ts`
```ts
export function takeEnemyTurn(unit: UnitInstance, state: CombatState): void;
```

Implementation, following `COMBAT_DESIGN.md` § Basic AI Priority (simplified for what exists at this feature — heal/ally-kill priorities are deferred to later when those actions exist):

1. Determine `aiTag` from the enemy's def (default `"brute"`).
2. Compute `enemyAction` = the unit's primary attack action.
3. Pick `target` = lowest-HP living hero. Tie-break: closest by distance, then by `instanceId`.
4. **Brute** branch:
   - If `target` is within action range, attack.
   - Else move toward target up to `movePointsRemaining` hexes (BFS path; stop at first hex adjacent to target or when points run out). If now in range, attack.
5. **Skirmisher** branch:
   - If `distance(self, target) > action.range`, close to a hex where `distance == action.range`.
   - If `distance(self, target) < action.range` and there's a hex at distance `== action.range` reachable within `movePointsRemaining`, retreat to it.
   - Attack if in range.
6. **Support / caster / boss** tags fall back to brute behavior in this feature (boss-specific behavior lands in Feature 12; heal-AI when Acolyte-style enemies are added later).
7. Always end the turn at the end (set `hasActed`, advance the queue).

Reuse `Movement.reachableHexes` and `Action.resolveAction` — do not duplicate combat math here.

### Pacing
- Add a small delay (e.g., 400ms) between enemy AI steps so the player can read the log. Implement with a simple async/await or `setTimeout` chain; do not block the UI.
- Disable the End Turn and action buttons during enemy turns.

### Integration
- After the player clicks End Turn (or after victory/defeat check passes through to an enemy unit), the turn advance routine should:
  - If the new active unit is on the enemy team, call `takeEnemyTurn(...)` then advance again.
  - Continue until the active unit is a (living) hero or combat ends.

### Tests (`src/combat/EnemyAI.test.ts`)
- Brute moves toward a single target on an open grid.
- Brute attacks instead of moving when target is adjacent.
- Skirmisher stops at `range` distance instead of closing to melee.
- AI does not crash when no living hero remains (it should end the turn cleanly; combat status will be set to "defeat" by the action resolver before this anyway).

## Out of Scope
- Boss scripted behavior (Feature 12).
- Support-type heal AI (no enemy actions need it yet).
- Smart positioning (line-of-sight, flanking) — explicitly out of prototype scope.

## Acceptance Criteria
- A full combat plays automatically on enemy turns.
- Brutes close to melee; skirmishers maintain range.
- Combat resolves to victory or defeat with zero player input on enemy turns.
- M1 sandbox is complete: a player can run a combat encounter end to end.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/7 (Feature 05 — Enemy AI).
>
> Read `ARCHITECTURE.md`, `COMBAT_DESIGN.md` § Enemy AI, `CONTENT_CATALOG.md` AI tags, and `ROADMAP.md` (M1.5). Add `src/combat/EnemyAI.ts` implementing brute and skirmisher behaviors using the existing Movement + Action modules, wire it into the turn-advance routine with a small delay between steps, and verify a full combat resolves automatically.
