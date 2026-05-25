# Technical Plan

## Implementation Philosophy
Use the simplest stack that can produce a playable prototype quickly. The final game can move to a more robust engine later if needed, but the first target is a working loop.

## Recommended Stack Options

### Option A — Unity 2D
Best if the goal is a traditional desktop game with a clear path to Steam later.

Pros:
- Familiar game engine model.
- Strong 2D UI support.
- Easy sprites/prefabs/scenes.
- Good fit for hex-grid tactical games.

Cons:
- More setup friction in coding-agent environments.
- Asset/prefab issues can slow progress.

### Option B — Godot 2D
Best if the goal is a lightweight open-source engine with straightforward 2D scenes.

Pros:
- Lightweight.
- Strong 2D workflow.
- Good for tactics/grid games.

Cons:
- Claude/Codex environment support may vary.

### Option C — Web Prototype with TypeScript/React or Canvas
Best if the goal is fastest playable validation inside a coding sandbox.

Pros:
- Easy to run and inspect.
- Simple deployment.
- Great for UI-heavy prototypes.
- No engine install friction.

Cons:
- May need porting later if targeting a full game engine.

## Recommendation
For the first Claude Code/Codex pass, allow the coding agent to choose between:

1. Unity 2D if the repo/environment is already set up for Unity.
2. Web TypeScript/React/Canvas if the environment lacks game-engine support.

The output must be playable and modular either way.

## Architecture Requirements

### Core Modules

| Module | Responsibility |
|---|---|
| `DataRepository` | Loads static definitions. |
| `RunManager` | Owns current run state and node flow. |
| `CombatManager` | Owns combat state, turns, actions, AI, win/loss. |
| `HexGrid` | Coordinates, neighbors, distance, movement range. |
| `RewardManager` | Generates XP/gold/items/potions/rewards. |
| `MetaProgressionManager` | Owns Renown, upgrades, save/load. |
| `InventoryManager` | Owns item storage and equipment. |
| `UI` | Renders screens and forwards player input. |

### Screen/State Flow

```text
Main Menu
  -> Meta Upgrades
  -> New Run Setup
      -> Map Screen
          -> Combat Screen
              -> Reward Screen
                  -> Map Screen
          -> Shop Screen
          -> Camp/Event/Recruit Screen
          -> Boss Combat
              -> Run Summary
                  -> Meta Upgrades / Main Menu
```

## Data-Driven Content
Move toward data files as soon as the combat sandbox works.

Recommended folders:

```text
/data/classes.json
/data/actions.json
/data/items.json
/data/enemies.json
/data/encounters.json
/data/nodes.json
/data/rewards.json
/data/upgrades.json
```

If the chosen stack makes JSON cumbersome at first, hardcode definitions behind a `DataRepository` interface, then swap implementation later.

## Save Data
Prototype save should persist only meta progression.

Current run save is optional for the first prototype.

Save fields:

```json
{
  "renown": 0,
  "purchasedUpgradeIds": [],
  "upgradeRanks": {},
  "completedRuns": 0,
  "bossWins": 0
}
```

## UI Priorities

1. Clarity over beauty.
2. Logs over animation polish.
3. Buttons/cards over complex interactions.
4. Placeholder art is acceptable.
5. Every action should have visible feedback.

## Asset Guidance
Use placeholder assets first:

- Colored hexes.
- Simple circles/tokens for units.
- Icons from text/emoji only if appropriate.
- Simple UI cards.

Only add free/license-safe art after gameplay works.

## Testing Guidance
Prioritize tests for deterministic rules:

- Hex distance.
- Movement range.
- Occupancy.
- Attack hit/miss.
- Reward generation.
- Level-up thresholds.
- Meta upgrade application.

## Performance Expectations
Prototype scale is tiny. Avoid premature optimization.

Target:

- 37 to 61 hexes.
- Fewer than 10 units in combat.
- Fewer than 20 nodes in the map.
- Simple save data.
