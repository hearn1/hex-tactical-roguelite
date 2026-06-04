Closes #57

Expands the single hardcoded act into a longer, branching expedition while keeping the original compact graph available for fast dev/testing. Per the resolved plan: **~12 nodes, single act**, explicit `MAP_TEMPLATES = { short, long }` + `mapTemplateId` on `RunState`, and **fresh encounters** for the new placements.

## What changed
- **`src/data/nodes.ts`** — Added `MapTemplate` type and `MAP_TEMPLATES = { short, long }`. `short` is the original prototype graph; `long` is the new 12-node / 8-layer expedition. A merged `NODE_REGISTRY` (node IDs are globally unique) still resolves any node for navigation/validation. Added `getMapTemplate()` + `DEFAULT_MAP_TEMPLATE_ID` (`long`) / `FALLBACK_MAP_TEMPLATE_ID` (`short`).
- **`src/data/encounters.ts`** — Added fresh `encounter.long_*` encounters for the new combat/elite nodes (composed from the existing enemy roster — see deferred note).
- **`src/state/RunState.ts`** — Added optional `mapTemplateId`. Absent → short (legacy fixtures stay valid).
- **`src/run/PartySetup.ts`** — `createRunState(party, difficulty, mapTemplateId = "long")` seeds map state from the chosen template's start node.
- **`src/run/MapGraph.ts`** — `bfsReachesBoss` now takes a `MapTemplate`; added `reachableNodeIds`, `enumerateRootToBossPaths`, and `RECOVERY_NODE_TYPES`.
- **`src/ui/screens/MapScreen.ts`** — Renders the active template's nodes and title; added a node-type/risk **legend**.
- **`tests/integration/helpers/autoPlay.ts`** — `autoPlayReward` now detects boss/elite by node *type* (not the hardcoded `node.boss` id) so it works for both templates.

## Long-template topology (12 nodes, layers 0–7, 4 branch points)
```
start ─┬─ combat_a ─┬─ elite_a (optional) ─┐
       │            └──────────────────────┤
       └─ event_a ─┬──────────────────────►├─► shop_a ─┬─ event_b ─┐
                   └─ combat_b ────────────┘            ├──────────►├─► camp_a ─┬─ combat_d ─┐
                                                        └─ combat_c ┘           ├───────────►├─► boss
                                                                                └─ recruit_a ┘
```
`shop_a` and `camp_a` are cut vertices → every path crosses a shop **and** a recovery node. `elite_a` is on an optional, skippable branch.

## Acceptance criteria
- [x] **Long template ~12 nodes / multiple branch points** — 12 nodes, 8 layers, 4 branch points (`MapGraph.test.ts` structural tests).
- [x] **Boss reachable from every valid path** — `bfsReachesBoss` per template + "no dead ends" test (every reachable non-boss node has an outgoing edge; only sink is the boss) + `enumerateRootToBossPaths` asserts each path ends at boss.
- [x] **Every root→boss path passes ≥1 shop and ≥1 recovery** — per-path unit tests over `enumerateRootToBossPaths`.
- [x] **At least one optional elite branch, skippable** — unit test: ≥1 path includes the elite, ≥1 path skips it.
- [x] **Map state stays correct across the longer route** — full-run integration test (`map-templates.test.ts`) drives a complete long run; asserts `nodesCleared`/`bossDefeated`.
- [x] **Short template still selectable + full-run green** — `createRunState(..., "short")` test + short full-run integration test; existing `playthrough.test.ts` still passes.
- [x] **`DataRepository.validate()` passes** — all `nextNodeIds`/`encounterId` refs resolve (build + existing DataRepository tests green; no validation warnings in-app).

## Tests
- Added: structural + invariant unit tests in `src/run/MapGraph.test.ts`; `createRunState` template tests in `PartySetup.test.ts`; `tests/integration/map-templates.test.ts` (full short + long runs).
- `npm test` → **316 passed (36 files)**.
- `npm run build` → **clean** (tsc + vite).
- Manual: `npm run dev` → Quick Start loads the 12-node "The Haunted Wilds" long map; legend renders; two routes open from start; converges at shop then camp before boss; no console errors.

## Deferred / confirm at review
- **New combat encounters reuse the existing enemy roster** (new `EncounterDef` groupings, not new enemies) to satisfy "author fresh encounters" without enemy-roster sprawl. The resolved plan flags this to **coordinate with #58 (F27 Encounter Variety Pack)** — enemy variety should come from F27 rather than being authored twice here.
- **New runs default to `long`.** Short stays selectable via `createRunState(..., "short")` and the `mapTemplateId` field (F35-seed-selectable); no UI toggle was added (out of scope).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
