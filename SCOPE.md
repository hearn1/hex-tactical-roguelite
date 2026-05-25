# Scope

## Primary Goal
Create a working, extendable prototype. The prototype should prove the full loop at small scale:

**Meta setup → branching map → hex combat → post-combat rewards → shop/rest/recruit nodes → boss → win/loss → meta progression.**

## Prototype Must-Haves

### Core Systems
- New run flow.
- Small starting party.
- Hex-grid combat.
- Turn order.
- Movement and action targeting.
- Enemy AI.
- Combat log.
- Victory/defeat resolution.
- Post-combat reward screen.
- Branching node map.
- At least one shop/rest/recruit-style non-combat node.
- Run win/loss state.
- Basic permanent unlock save/load.

### Minimum Content
- 3 playable classes.
- 6 class/item actions.
- 5 to 8 enemies.
- 8 to 12 items.
- 3 potions/consumables.
- 5 node types.
- 1 boss encounter.
- 5 permanent upgrades.

### Minimum UX
- Clear unit cards or panels.
- Clear hex selection/highlighting.
- Clear action buttons.
- Clear damage/heal/combat log output.
- Clear rewards and inventory/equipment flow.
- Restart/new-run option.

## Prototype Nice-to-Haves
Only add these after the must-haves work:

- Line-of-sight blockers.
- Terrain hazards.
- Additional classes.
- More enemy AI behaviors.
- Multiple acts.
- Event narrative text.
- Pets as a separate unit type.
- Difficulty tiers.
- Animations and VFX.
- Controller support.

## Hard Cuts / Non-Goals
Do not build these in the first prototype:

- Full D&D/5E rules implementation.
- Multiplayer or online ghost battles.
- Character creator.
- Large spell list.
- Large item database.
- Procedural dungeon visuals.
- Complex inventory with weight, rarity affixes, crafting, or socketing.
- Dozens of classes/subclasses.
- Complex faction/quest system.
- Dialogue trees.
- Steam integration.
- Cloud saves.
- Paid asset dependency.

## Complexity Budget
The prototype should stay small enough that one LLM coding session can implement a single vertical without needing broad refactors.

Recommended caps:

| System | Prototype Cap |
|---|---:|
| Party size | 3 start, 4 max |
| Active enemies | 2 to 5 per fight |
| Hex map size | 7x7 or smaller equivalent radius |
| Actions per character | 2 to 3 |
| Conditions | 3 to 5 |
| Map length | 8 to 10 nodes |
| Acts | 1 |
| Bosses | 1 |
| Permanent upgrades | 5 |

## Definition of Done for Prototype
The prototype is done when it is playable from start to finish without developer intervention and each major system has at least one implemented example.

It does not need to be balanced, beautiful, or content-rich. It does need to be understandable, stable, and easy to extend.
