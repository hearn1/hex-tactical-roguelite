# Feature 07 — Item Equipment (M2.2)

## Goal
Equip items in Weapon/Armor/Trinket slots and have their stat bonuses and granted actions affect combat.

## Source Docs
- `ARCHITECTURE.md`
- `CONTENT_CATALOG.md` § Items
- `DATA_MODEL.md` § ItemDef, § CharacterInstance (`equippedItemIds`)
- `PROGRESSION_AND_REWARDS.md` § Items
- `ROADMAP.md` (M2.2)

## Includes

### Item defs (`src/data/items.ts`)
Implement at minimum these from `CONTENT_CATALOG.md`:

```ts
export interface ItemDef {
  id: string;
  displayName: string;
  slot: "weapon" | "armor" | "trinket";
  rarity: "common" | "uncommon" | "rare";
  statBonuses?: Partial<UnitStats>;  // e.g., { might: 1 } or { maxHp: 2 }
  grantedActionIds?: string[];
}
```

Initial items:
- `item.iron_sword` — weapon, common, `+1 might`
- `item.wooden_shield` — trinket, common, `+1 armor`
- `item.apprentice_wand` — weapon, common, `+1 spirit`
- `item.hunter_bow` — weapon, common, grants `action.arrow_shot` (range 4, agility, `1d6 + agility` dmg)
- `item.padded_armor` — armor, common, `+1 maxHp`
- `item.soldier_badge` — trinket, common, `+1 might`

(Define `action.arrow_shot` in `src/data/actions.ts` for the bow.)

### CharacterInstance updates
Add to `UnitInstance` (heroes only):

```ts
equippedItemIds: { weapon: string | null; armor: string | null; trinket: string | null };
bonusStats: Partial<UnitStats>;   // from items, recomputed on equip/unequip
```

### Stat resolution (`src/combat/Stats.ts`)
```ts
export function resolveStats(unit: UnitInstance): UnitStats;
```

Compute `base + sum(equippedItems.statBonuses) + bonusStats`. All systems that read `unit.stats` should now read via `resolveStats(unit)` (or alternatively, recompute and cache `unit.stats` whenever equipment changes — pick one and document; recommend computing once on equip-change and caching on `unit.stats`).

`armor` bonuses from items (e.g., Wooden Shield) stack additively.

### Starting equipment
Use `classDef.startingItems` (per `DATA_MODEL.md`):
- Guardian: `[item.iron_sword, item.wooden_shield]`
- Acolyte: `[item.padded_armor]`
- Arcanist: `[item.apprentice_wand]`

On unit spawn, equip each starting item into its slot. If a hero has 2 trinket-eligible items, equip the first; later items go in inventory.

### Inventory (`src/run/Inventory.ts`)
Stub a party-shared bag:

```ts
export interface InventoryState { items: string[]; potions: string[]; gold: number; }
```

For this feature, the bag is empty at run start (rewards will populate it in Feature 08).

### Item-granted actions
- When computing a hero's available actions, append `grantedActionIds` from each equipped item.
- Action bar shows class actions then granted actions.

### Equipment UI
- A small "Inventory" panel toggleable on the combat screen (or a dedicated tab on the menu) showing each hero's three slots and the unequipped bag.
- No swap UI required for this feature — equipping happens automatically from starting items. Swap UI lives in Feature 08's reward screen.

### Tests (`src/run/Stats.test.ts`)
- Guardian with Iron Sword + Wooden Shield has `might = 4` and `armor = 15`.
- Arcanist with Apprentice Wand has `spirit = 5`.
- Removing an item drops the bonus.
- An item-granted action appears in the hero's action list.

## Out of Scope
- Buying/selling (Feature 13).
- Inventory swap UI (Feature 08).
- Rarity-driven stat scaling beyond what `CONTENT_CATALOG.md` already specifies.

## Acceptance Criteria
- Heroes spawn with starting items equipped.
- Stat bonuses visibly affect combat rolls (e.g., Guardian's d20+might gains +1 from Iron Sword).
- Hunter Bow (if equipped on any hero for testing) adds Arrow Shot to their action bar.
- All stat tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/9 (Feature 07 — Item Equipment).
>
> Read `ARCHITECTURE.md`, `CONTENT_CATALOG.md` items, `DATA_MODEL.md` § ItemDef + CharacterInstance, and `ROADMAP.md` (M2.2). Add `src/data/items.ts`, `src/run/Inventory.ts`, equip starting items per class defs, implement `resolveStats`, hook item-granted actions into the action bar, and pass the listed tests.
