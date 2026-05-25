# Claude/Codex Implementation Rules

## Project Goal
Build a small, playable, extendable 5E-inspired hex tactical roguelite prototype. Do not attempt to build a full tabletop rules simulator.

## Source of Truth
Use these docs as the source of truth:

1. `SCOPE.md`
2. `IMPLEMENTATION_PLAN.md`
3. `ROADMAP.md`
4. `COMBAT_DESIGN.md`
5. `DATA_MODEL.md`
6. `CONTENT_CATALOG.md`

If documents conflict, prioritize `SCOPE.md` and the current milestone in `ROADMAP.md`.

## Scope Discipline
Implement only the requested milestone/session. Do not opportunistically add unrelated systems.

Do not add:

- Multiplayer.
- Online services.
- Full D&D rules.
- Large content lists.
- Complex art pipelines.
- Save/load for current run unless specifically requested.
- Advanced terrain/line-of-sight before basic combat works.

## Engineering Principles

- Keep systems modular.
- Prefer deterministic, testable logic.
- Keep UI simple and readable.
- Use placeholder visuals.
- Add clear logs for gameplay feedback.
- Prefer data definitions or centralized repositories over scattered constants.
- Avoid deep inheritance trees.
- Avoid large refactors unless necessary for the current milestone.

## Required End-of-Session Output
At the end of each coding session, report:

1. What changed.
2. Files created/modified.
3. How to run.
4. Tests/checks performed.
5. Known issues.
6. Recommended next milestone.

## Combat Implementation Rules

- Use axial coordinates internally for hexes if feasible.
- Enforce movement range.
- Enforce occupied-cell blocking.
- Enforce action range.
- Show combat logs for rolls, hits, misses, damage, healing, defeat, and victory/defeat.
- Enemy AI can be simple but must be complete.

## UI Rules

- Every player choice should be visible and reversible until confirmed when practical.
- Invalid choices should be disabled or clearly explained.
- No hidden state that affects player decisions.
- Text labels are acceptable placeholders.

## Content Rules

- Use original fantasy names and content.
- Do not use official D&D branding as the game title.
- Avoid proprietary monsters/settings unless explicitly confirmed as usable.
- If using SRD content, include proper attribution and keep the implementation compatible with the license note.

## Testing Rules

When possible, add tests for pure logic:

- Hex distance.
- Movement range.
- Action validation.
- Damage/heal rules.
- Reward generation.
- Meta upgrade application.

Manual testing is acceptable for UI-heavy steps, but document the manual checks performed.
