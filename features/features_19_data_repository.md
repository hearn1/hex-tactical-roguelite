# Feature 19 — Data Repository (M7.1)

## Goal
Move hardcoded game content into structured `data/` files (still TypeScript modules in `src/data/`, treated as the "JSON layer") behind a central `DataRepository`, with validation. Existing gameplay must continue to work unchanged after this refactor.

## Source Docs
- `DATA_MODEL.md` ← canonical schemas
- `TECH_PLAN.md` § Data-Driven Content
- `ARCHITECTURE.md` § Folder Layout
- `ROADMAP.md` (M7.1)

## Includes

### DataRepository (`src/run/DataRepository.ts`)
```ts
export interface DataRepository {
  classes: Map<string, ClassDef>;
  actions: Map<string, ActionDef>;
  items: Map<string, ItemDef>;
  potions: Map<string, PotionDef>;
  enemies: Map<string, EnemyDef>;
  encounters: Map<string, EncounterDef>;
  nodes: Map<string, NodeDef>;
  rewards: Map<string, RewardPoolDef>;
  upgrades: Map<string, UpgradeDef>;
  events: Map<string, EventDef>;
}

export function loadRepository(): DataRepository;   // throws on validation error
```

Load order (matters for cross-reference validation):
1. `actions`
2. `items`, `potions`
3. `classes` (refs actions + items)
4. `enemies` (refs actions)
5. `encounters` (refs enemies)
6. `events`
7. `rewards`
8. `nodes` (refs encounters / shop pools / events)
9. `upgrades`

### Validation rules
Throw a `DataValidationError` listing every problem found:
- All ids are unique within each definition map.
- Every `actionIds` in classes/enemies refers to an existing action.
- Every `startingItems` in classes refers to an existing item.
- Every `enemyId` in encounters refers to an existing enemy.
- Every `encounterId` in nodes refers to an existing encounter.
- Every `nextNodeIds` in nodes refers to an existing node.
- Every `rewardPoolId` in encounters refers to an existing reward pool (or is null).
- Every `shopPoolId` in shop nodes refers to a known pool ("basic" allowed if not yet defined as a separate def).
- Stats are non-negative.
- Ranges are 0–10.
- Damage formulas parse with the `dice.ts` parser.

### Refactor all consumers
Replace direct imports of `src/data/*.ts` with reads from a `DataRepository` instance held on `GameState.data` (load at app boot, before navigating to main menu).

Touch points (non-exhaustive):
- `CombatManager` / `Action.ts`: looks up `ActionDef` by id.
- `EnemyAI.ts`: looks up enemy def to get `aiTag`.
- `MapGraph`: looks up node defs.
- `RewardManager`: uses reward pools.
- `Shop`: uses item/potion ids.
- `MetaUpgrades`: uses upgrade defs.
- `Recruit`: uses class defs.

### Data files (`src/data/`)
Keep them as TypeScript modules exporting `Record<string, XDef>`. No JSON parsing yet — keeping TS lets us preserve types, and tree-shaking handles bundle size.

(If the agent prefers JSON, that's acceptable; just add a Vite JSON import and validation at load time. TS modules are simpler and equally data-driven.)

### Tests (`src/run/DataRepository.test.ts`)
- `loadRepository` succeeds on the real production data and returns expected counts (e.g., `repo.classes.size === 3`, `repo.actions.size >= 12`).
- A test fixture with a broken reference (e.g., `class.guardian` listing a non-existent action) causes `loadRepository` to throw a `DataValidationError` listing that specific problem.
- Duplicate id in any map → throws.
- Negative stats → throws.
- Adding a new common item via the data module and rebuilding does not require touching combat / reward / shop code (run the existing tests; they should pass unchanged).

## Out of Scope
- Hot-reload / live editing.
- JSON file format conversion (TS modules are fine).
- Localization.

## Acceptance Criteria
- All content lives in `src/data/`.
- A central `DataRepository` is loaded at boot and consumed by every system.
- Validation catches broken references with clear error messages.
- All prior tests still pass; new data tests pass.
- Adding a new item/action/enemy requires only a data file edit + (for action effects) possibly a small handler — never a refactor of combat/reward/shop core.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/21 (Feature 19 — Data Repository).
>
> Read `DATA_MODEL.md` (canonical schemas), `TECH_PLAN.md` § Data-Driven Content, `ARCHITECTURE.md`, and `ROADMAP.md` (M7.1). Add `src/run/DataRepository.ts` with the load order and validation listed in the feature spec, refactor all systems to read defs from `gameState.data`, ensure all prior tests still pass, and pass the listed validation tests.
