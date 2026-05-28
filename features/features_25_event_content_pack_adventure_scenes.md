# Feature 25 - Event Content Pack: Adventure Scenes (Future)

## Goal
Add a first pack of varied non-combat events using the expanded event framework.

## DnD-Feel Intent
Create moments that feel like travel encounters, strange shrines, moral choices, bargains, and risky opportunities.

## Source Docs
- `CONTENT_CATALOG.md`
- `MAP_AND_NODES.md`
- `GAME_DESIGN.md`
- `SRD_LICENSE_NOTE.md`

## Skeleton Scope
- Add 8 to 12 original event definitions.
- Include a mix of risk/reward, healing, treasure, training, and character-focused events.
- Reuse existing stats, items, potions, buffs, and check mechanics.
- Keep text short enough for prototype UI.

## Out of Scope
- Licensed or proprietary monsters, places, spells, or settings.
- Large branching narratives.
- Permanent world-state quest chains.

## Dependencies
- Feature 24 expanded event framework.
- Feature 23 ability checks lite if events use checks.

## Acceptance Criteria Draft
- Event nodes pull from a varied event pool.
- Events do not repeat within a run unless explicitly allowed.
- Each event has at least two meaningful choices.
- Data repository validation covers all new event references.

## Planning Notes
- Use original fantasy names and keep prose compact.
- Consider tagging events by tone or reward type for future map generation.
