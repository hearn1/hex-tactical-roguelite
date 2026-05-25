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
Add the `"boss"` branch:

```
Each turn the boss picks an action by rotation, skipping any with no valid target:
  turn 1 mod 3 → Roar (if any hero in range 3) else Massive Swing
  turn 2 mod 3 → Massive Swing (close to nearest hero first)
  turn 0 mod 3 → Ground Slam (close to nearest hero first)
```

Track rotation per-boss in `combatState.bossActionIndex` (default 0). Increment after each attack.

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
- Boss rotation: turns 1, 2, 3, 4 produce Roar, Massive Swing, Ground Slam, Roar (assuming valid targets).
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
