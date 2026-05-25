# Feature 20 — Content Expansion and Difficulty (M7.2)

## Goal
Use the Feature 19 data pipeline to add more encounters, items, events, and a difficulty toggle — without touching core systems.

## Source Docs
- `CONTENT_CATALOG.md`
- `DATA_MODEL.md`
- `ROADMAP.md` (M7.2)
- `SCOPE.md` (still single-act)

## Includes

### New content (data only)
**2 new encounters** in `src/data/encounters.ts`:
- `encounter.wolf_pack`: 3 Wolves. Reward pool basic.
- `encounter.broken_banner_elite`: 1 Bandit Brute + 1 Cult Acolyte + 2 Goblin Skirmishers. Reward pool uncommon (this is the elite from `CONTENT_CATALOG.md`).

Update `src/data/nodes.ts` to include an elite node variant slot (e.g., turn one Layer-3 node into an elite path). Player can route around it.

**3 new items** (most are already named in `CONTENT_CATALOG.md` and just need defs):
- `item.bloodstone` — trinket, uncommon, `+2 maxHp`
- `item.owl_feather` — trinket, uncommon, `+1 range to spell actions` (implement as a flat-effect: when computing range for actions with `accuracyStat === "spirit"`, add 1)
- `item.ember_staff` — weapon, uncommon, `+1 spirit, Fire Bolt deals +1 damage` (implement Fire Bolt bonus as a per-item handler: post-formula damage modifier when `attacker has item.ember_staff` and `action.id === "action.fire_bolt"`)

Add an "uncommon" reward pool that draws from these items so `cult_ritual` and `broken_banner_elite` can actually drop them.

**2 new events** in `src/data/events.ts`:
- `event.merchant`: "Spend 10 gold for a random potion" / "Decline".
- `event.wandering_sage`: "Train one hero (+15 XP, lose 5 gold per hero)" / "Decline".

Add a small "pick a random unvisited event from the events pool" mechanism for Event nodes so revisiting the map gives variety. Persist the chosen event per node (similar to shop persistence).

### Difficulty (`src/run/Difficulty.ts`)
```ts
export type Difficulty = "normal" | "hard";

export const DIFFICULTY_CONFIG: Record<Difficulty, {
  enemyHpMultiplier: number;
  enemyDamageBonus: number;
  rewardGoldMultiplier: number;
  rewardXpMultiplier: number;
}> = {
  normal: { enemyHpMultiplier: 1.0, enemyDamageBonus: 0, rewardGoldMultiplier: 1.0, rewardXpMultiplier: 1.0 },
  hard:   { enemyHpMultiplier: 1.2, enemyDamageBonus: 1, rewardGoldMultiplier: 1.2, rewardXpMultiplier: 1.2 },
};
```

### Apply difficulty
- At combat start, scale enemy `maxHp` and `hp` by `enemyHpMultiplier` (round up).
- Add `enemyDamageBonus` to enemy damage rolls (post-formula).
- In `RewardManager`, multiply gold and XP by their respective multipliers (round down).

### UI
- On a new-run setup screen (small modal off the main menu's "New Run" button), let the player pick Normal or Hard before the map screen opens.
- Store on `RunState.difficulty`. Default Normal.

### Tests
- `Difficulty.test.ts`: Hard scales enemy HP by 1.2 (Goblin 8 → 10).
- `RewardManager.test.ts` (extend): Hard multiplies gold and XP correctly.
- `DataRepository.test.ts` (extend): new items/encounters/events load and validate.

### Scope reminder
- Do NOT add new enemy types — they require new actions and AI work. Reusing existing enemies is fine.
- Do NOT add a second act. `SCOPE.md` caps at 1 act.
- Touching core systems (combat math, AI, reward pipeline) is allowed only for the difficulty multipliers above. Everything else must land via data.

## Out of Scope
- Brutal/Nightmare tiers.
- New AI tags.
- Procedural map generation.
- New unit types (pets-on-grid, summons).

## Acceptance Criteria
- New encounters appear on the map (elite is selectable).
- New items can drop and be equipped; uncommon pool produces them.
- New events appear from Event nodes.
- Difficulty toggle visibly changes enemy stats and reward magnitudes.
- Core system code is largely untouched except difficulty hooks (verifies Feature 19's data pipeline).
- All extended tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/22 (Feature 20 — Content Expansion + Difficulty).
>
> Read `CONTENT_CATALOG.md`, `DATA_MODEL.md`, `SCOPE.md`, and `ROADMAP.md` (M7.2). Add the listed encounters/items/events via `src/data/`, add an uncommon reward pool, implement `Difficulty.ts` with Normal/Hard configs and apply at combat start / in `RewardManager`, expose a Normal/Hard toggle on the New Run flow, and pass the extended tests. Keep all changes data-driven except the documented difficulty hooks.
