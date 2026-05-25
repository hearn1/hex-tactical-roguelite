# Feature 04 — Actions, Damage, Healing (M1.4)

## Goal
Add one action per hero and per enemy with the full attack-roll → damage/heal → defeat → victory/defeat pipeline. Class action **sets** (3 per hero) land in Feature 06.

## Source Docs
- `ARCHITECTURE.md` § Attack Resolution (canonical), § Dice Helper, § RNG
- `COMBAT_DESIGN.md` § Attack Roll, § Damage and Healing, § Combat Completion
- `CONTENT_CATALOG.md` § Player Actions, § Enemy Actions
- `DATA_MODEL.md` § ActionDef
- `ROADMAP.md` (M1.4)

## Includes

### Action definition (`src/data/actions.ts`)
Add these for this feature:

```ts
export interface ActionDef {
  id: string;
  displayName: string;
  source: "class" | "item" | "enemy";
  targetType: "enemy" | "ally" | "self";
  range: number;                    // hex distance; 1 = melee adjacent
  accuracyStat: "might" | "agility" | "spirit";
  effect:
    | { type: "damage"; formula: string }     // e.g., "1d6 + might"
    | { type: "heal";   formula: string };
}
```

Implement these specific actions (per `CONTENT_CATALOG.md`):
- `action.slash` — Guardian, melee, range 1, might, `1d6 + might`
- `action.mend_wounds` — Acolyte, target ally, range 3, spirit, heal `1d6 + spirit`
- `action.fire_bolt` — Arcanist, target enemy, range 4, spirit, `1d8 + spirit`
- `action.rusty_stab` — Goblin enemy, range 1, might, `1d4 + might`
- `action.bite` — Wolf enemy, range 1, might, `1d6 + might`
- `action.bone_arrow` — Skeleton enemy (if used), range 5, agility, `1d6 + agility`

Add these to each unit's `actionIds` in their class/enemy def. Heroes get exactly **one** action this feature.

### Dice (`src/core/dice.ts`)
Implement `roll(spec, rng)` per `ARCHITECTURE.md` § Dice Helper. Tests:
- `roll("1d6+3", rng)` returns total in `[4, 9]` and rolls of length 1.
- `roll("2d4", rng)` returns total in `[2, 8]` and rolls of length 2.
- Same seed produces same total.

### Resolver (`src/combat/Action.ts`)
```ts
export function validTargets(action: ActionDef, attacker: UnitInstance, state: CombatState): UnitInstance[];
export function resolveAction(action: ActionDef, attacker: UnitInstance, target: UnitInstance, state: CombatState): void;
```

`validTargets`:
- self-target → `[attacker]`
- ally-target → same team within `range`
- enemy-target → opposite team within `range`, living

`resolveAction` for **damage** type uses the exact pipeline in `ARCHITECTURE.md` § Attack Resolution:
1. Roll `d20 = floor(rng()*20)+1`.
2. `proficiency = 2 + floor((attacker.level - 1) / 3)` — at level 1, always 2.
3. `roll = d20 + attacker.stats[accuracyStat] + proficiency`.
4. Natural 1 → auto-miss.
5. Natural 20 → crit (auto-hit, double rolled damage).
6. Otherwise hit if `roll >= target.stats.armor`.
7. On hit, parse formula. Numeric part via `roll("1d6", rng)`; stat substitution (`+ might` → `+ attacker.stats.might`) handled inline.
8. On crit, multiply damage by 2.
9. `target.hp = max(0, target.hp - dmg)`. If `target.hp === 0`, mark defeated.

For **heal** type:
- No to-hit roll. Roll formula + spirit, cap at `target.stats.maxHp`.

After every action, set `attacker.hasActed = true`. The turn doesn't auto-end — player must click End Turn.

### Defeat handling
- A unit at 0 HP is removed from the grid render and from `turnQueue` (do not shift `activeIndex` past the current unit).
- After every action, check victory/defeat:
  - All enemies defeated → `combatState.status = "victory"`. Show a "Victory" banner with a "Continue" button that returns to the main menu (real map flow comes in Feature 11).
  - All heroes defeated → `combatState.status = "defeat"`. Show a "Defeat" banner with the same Continue → main menu.

### UI
- Action bar at the bottom of the combat screen showing the active unit's action(s). One button per action.
- Click action → enter targeting mode → valid targets highlight → click a target to resolve.
- Right-click or Esc cancels targeting mode.
- Disabled action: show why (e.g., "Already acted this turn", "No valid targets").
- HP bar updates immediately.

### Combat log
- `[T3] Mara uses Slash on Goblin — d20=14 +3+2=19 vs 12 → hit, 8 dmg. Goblin: 0/8 HP — defeated.`
- `[T3] Sable uses Mend Wounds on Eldra — heal 7. Eldra: 11/11 HP.`
- `[T3] Goblin attempts Rusty Stab on Mara — d20=1 → auto-miss.`
- `[T4] Victory.` / `[T4] Defeat.`

### Tests (`src/combat/Action.test.ts`)
- Damage: HP floors at 0 (no negative HP).
- Heal: HP caps at maxHp (no overheal).
- Natural 20 → always hits, damage doubled.
- Natural 1 → always misses regardless of total.
- `validTargets` for Fire Bolt at range 4 includes enemies within 4 and excludes own team and out-of-range enemies.

## Out of Scope
- Multiple actions per hero (Feature 06).
- Item-granted actions (Feature 07).
- Conditions (Feature 06).
- Enemy AI — enemies still have buttons too, or the player clicks End Turn for them. Either is fine.

## Acceptance Criteria
- Each hero can attack/heal once per turn with their assigned action.
- Damage and healing apply correctly with caps.
- Victory or Defeat banner appears at end and returns to main menu.
- All tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/6 (Feature 04 — Actions).
>
> Read `ARCHITECTURE.md` § Attack Resolution + Dice Helper, `COMBAT_DESIGN.md` § Attack Roll / Damage / Combat Completion, `CONTENT_CATALOG.md` actions, `DATA_MODEL.md` § ActionDef, and `ROADMAP.md` (M1.4). Implement `core/dice.ts`, `combat/Action.ts` (validTargets + resolveAction), wire one starter action to each hero and enemy, add action-bar UI with targeting mode, defeat removal, victory/defeat banners, and pass the listed tests.
