# Feature 34 - Quest Rumors and Node Forecasts (Future)

## Goal
Add small quest hooks or rumors that preview upcoming risk and reward.

## DnD-Feel Intent
Make map decisions feel like choosing adventure leads from a tabletop session.

## Source Docs
- `MAP_AND_NODES.md`
- `GAME_DESIGN.md`
- `DATA_MODEL.md`
- `SCOPE.md`

## Skeleton Scope
- Add rumor text to selected upcoming nodes.
- Rumors can hint at encounter type, reward type, or event tone.
- Optionally let shops or events reveal additional information.
- Keep forecasts truthful enough to guide decisions.

## Out of Scope
- Full quest journal.
- Multi-run world state.
- Branching quest chains.

## Dependencies
- Existing map screen.
- Feature 26 longer run map template.

## Acceptance Criteria Draft
- Player can see at least partial information about upcoming choices.
- Revealed information persists for the run.
- Rumors influence player decisions without hiding mechanical essentials.
- Tests cover reveal state if added.

## Planning Notes
- This pairs well with longer maps so choices have more texture.
- Decide whether rumors are free, event rewards, or shop services.
