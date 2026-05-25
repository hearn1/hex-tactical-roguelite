# Feature 06 — Class Actions and Conditions (M2.1)

## Goal
Expand each hero to a full 3-action set, add the 4 prototype conditions, and surface tooltips + invalid-reason messages on the action bar.

## Source Docs
- `ARCHITECTURE.md`
- `COMBAT_DESIGN.md` § Prototype Conditions, § Prototype Classes
- `CONTENT_CATALOG.md` § Player Actions
- `ROADMAP.md` (M2.1)

## Includes

### Actions to add (`src/data/actions.ts`)
All 9 hero actions, with the formulas exactly from `CONTENT_CATALOG.md`:

| Action | User | Range | TargetType | AccuracyStat | Effect |
|---|---|---:|---|---|---|
| `action.slash` (existing) | Guardian | 1 | enemy | might | dmg `1d6 + might` |
| `action.shield_bash` | Guardian | 1 | enemy | might | dmg `1d4 + might`, on hit apply `Weakened` |
| `action.guard` | Guardian | self | self | — | apply `Guarded` to self |
| `action.mace_strike` | Acolyte | 1 | enemy | might | dmg `1d6 + might` |
| `action.mend_wounds` (existing) | Acolyte | 3 | ally | spirit | heal `1d6 + spirit` |
| `action.bless` | Acolyte | 3 | ally | — | apply `Blessed` to target |
| `action.fire_bolt` (existing) | Arcanist | 4 | enemy | spirit | dmg `1d8 + spirit` |
| `action.frost_shard` | Arcanist | 4 | enemy | spirit | dmg `1d6 + spirit`, on hit apply `Slowed` |
| `action.arcane_ward` | Arcanist | 3 | ally | — | apply `Guarded` to target (`self` allowed) |

Extend `ActionDef.effect` to support an optional `applyCondition: { id, duration }` rider on damage actions, and a new `effect.type: "applyCondition"` for buff-only actions (Guard, Bless, Arcane Ward).

### Conditions (`src/combat/Condition.ts`)
```ts
export type ConditionId = "guarded" | "weakened" | "blessed" | "slowed";

export interface Condition {
  id: ConditionId;
  remainingTurns: number;   // ticked at end of bearer's turn
  // 'guarded' uses 'remainingTurns = 1' but also consumes on first damage trigger
}
```

Mechanics (exactly per `COMBAT_DESIGN.md`):
- **Guarded**: incoming damage halved (min 1). Consumed on first damage trigger OR at the bearer's next turn start, whichever comes first.
- **Weakened**: -2 to attack rolls. Duration 1 turn (ticks at end of bearer's next turn).
- **Blessed**: +2 to the *next* attack roll OR heal roll made by the bearer; consumed on use. Duration 2 turns max if unused.
- **Slowed**: -1 movement next turn. Duration 1 turn.

Hooks:
- Modify `resolveAction` to check the attacker's `Blessed` (consume +2 on the next roll) and `Weakened` (-2 to attack roll).
- Modify damage application to check `Guarded` on the target (halve, min 1, consume).
- At unit turn start: tick all conditions; apply `Slowed` to `movePointsRemaining`; expire Guarded if still present from prior turn.

Log condition application: `[T3] Mara is Weakened.`, `[T4] Guarded consumed — 3 damage reduced to 2.`, `[T5] Bless expired.`

### UI
- Action bar shows 3 buttons for the active hero.
- Tooltip on hover: name, range, effect description (auto-generated from the def).
- Disabled state with reason: `"No valid targets"`, `"Already acted this turn"`, `"Out of range"` (range only matters once you click — disable purely by "has acted").
- Active conditions shown as small icons/letters next to the unit token (e.g., `W` Weakened, `B` Blessed, `G` Guarded, `S` Slowed).

### Tests (`src/combat/Condition.test.ts`)
- Guarded halves damage and is consumed after one hit.
- Weakened reduces a unit's d20 attack total by 2.
- Blessed adds 2 to the next attack roll and is then removed.
- Slowed reduces next-turn `movePointsRemaining` by 1.

## Out of Scope
- Cooldowns or once-per-combat tracking (not needed for these 9).
- Item-granted actions (Feature 07).
- Burning condition (excluded from prototype set per design).

## Acceptance Criteria
- Each hero has 3 visible action buttons that all work.
- All 4 conditions visibly affect rolls and are logged.
- Disabled action buttons explain why.
- All condition tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/8 (Feature 06 — Class Actions and Conditions).
>
> Read `ARCHITECTURE.md`, `COMBAT_DESIGN.md` § Prototype Conditions + Classes, `CONTENT_CATALOG.md` actions, and `ROADMAP.md` (M2.1). Add the remaining 6 class actions, the Condition module with the 4 prototype conditions, wire condition hooks into `resolveAction` and turn-start, expand the action bar with tooltips + invalid-reason messages, and pass the condition tests.
