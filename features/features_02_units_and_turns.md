# Feature 02 — Units and Turn Order (M1.2)

## Goal
Place hero and enemy units on the grid, build a turn queue, render an active-unit indicator, and wire an "End Turn" button that cycles through every unit.

## Source Docs
- `ARCHITECTURE.md` ← state model, types location
- `COMBAT_DESIGN.md` § Unit Turn Structure, § Stats, § Prototype Classes
- `CONTENT_CATALOG.md` § Playable Classes, § Enemies
- `DATA_MODEL.md` § CharacterInstance, § CombatState, § EnemyDef
- `ROADMAP.md` (M1.2)

## Includes

### Types (`src/state/types.ts`)
Add interfaces following `DATA_MODEL.md` shapes:

```ts
export type Team = "hero" | "enemy";

export interface UnitStats {
  maxHp: number; armor: number; move: number;
  might: number; agility: number; spirit: number;
}

export interface UnitInstance {
  instanceId: string;          // "hero_01", "enemy_g1"
  defId: string;               // "class.guardian" or "enemy.goblin_skirmisher"
  displayName: string;
  team: Team;
  level: number;               // heroes start at 1
  xp: number;                  // heroes only; ignored for enemies
  stats: UnitStats;            // resolved including equipment bonuses (later)
  hp: number;
  pos: Hex;
  conditions: Condition[];     // empty for now
  hasMoved: boolean;
  hasActed: boolean;
}

export interface CombatState {
  round: number;
  activeIndex: number;         // index into turnQueue
  turnQueue: string[];         // instanceIds in initiative order
  units: UnitInstance[];
  log: CombatLogEntry[];
  status: "active" | "victory" | "defeat";
}
```

### Static content (`src/data/classes.ts`, `src/data/enemies.ts`)
Hardcode the 3 hero classes and at least 3 enemies (Goblin Skirmisher, Wolf, one of: Skeleton Archer / Bandit Brute) per `CONTENT_CATALOG.md` stats. Actions can be empty arrays for now — they land in Feature 04.

### Spawning
- On entering combat from main menu, build a fresh `CombatState`:
  - 3 heroes: Guardian at `{q:-3,r:0}`, Acolyte at `{q:-3,r:1}`, Arcanist at `{q:-3,r:2}` (clamp into grid; pick alternatives if invalid).
  - 2–3 enemies on the right side, e.g. Goblin at `{q:+3,r:-1}`, Wolf at `{q:+2,r:+1}`, Goblin at `{q:+3,r:+1}`.
  - All units at full HP. Hero level = 1.

### Initiative
- For each unit roll `d20 + agility` once (use `gameState.rng`). Sort descending; ties broken by team (heroes first), then by `instanceId`.
- Store the resulting `instanceId` list as `turnQueue`. `activeIndex = 0`.
- Log `[T1] Initiative: <list>`.

### UI
- Render unit tokens on the hex grid: filled circle in team color (blue heroes, red enemies), unit's initial as a letter (G, A, M for Guardian/Acolyte/Mage-Arcanist; G/W/S for Goblin/Wolf/Skeleton — disambiguate as needed).
- Active unit: a thicker outline + glow.
- HP bar or text under each token.
- Turn-order panel on the right showing the queue with the active unit highlighted.
- "End Turn" button. Clicking advances `activeIndex` modulo `turnQueue.length`; when wrapping back to 0, increment `round`.
- `CombatLog` panel renders the last 20 entries from `combatState.log`.

### Combat log entries this feature emits
- `[T1] Initiative: Mara(18), Sable(15), Eldra(12), Goblin(9), Wolf(7)`
- `[T1] Mara's turn begins.` on every advance.

## Out of Scope
- Movement (Feature 03).
- Actions / damage (Feature 04).
- Enemy AI auto-acting (Feature 05). For now, every unit (including enemies) just waits for the player to click End Turn.

## Acceptance Criteria
- Entering combat shows 3 heroes + 2–3 enemies on the grid.
- One unit is visibly marked active.
- "End Turn" cycles every unit in initiative order and increments round when wrapping.
- Initiative list is visible.
- Combat log records initiative + each turn start.
- A test in `src/combat/TurnQueue.test.ts` verifies sort order for a fixed initiative-roll set.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/4 (Feature 02 — Units and Turn Order).
>
> Read `ARCHITECTURE.md`, `COMBAT_DESIGN.md` (Unit Turn Structure / Stats / Prototype Classes), `CONTENT_CATALOG.md`, `DATA_MODEL.md` shapes, and `ROADMAP.md` (M1.2). Add the types in `state/types.ts`, hardcode class/enemy defs in `src/data/`, spawn 3 heroes + 2–3 enemies at fixed positions, roll d20+agility initiative, render active-unit indicator + turn-order panel + combat log, and wire End Turn to cycle the queue.
