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

---

## Campaign Roadmap Goals and Act Constraints

### Campaign Goal

DnRogueLite's first campaign is a **4-act ordered campaign** with placeholder content and strong 5E inspiration. The current single-run flow becomes Act 1. A run is one attempt of the full campaign.

**Campaign completion** is defined as resolving the final boss encounter of the final configured act (Act 4). Target party level at campaign end is roughly level 11–13, with XP scaling subject to change as run content evolves.

**Target run duration:** roughly 2–3 hours for a full campaign at mature pacing. Act 1 is the shortest act (15–25 min); later acts target 30–60 min each. See `CAMPAIGN_TARGETS.md` for node count targets and placeholder status.

### First Campaign: 4 Acts

| Act | Theme | Mechanical Focus | Duration Target |
|-----|-------|-----------------|----------------|
| Act 1 | Nature / Goblins | Introduces all baseline mechanics; migrated from current run flow | 15–25 min |
| Act 2 | Goblins / Ogres / Skeletons | Single strong boss encounter | 30–45 min |
| Act 3 | Skeletons / Cultists | Multiple priority targets | 40–60 min |
| Act 4 | Cultists / Arcane / Draconid | Single boss with priority supports; final completion gate | 35–50 min |

Each act ends with a boss or boss-like gate encounter before Act 4's final encounter.

Act 1 is explicitly larger than the current single-run prototype (which has ~5 nodes), but remains shorter than later acts. See `CAMPAIGN_TARGETS.md` for node count guidance.

### Flexibility Constraints

- The campaign model must support **alternate act layouts**, route variants, side quests, and varying act lengths without changing the core campaign data model.
- Future work may expand or shorten the act count by adding or removing act entries in the campaign definition — no hardcoded act count in engine logic.
- Side quests are a planned future pillar; the model should not preclude them.
- Capsule art style is retained; no new art is required for the campaign scaffold.

### Testing Policy

Automated tests are added as implementation tasks land — each child task that introduces engine logic or data structures carries its own test coverage requirement. Manual testing is acceptable for UI-heavy steps and must be documented at task close.

---

## Side Quest Readiness

Side quests are a **major planned pillar** of the campaign and must not be foreclosed by early implementation decisions. No side quest runtime behavior is implemented yet, but the following hooks must be preserved.

### Quest Flag Hooks

- The campaign state model must support an extensible set of named boolean flags (e.g., `rescued_merchant`, `found_noble_badge`).
- Flags are set by completing optional nodes or making choices in event nodes.
- Flags may be read by later nodes within the same act or by nodes in subsequent acts to unlock content or alter dialogue.
- No cross-act consequence logic is implemented yet — the flag storage structure is all that is required initially.

### Act-Specific Side Route Hooks

Each act already defines placeholder side quest hooks in `CAMPAIGN_ARC.md` and `ACT_IDENTITIES.md`. When the act map layout is implemented:

- Each act's map graph must support at least one **optional node slot** per act that can be wired to a side quest node without restructuring the graph.
- Optional nodes are skippable — their absence never blocks act completion.
- The act completion condition is always the boss encounter, regardless of optional node state.

### Cross-Act Consequence Hooks

Some side quests have narrative or mechanical payoffs in a later act (e.g., a relic found in Act 3 weakens the Act 4 boss). These are not implemented yet, but the design must allow:

- A flag set in Act N to be readable in Act N+1 through N+4.
- A flag to gate an alternate encounter variant, an item reward, or a stat modifier on a later boss.
- No specific cross-act consequences are defined in this task.

---

## Alternate Act Layouts

Acts are ordered and each act has a canonical map layout. Future work may add alternate layouts for any act without changing campaign completion logic.

### Layout Variants

- An act layout is a specific map graph for that act: node count, node types, branching structure, and boss node placement.
- The first implementation uses one canonical layout per act.
- Future layouts may offer a longer route (more encounters, more rewards), a shorter route (fewer nodes, faster boss access), or a side-quest-heavy route (more optional nodes, richer branching).
- Alternate layouts are selected at act entry — the player sees route options before committing.

### Implementation Constraint

- Act layouts must be data-defined, not hardcoded per-act in engine logic.
- Adding a new layout for an existing act requires only a new data entry, not an engine change.
- The canonical layout for each act is defined in `ACT_IDENTITIES.md`.

---

## Future Act Expansion or Shortening

The first campaign is 4 acts. The act count is not fixed in the engine.

### Expansion Path

- A fifth or sixth act can be added by appending a new act definition to the campaign configuration.
- No engine change is required. The campaign runner reads the act list and executes them in order.
- Candidate Act 5 direction: an epilogue or high-difficulty gauntlet act for players who want a harder run option.
- Candidate Act 6 direction: an alternate finale with a different antagonist, unlocked by specific campaign flags.

### Shortening Path

- A 3-act campaign (for a shorter run mode or difficulty adjustment) is achieved by removing Act 2 or Act 3 from the configuration.
- XP scaling should be adjusted via configuration when act count changes, not by modifying act data.

### Guard

The hardcoded assumption to avoid: any engine logic that checks `if actIndex === 4` or `if actIndex === lastAct` with a literal. Campaign completion is triggered by finishing the last act in the configured list, however long that list is.
