# DnRogueLite — Project Documentation

**Working title:** DnRogueLite  
**Genre:** 5E-inspired hex-grid tactical roguelite  
**Goal:** Build a small playable prototype first, then extend through data-driven classes, items, encounters, nodes, and difficulty tiers.

## Product Pitch
DnRogueLite is a party-based tactical roguelite inspired by tabletop fantasy combat. The player guides a small party across a branching node map, fights turn-based battles on a hex grid, earns individual character rewards after combat, and gradually unlocks stronger starting options across runs.

The prototype should feel like:

1. Choose a starting party/loadout.
2. Traverse a Slay-the-Spire-style branching map.
3. Fight tactical hex battles with class/item actions.
4. Gain XP, gold, item drops, potions, and new party options.
5. Spend gold at shops or improve the party through events/rest nodes.
6. Beat the act boss or die.
7. Earn meta-currency to improve future starting characters.

## Documentation Map

| File | Purpose |
|---|---|
| `GAME_DESIGN.md` | Core pillars, game loop, player experience, win/loss model. |
| `SCOPE.md` | Prototype scope, hard cuts, and non-goals. |
| `VERTICALS.md` | The major implementation verticals and what each must prove. |
| `COMBAT_DESIGN.md` | Hex combat rules, turn structure, actions, stats, conditions, AI. |
| `MAP_AND_NODES.md` | Branching map, node types, act structure, encounter flow. |
| `PROGRESSION_AND_REWARDS.md` | Two-tier progression: permanent start upgrades and in-run rewards. |
| `DATA_MODEL.md` | Suggested data structures and data-driven content format. |
| `CONTENT_CATALOG.md` | Starter classes, enemies, items, potions, nodes, and rewards. |
| `TECH_PLAN.md` | Practical implementation guidance for Claude Code/Codex. |
| `IMPLEMENTATION_PLAN.md` | Milestones/phases and acceptance criteria. |
| `ROADMAP.md` | Session-by-session build plan. |
| `TEST_PLAN.md` | Manual and automated validation checklist. |
| `CLAUDE.md` | Coding-agent rules and architectural constraints. |
| `NEXT_SESSION.md` | Copy-paste prompt for the first implementation session. |
| `SRD_LICENSE_NOTE.md` | IP/licensing guardrails for using 5E/SRD-inspired content. |

## Prototype Success Criteria
The first playable prototype is successful when a player can:

- Start a new run with a small party.
- Move through a short branching map.
- Enter at least 3 combat nodes and 1 boss node.
- Control party members on a hex grid.
- Use class/item actions with clear targeting and combat logs.
- Receive post-combat XP/gold/item/potion rewards.
- Visit at least one non-combat node such as a shop or camp.
- Win or lose the run.
- Earn a small amount of meta-currency and spend it on a starting upgrade.

## Design Bias
Keep everything small, readable, and expandable:

- Prefer data files over hardcoded content once the core loop works.
- Prefer simple UI and logs over animation polish.
- Prefer 3 classes, 6 enemies, and 12 items that work over a huge list of partial systems.
- Do not build a full tabletop rules simulator.
- Do not add multiplayer, online services, procedural terrain, or complex asset dependencies in the prototype.
