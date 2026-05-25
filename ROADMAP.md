# Roadmap

## M0 — Documentation and Project Setup

### M0.1 Documentation Baseline
- Add all design and technical docs.
- Confirm scope and hard cuts.
- Confirm first implementation target.

### M0.2 Project Skeleton
- Create runnable project.
- Add app shell/main menu/prototype entry.
- Add test harness.

## M1 — Hex Combat Sandbox

### M1.1 Hex Grid
- Axial coordinates.
- Neighbor lookup.
- Distance calculation.
- Grid rendering.
- Hex selection.

### M1.2 Units and Turns
- Spawn player/enemy units.
- Initiative/turn queue.
- Active unit state.
- End turn.

### M1.3 Movement
- Movement range.
- Occupancy blocking.
- Move command.
- UI highlight.

### M1.4 Actions
- Action definitions.
- Basic targeting.
- Attack rolls.
- Damage/healing.
- Combat log.

### M1.5 Enemy AI
- Basic targeting.
- Move toward target.
- Attack if in range.
- End combat on victory/defeat.

## M2 — Class Identity and Items

### M2.1 Class Actions
- Guardian/Acolyte/Arcanist action sets.
- Action buttons/tooltips.
- Invalid action reasons.

### M2.2 Item Equipment
- Weapon/armor/trinket slots.
- Stat bonuses.
- Item-granted actions.

## M3 — Rewards and Leveling

### M3.1 Victory Reward Screen
- XP/gold display.
- Reward choices.
- Inventory updates.

### M3.2 Leveling
- XP thresholds.
- Level-up stat gains.
- Level-up UI/log.

## M4 — Map and Run Flow

### M4.1 Branching Map
- Hardcoded prototype graph.
- Node availability.
- Node completion.

### M4.2 Combat Node Integration
- Launch encounters from nodes.
- Return to reward/map flow.

### M4.3 Boss and Run End
- Boss encounter.
- Win/loss summary.

## M5 — Non-Combat Nodes

### M5.1 Shop
- Buy items/potions.
- Spend gold.

### M5.2 Camp/Event
- Heal or train.
- Simple event choices.

### M5.3 Recruit/Pet
- Add a recruit.
- Add pet buff placeholder.

## M6 — Permanent Meta Progression

### M6.1 Renown
- Calculate run-end Renown.
- Show summary.

### M6.2 Upgrades
- Meta-upgrade menu.
- Purchase upgrades.
- Apply starting bonuses.

### M6.3 Save/Load
- Persist meta progression.

## M7 — Data and Expansion

### M7.1 Data Repository
- Central definitions.
- Validation.

### M7.2 Content Expansion
- More encounters/items/actions.
- Difficulty tiers.

## Current Recommended Next Step
Start with **M1.1 through M1.5** as one focused combat-sandbox session if the coding agent can handle it. If that is too large, split into M1.1/M1.2 first, then M1.3-M1.5.
