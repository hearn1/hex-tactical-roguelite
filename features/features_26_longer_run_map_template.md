# Feature 26 - Longer Run Map Template (Future)

## Goal
Increase the prototype run length and path variety while keeping a single act.

## DnD-Feel Intent
Make a run feel more like a small adventure expedition with build-up before the boss.

## Source Docs
- `SCOPE.md`
- `GAME_DESIGN.md`
- `MAP_AND_NODES.md`
- `ROADMAP.md`

## Skeleton Scope
- Expand the map template to support more layers and more optional branches.
- Guarantee at least one shop and one recovery opportunity before the boss.
- Add optional elite or high-risk paths.
- Keep the current short-run mode available if useful for testing.

## Out of Scope
- Multiple acts.
- Procedural dungeon visuals.
- Open-world navigation.

## Dependencies
- Existing map graph and node flow.
- Feature 24 expanded event framework for more varied non-combat nodes.

## Acceptance Criteria Draft
- Generated or selected maps produce longer runs with meaningful branch choices.
- Boss remains reachable from every valid path.
- Map state persists correctly across the longer route.
- Integration tests cover a full longer run route.

## Planning Notes
- Respect the original one-act scope unless `SCOPE.md` changes.
- Decide target node count and expected run duration.
