# Next Session Prompt

Copy/paste this into Claude Code or Codex for the first implementation session.

---

You are implementing the first playable vertical for a new project called DnRogueLite.

Read these files first:

- `README.md`
- `SCOPE.md`
- `IMPLEMENTATION_PLAN.md`
- `ROADMAP.md`
- `COMBAT_DESIGN.md`
- `DATA_MODEL.md`
- `CONTENT_CATALOG.md`
- `CLAUDE.md`

Goal for this session: implement **M1 — Hex Combat Sandbox** from `ROADMAP.md`.

Build a small playable combat sandbox only. Do not implement the full roguelite map, rewards, shops, permanent progression, or extra content yet.

Required behavior:

1. Render a small hex grid.
2. Spawn a player party with Guardian, Acolyte, and Arcanist.
3. Spawn 2-3 enemies from the content catalog.
4. Implement turn order.
5. Let the player move the active hero on valid hexes.
6. Let the player use class actions with valid targeting.
7. Implement HP, damage, healing, misses/hits, and defeat.
8. Implement simple enemy AI that moves and attacks automatically.
9. Show a readable combat log.
10. End the combat with victory when all enemies die or defeat when all heroes die.

Implementation constraints:

- Keep visuals simple. Colored tokens, text labels, and placeholder UI are fine.
- Prefer modular code: HexGrid, CombatManager, Unit/UnitState, Action definitions, EnemyAI, UI layer.
- Do not build advanced terrain, line-of-sight, inventory, rewards, or meta progression in this session.
- Add basic tests for pure logic if the project stack supports tests.
- At the end, provide run instructions, changed files, tests/checks performed, known issues, and the recommended next milestone.

Acceptance test:

A player can start the prototype, complete a full tactical combat encounter, see logs for actions, and reach either a victory or defeat state without developer intervention.
