# Implementation Plan

## Phase 0 — Project Skeleton and Rules

### Goal
Create a clean, runnable project with agreed architecture.

### Tasks
- Create project structure.
- Add documentation files.
- Add simple app entry point.
- Add placeholder UI shell.
- Add basic test harness if available.

### Done When
- Project runs locally.
- Main menu or prototype screen appears.
- Tests can be run, even if minimal.

## Phase 1 — Tactical Combat Sandbox

### Goal
Make one complete combat playable.

### Tasks
- Implement hex grid coordinates and rendering.
- Add party and enemies.
- Implement turn order.
- Implement movement.
- Implement basic actions.
- Implement HP/damage/healing.
- Implement enemy AI.
- Add combat log.
- End combat with victory/defeat.

### Done When
- Player can win or lose a single fight.
- Guardian, Acolyte, and Arcanist have distinct actions.
- Enemy AI takes turns automatically.

## Phase 2 — Rewards and Leveling

### Goal
Make combat feed into character growth.

### Tasks
- Add reward screen after victory.
- Add XP per character.
- Add level-up thresholds.
- Add gold.
- Add item and potion rewards.
- Add inventory/equipment basics.

### Done When
- Winning a fight improves the party.
- Equipped items affect later combat.

## Phase 3 — Map and Node Flow

### Goal
Create the roguelite run structure.

### Tasks
- Add branching act map.
- Add node selection.
- Add combat nodes.
- Add boss node.
- Return to map after rewards.
- Track run progress.

### Done When
- Player can traverse a short map and reach a boss.

## Phase 4 — Shops, Camps, Recruits, and Pets

### Goal
Add non-combat decisions.

### Tasks
- Add shop screen.
- Add buyable items/potions.
- Add camp/rest node.
- Add recruit node.
- Add pet buff node or placeholder pet implementation.

### Done When
- Player makes at least two meaningful non-combat decisions during a run.

## Phase 5 — Permanent Meta Progression

### Goal
Add the first tier of unlocks across runs.

### Tasks
- Add Renown reward at run end.
- Add meta-upgrade menu.
- Add persistent save/load.
- Apply upgrades to new runs.

### Done When
- Failed and successful runs grant Renown.
- Purchased upgrades affect future starts.

## Phase 6 — Data-Driven Content

### Goal
Make content extendable.

### Tasks
- Move definitions into structured data or a central repository.
- Validate IDs and references.
- Add content catalog examples.
- Ensure systems use definitions.

### Done When
- New items/enemies/actions can be added with minimal code changes.

## Phase 7 — Content Expansion and Balance

### Goal
Turn prototype into repeatable game.

### Tasks
- Add more encounters.
- Add more items.
- Add more nodes.
- Add difficulty modifiers.
- Tune numbers.
- Add polish only after loop stability.

### Done When
- Multiple runs produce different choices and outcomes.

## Suggested Session Size
Each Claude Code/Codex session should target one phase or a small part of one phase. Avoid asking a single session to build all systems at once.

## Implementation Order Summary

1. Combat sandbox.
2. Rewards.
3. Map.
4. Non-combat nodes.
5. Meta progression.
6. Data-driven content.
7. Expansion/polish.
