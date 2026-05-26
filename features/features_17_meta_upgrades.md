# Feature 17 — Meta Upgrade Menu (M6.2)

## Goal
Add a meta-upgrade menu accessible from the main menu where the player spends Renown on permanent starting bonuses. New runs apply purchased upgrades.

## Source Docs
- `PROGRESSION_AND_REWARDS.md` § Upgrade Categories
- `CONTENT_CATALOG.md` § Permanent Upgrades
- `DATA_MODEL.md` § UpgradeDef
- `ROADMAP.md` (M6.2)

## Includes

### Upgrade defs (`src/data/upgrades.ts`)
Implement these 5 upgrades from `CONTENT_CATALOG.md` (treat as canonical for prototype). **Note on `veteran_guardian`:** `CONTENT_CATALOG.md` defines this as "Guardian +1 Might"; `PROGRESSION_AND_REWARDS.md` describes a more general "Veteran Start" (any hero +1 level). The prototype follows `CONTENT_CATALOG.md` — Guardian-specific, +1 Might.

| Upgrade id | maxRank | Cost per rank | Effect per rank |
|---|---:|---|---|
| `upgrade.starting_gold` | 5 | `5, 8, 11, 14, 17` (i.e., `5 + 3 * (rank - 1)`) | +5 starting gold |
| `upgrade.starting_xp` | 5 | `8, 12, 16, 20, 24` (i.e., `8 + 4 * (rank - 1)`) | +10 starting XP per hero |
| `upgrade.potion_belt` | 2 | `8, 14` | +1 starting Healing Potion |
| `upgrade.veteran_guardian` | 1 | `12` | Guardian `bonusStats.might += 1` |
| `upgrade.apprentice_kit` | 1 | `12` | Arcanist starts with `item.apprentice_wand` equipped |

Encode the cost ladder as an array on the def: `costRenownPerRank: number[]` (length = `maxRank`). Lookup is `def.costRenownPerRank[nextRank - 1]`. Single-rank upgrades use a length-1 array.

`UpgradeDef` shape otherwise per `DATA_MODEL.md` § UpgradeDef. Storage uses `upgradeRanks: Record<string, number>` (matches `TECH_PLAN.md`'s save schema, e.g. `{ "upgrade.starting_gold": 3 }`).

### Upgrade application (`src/meta/Upgrades.ts`)
```ts
export function applyMetaUpgradesToFreshRun(run: RunState, meta: MetaProgressionState): void;
```

Effects map:
- `starting_gold` rank R: `run.inventory.gold += 5 * R`
- `starting_xp` rank R: each hero `xp += 10 * R`; then `applyXp(hero, 0)` to roll up level-ups if any. (Actually call `applyXp(hero, 10*R)` to award and roll up.)
- `potion_belt` rank R: `run.inventory.potions.push("potion.healing")` R times
- `veteran_guardian` rank 1: Guardian hero `bonusStats.might += 1`
- `apprentice_kit` rank 1: equip `item.apprentice_wand` on the Arcanist if not already equipped (and remove existing weapon to inventory)

### Purchase logic
```ts
export function canPurchase(upgradeId: string, meta: MetaProgressionState): { ok: true } | { ok: false; reason: string };
export function purchase(upgradeId: string, meta: MetaProgressionState): void;
```

Failure reasons: "Not enough Renown", "Max rank reached".

### MetaUpgrades screen (`src/ui/screens/MetaUpgrades.ts`)
- Reached from main menu.
- Shows current Renown.
- Lists every upgrade with: name, current rank / max rank, next-rank cost, effect description, "Buy" button.
- "Back" returns to main menu.
- Buying immediately mutates `MetaProgressionState` (persistence comes in Feature 18 — for now changes do NOT survive page reload).

### New-run wiring
- "New Run" on the main menu, **before** building the initial `RunState`, calls `applyMetaUpgradesToFreshRun`.

### Tests (`src/meta/Upgrades.test.ts`)
- Buying `starting_gold` rank 1 with 5 Renown reduces Renown to 0 and sets `upgradeRanks["upgrade.starting_gold"] === 1`.
- `applyMetaUpgradesToFreshRun` with `starting_gold` rank 2 adds 10 gold to a fresh run.
- `starting_xp` rank 1 grants 10 XP to every hero (verify by hero count).
- `canPurchase` returns `{ ok: false, reason: "Not enough Renown" }` when broke.
- `veteran_guardian` is one-shot (cannot be purchased twice).

## Out of Scope
- Persisting to disk (Feature 18).
- Refund mechanic.
- Pet/Recruit Network upgrades (deferred).

## Acceptance Criteria
- Meta menu reachable from main menu, showing current Renown and all upgrades.
- Buying an upgrade deducts Renown and increments rank.
- A new run after purchase visibly reflects the upgrade (starting gold higher, starting XP higher, etc.).
- All upgrade tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/19 (Feature 17 — Meta Upgrades).
>
> Read `PROGRESSION_AND_REWARDS.md` § Upgrade Categories, `CONTENT_CATALOG.md` § Permanent Upgrades, `DATA_MODEL.md` § UpgradeDef, and `ROADMAP.md` (M6.2). Add `src/data/upgrades.ts` with the 5 listed upgrades using rank-based storage (`upgradeRanks` map), implement `purchase`/`canPurchase`/`applyMetaUpgradesToFreshRun`, render `MetaUpgrades` screen reachable from main menu, wire new-run application, and pass the listed tests.
