# Feature 12 — Boss Encounter and Run End (M4.3)

## Goal
Add the boss encounter (Ogre Hexbreaker) with three boss actions and a reinforcement trigger, and finalize the run-end summary for both win and loss.

## Source Docs
- `MAP_AND_NODES.md` § Boss
- `CONTENT_CATALOG.md` § Boss: Ogre Hexbreaker, § Boss: encounter
- `COMBAT_DESIGN.md` § Enemy AI (boss tag)
- `ROADMAP.md` (M4.3)

## Includes

### Boss enemy def (`src/data/enemies.ts`)
```ts
enemy.ogre_hexbreaker:
  aiTag: "boss"
  stats: { maxHp: 42, armor: 13, move: 3, might: 4, agility: 0, spirit: 1 }
  actionIds: [action.massive_swing, action.ground_slam, action.roar]
```

### Boss actions (`src/data/actions.ts`)
- `action.massive_swing`: melee range 1, might, dmg `2d6 + might`.
- `action.ground_slam`: melee range 1, might, dmg `1d8 + might` to the **primary target plus all heroes adjacent to the boss** (multi-target).
- `action.roar`: range 3, no damage, applies `Weakened` to all heroes within range 3.

`resolveAction` needs to support multi-target effects. Extend `ActionDef.effect` with `targetMode?: "single" | "primary_plus_adjacent" | "aoe_around_caster"` and adjust the resolver accordingly.

### Boss AI (`src/combat/EnemyAI.ts`)
Add the `"boss"` branch. Use a fixed rotation list indexed by `combatState.bossActionIndex` (initialized to 0 in `createCombat`):

```ts
const BOSS_ROTATION = ["action.roar", "action.massive_swing", "action.ground_slam"] as const;
const actionId = BOSS_ROTATION[combatState.bossActionIndex % 3];
// resolve actionId; if it has no valid target (e.g. Roar with no hero in range 3),
// fall back to Massive Swing (closing to melee if needed).
combatState.bossActionIndex += 1;   // always advance, even on fallback
```

So the first boss turn uses Roar (`index=0`), second Massive Swing, third Ground Slam, fourth Roar again. The index lives on `CombatState` so it survives action resolution but resets between encounters.

### Reinforcement trigger
- On any damage application to the boss, check: if HP just crossed below 50% AND `combatState.bossReinforcementSpawned !== true`:
  - Spawn one `enemy.skeleton_archer` at a free hex behind the boss.
  - Add to `combatState.units` and to `turnQueue` (insert immediately after the boss's slot so it doesn't get a free turn first).
  - Set `bossReinforcementSpawned = true` so it never triggers again.
  - Log `[T?] The Hexbreaker calls reinforcement — a Skeleton Archer joins!`

### Boss encounter def
```ts
encounter.boss_ogre_hexbreaker:
  enemyGroups: [{ enemyId: "enemy.ogre_hexbreaker", count: 1 }]
  rewardPoolId: reward.boss   // optional; rewards are presentation-only for boss
```

Spawn position: center-right of grid, e.g., `{q:+2, r:0}`.

### Run-end summary (`src/ui/screens/RunSummary.ts`)
Triggered on:
- Boss defeated → `runStatus = "won"`.
- Party wipe in any combat → `runStatus = "lost"`.

Shows:
- Outcome banner (Victory / Defeat).
- Nodes cleared.
- Elites defeated.
- Boss defeated (Yes / No).
- Heroes leveled (count of distinct heroes who reached ≥ level 2).
- Gold accumulated.
- Items collected.
- Renown earned (use the **placeholder** formula `nodesCleared*2 + elitesDefeated*5 + (bossDefeated ? 15 : 0)` here; Feature 16 finalizes this).
- "Return to Main Menu" button → clears `gameState.run`.

### Tests (`src/combat/Boss.test.ts`)
- Boss rotation: with `bossActionIndex` starting at 0 and all targets valid, sequential `takeEnemyTurn` calls produce Roar, Massive Swing, Ground Slam, Roar (i.e., index 0, 1, 2, 3 → Roar, Massive Swing, Ground Slam, Roar).
- Reinforcement triggers exactly once when boss HP first crosses below 21 (50% of 42).
- Ground Slam hits primary + all adjacent heroes.

## Out of Scope
- Final Renown formula (Feature 16).
- Meta-upgrade menu (Feature 17).
- Persisting meta progression to disk (Feature 18).
- Boss phase changes beyond the reinforcement.

## Acceptance Criteria
- Boss node launches the boss encounter.
- The boss uses all 3 actions across a fight.
- Reinforcement triggers exactly once below 50% boss HP.
- Win and loss both navigate to a populated `RunSummary` screen.
- Returning to the main menu fully resets `gameState.run`.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/14 (Feature 12 — Boss and Run End).
>
> Read `MAP_AND_NODES.md`, `CONTENT_CATALOG.md` § Boss, `COMBAT_DESIGN.md` § Enemy AI, and `ROADMAP.md` (M4.3). Add the Ogre Hexbreaker with 3 actions (one multi-target), a rotating boss-AI branch, a one-time reinforcement trigger at <50% HP, and the `RunSummary` screen for both win and loss using a placeholder Renown formula. Pass the listed tests.
