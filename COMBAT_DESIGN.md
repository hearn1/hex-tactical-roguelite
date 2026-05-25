# Combat Design

## Combat Format
Combat is turn-based tactical combat on a hex grid. The player controls a party of heroes. Enemies use automated AI.

## Prototype Grid
Use a small symmetrical hex grid:

- Recommended: hex radius 3, about 37 cells.
- Alternative: 7x7 offset grid with invalid corners hidden.
- Starting heroes on left/bottom side.
- Enemies on right/top side.

## Coordinates
Use axial coordinates internally:

- `q`
- `r`

Neighbor directions:

```text
(+1, 0), (+1, -1), (0, -1), (-1, 0), (-1, +1), (0, +1)
```

Distance formula:

```text
distance = (abs(q1-q2) + abs(q1+r1-q2-r2) + abs(r1-r2)) / 2
```

## Unit Turn Structure
Each unit turn has:

1. Start-turn effects.
2. Movement phase.
3. One main action.
4. Optional end turn.
5. End-turn effects.

For prototype simplicity:

- Each unit gets movement points equal to `move`.
- Each unit gets 1 action point.
- No bonus actions/reactions in the first prototype.
- No opportunity attacks in the first prototype.

## Stats

| Stat | Purpose |
|---|---|
| `maxHp` | Maximum hit points. |
| `hp` | Current hit points. |
| `armor` | Target number to hit. Similar to armor class. |
| `move` | Hexes per turn. |
| `might` | Melee and heavy physical actions. |
| `agility` | Ranged, evasive, and finesse actions. |
| `spirit` | Spell, healing, and support actions. |
| `level` | Character level within a run. |
| `xp` | Character XP within a run. |

## Attack Roll
Prototype attack formula:

```text
roll = d20 + attacker relevant stat + proficiency
hit if roll >= target armor
natural 20 = critical hit
natural 1 = miss
```

Prototype proficiency:

```text
proficiency = 2 + floor((level - 1) / 3)
```

Critical hit:

```text
critical damage = base damage * 2
```

## Damage and Healing
Use small readable values. Dice can be simulated and shown in the log, but the system should not become a full tabletop simulator.

Example formulas:

```text
Melee Strike: 1d6 + might
Fire Bolt: 1d8 + spirit
Heal: 1d6 + spirit
```

## Action Types

| Type | Example | Notes |
|---|---|---|
| Melee Attack | Slash | Requires adjacent target. |
| Ranged Attack | Arrow Shot | Range 3 to 5. |
| Spell Attack | Fire Bolt | Range 4, uses spirit. |
| Heal | Mend Wounds | Targets ally. |
| Buff | Bless | Adds temporary bonus. |
| Defensive | Guard | Reduces incoming damage. |
| Control | Frost Shard | Slows or weakens enemy. |

## Prototype Conditions

| Condition | Effect |
|---|---|
| `Guarded` | Reduce next incoming damage by 50%, minimum 1. Expires after triggered or at next turn start. |
| `Burning` | Take 2 damage at end of turn for 2 turns. |
| `Weakened` | -2 to attack rolls for 1 turn. |
| `Blessed` | +2 to next attack roll or heal. |
| `Slowed` | -1 movement next turn. |

Only implement 2 to 3 conditions in the first combat sandbox if needed. Recommended first set: `Guarded`, `Burning`, `Blessed`.

## Line of Sight
Prototype should not require complex line of sight.

Phase 1 rule:

- Ranged actions require distance <= range.
- Occupied cells do not block line of sight.
- Terrain does not block line of sight.

Future rule:

- Add blockers and cover once core combat works.

## Enemy AI
Start with simple readable AI.

### Basic AI Priority
1. If an ally can be defeated, attack that ally.
2. If a damaged enemy has a heal action, heal self or ally.
3. If any player is in attack range, attack the lowest HP valid target.
4. Otherwise move toward nearest player.
5. End turn.

### AI Personality Tags
Future expansion can use tags:

| Tag | Behavior |
|---|---|
| `brute` | Moves toward nearest target and attacks. |
| `skirmisher` | Prefers ranged distance and weak targets. |
| `support` | Heals or buffs allies. |
| `caster` | Uses spells and conditions. |
| `boss` | Uses scripted phase abilities. |

## Prototype Classes

### Guardian
Role: frontline defender.

Actions:

- `Slash`: adjacent melee attack, 1d6 + might.
- `Shield Bash`: adjacent melee attack, low damage, applies Weakened.
- `Guard`: self gains Guarded.

### Acolyte
Role: healer/support.

Actions:

- `Mace Strike`: adjacent melee attack, 1d6 + might.
- `Mend Wounds`: range 3 ally heal, 1d6 + spirit.
- `Bless`: range 3 ally gains Blessed.

### Arcanist
Role: ranged spell damage/control.

Actions:

- `Fire Bolt`: range 4 spell attack, 1d8 + spirit, applies Burning on hit if upgraded later.
- `Frost Shard`: range 4 spell attack, 1d6 + spirit, applies Slowed.
- `Arcane Ward`: self or ally gains Guarded.

## Combat UX Requirements

- Select unit whose turn it is.
- Highlight moveable hexes.
- Highlight valid targets for selected action.
- Show selected action details.
- Show HP bars or numbers.
- Show turn order.
- Show combat log with rolls, hits, misses, damage, healing, and defeats.
- Disable invalid actions with a clear reason.

## Combat Completion

### Victory
Combat ends when all enemies are defeated. The game transitions to the reward screen.

### Defeat
Combat ends when all player party members are defeated. The run ends and awards meta-currency based on progress.
