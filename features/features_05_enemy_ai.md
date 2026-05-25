# Feature 05 — Enemy AI (M1.5)

## Goal
Make enemy turns resolve automatically with simple but complete behavior: pick a target, move toward it, attack if in range.

## Source Docs
- `COMBAT_DESIGN.md` (AI tags: skirmisher, brute, support, boss)
- `CONTENT_CATALOG.md` (enemy AI tags)
- `ROADMAP.md` (M1.5)

## Includes
- Per-enemy AI controller invoked when an enemy becomes the active unit:
  - Pick target: nearest living hero (tie-break by lowest HP).
  - Move: BFS toward target along reachable path; stop when in action range or out of movement.
  - Attack: if a hero is in range of the enemy's action, perform it.
  - End turn automatically.
- Differentiate at least two AI tags:
  - **Brute**: melee chaser, closes to range 1.
  - **Skirmisher**: prefers ranged attack, stays at max range if possible.
- Pacing: brief delay between enemy actions for log readability.

## Out of Scope
- Boss-specific AI (lands in Feature 12).
- Support AI healing logic (can stub as melee for now or implement minimally).

## Acceptance Criteria
- A full combat plays automatically on enemy turns with zero player input.
- Brutes close to melee; skirmishers prefer to attack from range.
- Combat reaches victory or defeat without intervention.
- This completes the **M1 Hex Combat Sandbox**: a player can run one combat from start to finish.

## Suggested Session Prompt
> Implement Feature 05 — Enemy AI. Read `COMBAT_DESIGN.md`, `CONTENT_CATALOG.md`, `ROADMAP.md` (M1.5). Add an AI controller with brute and skirmisher behaviors, wire it into enemy turns, and verify a full combat resolves automatically.
