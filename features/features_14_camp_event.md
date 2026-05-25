# Feature 14 — Camp / Event Node (M5.2)

## Goal
Add a Camp/Rest node with a Rest-or-Train choice and one Event node with a 2-choice scenario.

## Source Docs
- `MAP_AND_NODES.md` § Camp / Rest, § Event
- `ROADMAP.md` (M5.2)

## Includes

### Camp screen (`src/ui/screens/CampScreen.ts`)
Two buttons:
- **Rest**: heal each living hero for **40% max HP** (rounded down, minimum 1; per `MAP_AND_NODES.md`).
- **Train**: pick a hero from a small modal; selected hero gains `+5 XP` (may trigger a level-up via `applyXp`).

After choice, show a 1-line confirmation and a "Continue" button that returns to map. Mark node visited.

### Event screen (`src/ui/screens/EventScreen.ts`)
For this feature, exactly **one** event scenario, hardcoded:

> **A Strange Shrine.** A weathered shrine hums with faint power.
>
> - **Pray (gain power)**: choose one hero — they gain +1 Spirit for the rest of the run.
> - **Loot the offerings (take 5 damage, gain 15 gold)**: a random living hero takes 5 damage (HP floors at 1 — do not allow this to kill the hero); party gains 15 gold.

The hero-selection step for Pray uses the same modal style as Train.

Event def schema (still data-driven enough for Feature 20 to add more):

```ts
export interface EventDef {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
}
export interface EventChoice {
  id: string;
  label: string;
  description: string;
  effect: EventEffect;   // discriminated union: heroStatBonus | gold | damageRandomHero | xp
}
```

The single starter event uses `id: "event.strange_shrine"`.

### RunState additions
- `RunState.party[heroId].bonusStats` already exists from Feature 07; +1 Spirit goes there.
- Nothing else needs new state.

### Tests (`src/run/Events.test.ts`)
- Camp Rest heals heroes by floor(40% maxHp).
- Camp Train applies +5 XP and triggers level-up at the boundary.
- "Loot the offerings" never reduces hero HP below 1.
- "Pray" applies +1 spirit to the chosen hero permanently for the run.

## Out of Scope
- Multiple event scenarios (Feature 20 content expansion).
- Random event-pool selection (just the one event).
- Drawbacks/curses beyond the simple shrine damage option.

## Acceptance Criteria
- Camp nodes open CampScreen with two working options.
- Event nodes open EventScreen with the Strange Shrine event.
- Both screens return to map after a choice and mark the node visited.
- All event tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/16 (Feature 14 — Camp/Event Node).
>
> Read `MAP_AND_NODES.md` § Camp/Rest + Event and `ROADMAP.md` (M5.2). Add `CampScreen` with Rest (heal 40%) and Train (+5 XP) options, `EventScreen` with the one hardcoded Strange Shrine event using an `EventDef` schema for future expansion, and pass the listed tests.
