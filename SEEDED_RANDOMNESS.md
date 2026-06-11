# Seeded Randomness Contract

> Design contract for campaign, map, encounter, and reward randomness.
> This document defines the seeding model that #161 (map templates) and #162 (encounter/
> reward pools) must implement. No runtime code is added here.

---

## 1. Goals

- Normal play uses randomness: different seeds produce different maps, encounter draws, and
  reward rolls every run.
- Local testing and automated tests can reproduce any run by providing the same seed.
- Random draws for different categories (map layout, encounter selection, reward selection)
  do not accidentally share state or corrupt each other's sequence.

---

## 2. Seed Ownership and Lifecycle

### Campaign Seed

One **campaign seed** is generated at campaign start. It is stored on `CampaignState`:

```typescript
interface CampaignState {
  seed: number; // generated once at campaign start; never changed during the run
  // ...
}
```

The campaign seed is the root. All other seeds in the run are derived from it. It is never
mutated after campaign start.

**Generation:**
- Normal play: `seed = Math.floor(Math.random() * 2 ** 31)`.
- Tests: pass a fixed seed value when constructing `CampaignState`.
- Debug/replay: expose seed in the run summary screen so players can report or replay runs.

### Derived Seeds

All random draws during the campaign use **derived seeds**, never the raw campaign seed and
never bare `Math.random()`.

A derived seed is computed from a stable combination of inputs:

```typescript
function deriveseed(campaignSeed: number, ...parts: (string | number)[]): number {
  // hash campaignSeed with parts to produce a stable integer seed
}
```

The specific hash function is an implementation detail. Requirements:
- Same inputs always produce the same output.
- Different `parts` inputs produce different outputs (low collision rate).
- Deterministic across JS engines (no platform-dependent behavior).

A simple acceptable implementation: concatenate all parts as a string, XOR character
codes with the campaign seed using a small integer hash (e.g. FNV-1a or djb2).

---

## 3. Seed Inputs Per Selection Category

Each category of random selection derives its seed from a distinct, stable set of inputs.
No two categories should share the same input set.

| Category | Seed input parts | Notes |
|----------|-----------------|-------|
| Act map layout selection | `campaignSeed`, `"map"`, `actId` | Selects which layout variant to use for the act |
| Map node type assignment | `campaignSeed`, `"node"`, `actId`, `layerIndex`, `slotIndex` | Assigns node type to each slot during procedural generation |
| Encounter selection | `campaignSeed`, `"encounter"`, `actId`, `nodeId`, `poolId` | Selects which encounter to place at a combat node |
| Reward pool draw | `campaignSeed`, `"reward"`, `actId`, `nodeId`, `drawIndex` | Selects each reward item from a pool |
| Shop inventory generation | `campaignSeed`, `"shop"`, `actId`, `nodeId` | Generates shop stock for a node |
| Event outcome selection | `campaignSeed`, `"event"`, `actId`, `nodeId`, `choiceIndex` | Selects event branch weights if any randomness applies |
| Elite encounter selection | `campaignSeed`, `"elite"`, `actId`, `nodeId` | Same structure as encounter; separate category to avoid collision |

**Rule:** if you add a new random selection category, add a new row with a unique literal
string label (e.g. `"weather"`, `"pet"`) as one of the parts. Never reuse another
category's label.

---

## 4. Deterministic Selection Function

Given a derived seed, a weighted selection from a pool must be fully deterministic:

```typescript
function weightedPick<T>(seed: number, items: Array<{ item: T; weight: number }>): T {
  // Use seed to drive a deterministic PRNG (e.g. LCG or xorshift32).
  // Compute cumulative weights; find the item whose bucket the PRNG value falls in.
  // Never use Math.random() here.
}
```

For unweighted picks (all weights equal), this simplifies to:
```typescript
function uniformPick<T>(seed: number, items: T[]): T {
  const index = deterministicPrng(seed) % items.length;
  return items[index];
}
```

The PRNG must not hold mutable state between calls. Each call takes a seed and returns a
value. Multiple draws from the same pool use `drawIndex` in the seed inputs to produce
independent values.

---

## 5. Test Contract

Tests that involve map generation, encounter selection, or reward drawing must:

1. Construct `CampaignState` with a fixed seed (e.g. `seed: 42`).
2. Call the function under test.
3. Assert the specific output (e.g. layout variant chosen, encounter ID selected).
4. Re-run with the same seed and assert the same output.

Tests must not call `Math.random()` directly or seed it with a timestamp. All randomness
during the test must flow through the derived-seed functions above.

Example test structure:
```typescript
it("selects the same encounter for the same seed", () => {
  const state = buildCampaignState({ seed: 42 });
  const pick1 = selectEncounter(state, "act1", "node_combat_3", "pool_goblin_normal");
  const pick2 = selectEncounter(state, "act1", "node_combat_3", "pool_goblin_normal");
  expect(pick1).toBe(pick2);
});

it("selects different encounters for different nodes with the same seed", () => {
  const state = buildCampaignState({ seed: 42 });
  const pickA = selectEncounter(state, "act1", "node_combat_3", "pool_goblin_normal");
  const pickB = selectEncounter(state, "act1", "node_combat_4", "pool_goblin_normal");
  expect(pickA).not.toBe(pickB); // different nodeId → different derived seed
});
```

---

## 6. Global Math.random() Guard

No campaign-critical selection — map layout, encounter, reward, shop, or event — may call
`Math.random()` directly. The only permitted call sites for bare `Math.random()` in
campaign logic are:

- Generating the initial campaign seed at run start (one call, not in a loop).
- UI-only effects (particle positions, animation jitter) that have no gameplay consequence.

All other call sites must use `weightedPick` / `uniformPick` with a derived seed.

Code review should flag any `Math.random()` call inside `src/campaign/`, `src/run/`,
`src/map/`, `src/encounter/`, or `src/rewards/`.

---

## 7. Relationship to Other Documents

- **`CAMPAIGN_STATE_INVENTORY.md`** — `CampaignState.seed` field location and lifecycle.
- **`ACT_NODE_RULES.md`** — Node type assignment uses `"node"` seed category defined here.
- **`CAMPAIGN_TARGETS.md`** — Node counts that procedural map generation must hit; seeded
  selection must still respect min/max node count constraints.
- **`MAP_AND_NODES.md`** — Node data schema; encounter and pool IDs used as seed parts.
