# Feature 15 — Recruit / Pet Node (M5.3)

## Goal
Let the player grow the party to 4 heroes via a Recruit node, or apply a run-wide pet buff.

## Source Docs
- `MAP_AND_NODES.md` § Recruit Node, § Pet Node
- `SCOPE.md` (party cap 4)
- `ROADMAP.md` (M5.3)

## Includes

### Recruit candidate generation (`src/run/Recruit.ts`)
- On entering a Recruit node, generate 2 candidates with stable identity tied to the node (persist on `RunState.recruitOffers: Record<NodeId, RecruitCandidate[]>`).
- Each candidate is one of the 3 hero classes (any, including duplicates of existing party classes), level 1 with starting items per class def.
- Optionally bias names from a small list of fantasy names.

### Pet buff option
- The same Recruit node also surfaces a "Take a pet companion" option offering exactly one pet from `MAP_AND_NODES.md` § Pet Node. For the prototype, implement **Pack Mule** (`+20% gold from rewards for the rest of the run`).
- Pet buffs go on `RunState.runModifiers: RunModifier[]`:
  ```ts
  export type RunModifier =
    | { kind: "gold_multiplier"; value: number }
    | { kind: "global_stat"; stat: keyof UnitStats; value: number }
    | { kind: "first_hit_bonus_damage"; amount: number };
  ```
- The `RewardManager` (Feature 08) should read `runModifiers` and apply `gold_multiplier` to the gold portion of any reward.

### Recruit screen (`src/ui/screens/RecruitScreen.ts`)
- Show the 2 hero candidates and the Pack Mule option as three cards.
- "Accept" on a hero candidate:
  - If party size < 4 (cap from `SCOPE.md`): append to `RunState.party`.
  - If party size === 4: open a small modal "Replace which hero?" with all 4 current heroes listed; selecting one removes them (transferring their equipped items to the bag) and adds the recruit.
- "Accept" on Pack Mule: pushes a `gold_multiplier: 1.2` modifier onto `RunState.runModifiers`. Do not allow it to stack from the same node on re-visits (the node is marked visited after either choice).
- "Skip" closes without changes.

### Disabled states
- If a candidate-replacement modal is open with party-cap-4, and the player closes the modal without picking, the recruit is not accepted.

### Tests (`src/run/Recruit.test.ts`)
- Recruiting with party size 3 grows it to 4.
- Recruiting with party size 4 + replacement removes the chosen hero and adds the recruit.
- Pack Mule applies `gold_multiplier 1.2` to a subsequent reward (mock a reward and verify).
- Recruit offers persist for the same node (revisits show same candidates), keyed by node id.

## Out of Scope
- Pets as on-grid units.
- Multiple pet options.
- Dismissing recruits later in the run.

## Acceptance Criteria
- Recruit node offers 2 hero candidates + 1 pet option.
- Accepting a hero grows the party (or replaces a hero at cap 4).
- Accepting Pack Mule increases gold rewards by 20% for the remainder of the run.
- All recruit tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/17 (Feature 15 — Recruit/Pet Node).
>
> Read `MAP_AND_NODES.md` § Recruit + Pet, `SCOPE.md`, and `ROADMAP.md` (M5.3). Add `src/run/Recruit.ts` with persistent candidate generation, the Pack Mule run modifier, `RecruitScreen` with hero-replacement-at-cap-4, integrate `gold_multiplier` into `RewardManager`, and pass the listed tests.
