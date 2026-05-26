# Architecture and Conventions

This document pins down the implementation decisions that span every feature so future sessions stay consistent. Source-of-truth design docs still win for content/rules; this file wins for *how* it's built.

## Stack

**Web TypeScript + Vite + vanilla DOM/Canvas + Vitest.**

Why: minimal toolchain friction in a coding-agent environment, fast hot reload, easy to test pure logic with Vitest. No React or game engine — the prototype is small enough that vanilla DOM + canvas is simpler than any framework.

- **Package manager:** npm.
- **Bundler/dev server:** Vite.
- **Language:** TypeScript, strict mode on (`"strict": true`).
- **Test runner:** Vitest (co-located `*.test.ts` next to source).
- **Lint/format:** optional Prettier; do not block features on it.
- **Module system:** ES modules. No CommonJS.

Do not switch stacks mid-project. If a hard blocker appears, raise it as an issue first.

## Folder Layout

```
/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                 # entry, mounts UI, runs game loop
│   ├── data/                   # static content (Feature 19 centralizes loading)
│   │   ├── classes.ts
│   │   ├── actions.ts
│   │   ├── items.ts
│   │   ├── potions.ts          # added by Feature 08
│   │   ├── enemies.ts
│   │   ├── encounters.ts
│   │   ├── nodes.ts
│   │   ├── events.ts           # added by Feature 14
│   │   ├── rewards.ts
│   │   └── upgrades.ts
│   ├── core/                   # pure logic, framework-agnostic, fully tested
│   │   ├── hex.ts              # axial coords, neighbors, distance, range, BFS
│   │   ├── rng.ts              # seeded RNG
│   │   ├── dice.ts             # roll("1d6+3") style helper
│   │   └── ids.ts              # id helpers / type guards
│   ├── combat/
│   │   ├── CombatManager.ts
│   │   ├── TurnQueue.ts
│   │   ├── Action.ts           # resolveAction(state, action, target)
│   │   ├── EnemyAI.ts
│   │   └── Condition.ts
│   ├── run/
│   │   ├── RunManager.ts
│   │   ├── MapGraph.ts
│   │   ├── RewardManager.ts
│   │   └── Inventory.ts
│   ├── meta/
│   │   ├── MetaProgression.ts
│   │   └── SaveLoad.ts
│   ├── ui/
│   │   ├── App.ts              # top-level screen router
│   │   ├── screens/
│   │   │   ├── MainMenu.ts
│   │   │   ├── MetaUpgrades.ts
│   │   │   ├── MapScreen.ts
│   │   │   ├── CombatScreen.ts
│   │   │   ├── RewardScreen.ts
│   │   │   ├── ShopScreen.ts
│   │   │   ├── CampScreen.ts
│   │   │   ├── EventScreen.ts
│   │   │   ├── RecruitScreen.ts
│   │   │   └── RunSummary.ts
│   │   ├── HexRenderer.ts      # canvas grid + units
│   │   ├── ActionBar.ts
│   │   ├── CombatLog.ts
│   │   └── styles.css
│   └── state/
│       ├── GameState.ts        # the single mutable store
│       └── types.ts            # RunState, CombatState, MetaProgressionState, etc.
└── tests/                      # optional: cross-cutting tests live here; unit tests can co-locate
```

Earlier features may not need every folder — create them as needed but use these names so later features land naturally.

## Coordinate System

- **Axial coordinates** `(q, r)` internally. Cube coords only as intermediate math if useful.
- **Pointy-top hexes.**
- Hex radius (center to vertex): `HEX_SIZE = 36` pixels. Export from `src/core/hex.ts`.
- Pixel conversion (pointy-top):
  ```ts
  const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const y = HEX_SIZE * (3 / 2 * r);
  ```
- Grid origin in canvas: a `GRID_ORIGIN = { x: 280, y: 220 }` constant (tune per screen).
- Neighbor directions:
  ```ts
  export const AXIAL_DIRS = [
    { q: +1, r:  0 }, { q: +1, r: -1 }, { q:  0, r: -1 },
    { q: -1, r:  0 }, { q: -1, r: +1 }, { q:  0, r: +1 },
  ];
  ```
- Distance:
  ```ts
  (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
  ```
- Prototype grid: hex radius 3 (37 cells). Heroes spawn around `q ∈ [-3, -1]`, enemies around `q ∈ [+1, +3]`.

## RNG

All randomness must go through a seeded PRNG in `src/core/rng.ts`. Use mulberry32:

```ts
export function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`GameState` carries a single `rng` instance. Tests construct one with a fixed seed. Production seeds with `Date.now()` at run start. **Never call `Math.random()` directly.**

## Dice Helper

`src/core/dice.ts` exposes:

```ts
export function roll(spec: string, rng: () => number): { total: number; rolls: number[] };
// e.g. roll("1d6+3", rng) → { total: 7, rolls: [4] }
```

Supports `NdM`, `NdM+K`, `NdM-K`. Used everywhere damage/heal is rolled, including action formulas like `"1d8 + spirit"` where `+ spirit` is resolved by the action resolver, not by `roll()` (which only handles numeric modifiers).

## State Model

A single mutable `GameState` object in `src/state/GameState.ts`:

```ts
export interface GameState {
  screen: ScreenId;
  rng: () => number;
  rngSeed: number;
  meta: MetaProgressionState;
  run: RunState | null;
  combat: CombatState | null;
}
```

- One global instance, exported.
- Mutations go through manager modules (`CombatManager`, `RunManager`, etc.). UI reads `GameState` and calls managers.
- A simple `subscribe(cb)` / `emit()` notifier triggers re-renders. Avoid frameworks; just call `app.render()` after each player action.
- No persistence of `RunState` to disk (out of scope per `SCOPE.md`).
- `MetaProgressionState` persists to `localStorage` (Feature 18).

Type shapes live in `src/state/types.ts` and follow the JSON examples in `DATA_MODEL.md`.

## IDs

Stable string IDs per `DATA_MODEL.md`, e.g.:

```
class.guardian
action.slash
item.iron_sword
enemy.goblin_skirmisher
encounter.road_ambush
node.start
upgrade.starting_gold.rank1
```

Definitions live in `src/data/`. Runtime instances use opaque `instanceId` strings (e.g., `hero_001`, `enemy_g1`).

## Attack Resolution (canonical)

Per `COMBAT_DESIGN.md`:

```ts
const attackStat = action.accuracyStat ?? "might";
const stat = attacker.stats[attackStat];
const proficiency = 2 + Math.floor((attacker.level - 1) / 3); // = 2 at level 1
const d20 = Math.floor(rng() * 20) + 1;
const total = d20 + stat + proficiency;
const isCrit = d20 === 20;
const isAutoMiss = d20 === 1;
const hit = !isAutoMiss && (isCrit || total >= target.armor);

if (hit) {
  // Action.ts pre-substitutes "+ might" / "+ agility" / "+ spirit" in action.formula
  // with the attacker's stat value, so roll() only sees numeric modifiers (e.g., "1d6+3").
  // Do NOT add `stat` again here.
  const dmg = roll(rewriteFormula(action.formula, attacker), rng).total;
  target.hp -= isCrit ? dmg * 2 : dmg;
}
```

Note: action formulas in `CONTENT_CATALOG.md` are written like `"1d6 + might"`. The resolver substitutes `might/agility/spirit` with the attacker stat *before* calling `roll()`. Keep that substitution in `Action.ts` (`rewriteFormula` or inline) so it lives in exactly one place.

## Combat Log

A `CombatLogEntry[]` on `CombatState.log`. Each entry has `{ kind, text, turn }`. UI renders the last ~20 entries. Examples:

```
[T3] Goblin Skirmisher uses Rusty Stab on Mara — d20=14 +1+2=17 vs 14 → hit, 5 dmg
[T3] Mara is at 13/18 HP.
[T4] Victory — all enemies defeated.
```

## Screen Routing

`GameState.screen` is one of:

```
"main_menu" | "meta_upgrades" | "map" | "combat" | "reward" | "shop" | "camp" | "event" | "recruit" | "run_summary"
```

`App.ts` looks at `screen` and renders the matching screen module.

## Save Schema (Feature 18)

`localStorage` key: `dnroguelite.meta.v1`. Schema mirrors `TECH_PLAN.md`:

```ts
type SaveV1 = {
  schemaVersion: 1;
  renown: number;
  upgradeRanks: Record<string, number>;   // e.g. { "upgrade.starting_gold": 3 }
  completedRuns: number;
  bossWins: number;
};
```

`upgradeRanks` is the single source of truth for purchased upgrades (no separate `purchasedUpgradeIds` array — rank > 0 means owned).

Version mismatch → log a warning and reset to defaults. Save on (a) run end, (b) upgrade purchase.

## Testing

- Co-locate `*.test.ts` files in `src/core/`, `src/combat/`, `src/run/`, `src/meta/`.
- Aim for ≥80% coverage on `core/` (pure logic).
- UI and rendering: do not over-test. Manual checks are acceptable per `CLAUDE.md`.

Required tests per feature are listed in the feature spec; do not skip those.

## Conventions

- TypeScript strict mode.
- No `any`. Use `unknown` + narrowing if you must.
- No default exports — use named exports.
- Function names: camelCase. Types/interfaces: PascalCase.
- Constants: SCREAMING_SNAKE_CASE.
- No comments restating what the code obviously does (per `CLAUDE.md`).
- Keep modules small; if a file passes ~300 lines, consider splitting.
- Do not add a logger framework. Use `console.log` sparingly; player-facing events go in the combat log, not the dev console.

## What Future Features Can Assume

By Feature N, all earlier features have shipped. A new feature should:

1. Read this file + its own `features_NN_*.md` + the source docs they cite + `CLAUDE.md`.
2. Inspect the existing code in `src/` to learn types and helpers in place.
3. Only add new files when an existing module doesn't fit.
4. Update `PLAN.md` and the relevant issue at the end with what landed.
