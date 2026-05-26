# Feature 13 — Shop Node (M5.1)

## Goal
Implement the Shop node: spend gold to buy items/potions and pay for a party heal.

## Source Docs
- `MAP_AND_NODES.md` § Shop
- `CONTENT_CATALOG.md` § Shops
- `ROADMAP.md` (M5.1)

## Includes

### Pricing (`src/run/Shop.ts`)
```ts
export const ITEM_PRICE: Record<Rarity, number> = { common: 8, uncommon: 18, rare: 35 };
export const POTION_PRICE: Record<string, number> = {
  "potion.healing": 6,
  "potion.focus": 8,
  "potion.fire_flask": 10,
};
export const HEAL_SERVICE_PRICE = 15;   // heals each living hero by 8 HP
```

### Shop generation
```ts
export interface ShopInventory {
  items: { itemId: string; sold: boolean }[];   // exactly 3 items
  potions: { potionId: string; sold: boolean }[]; // exactly 2 potions
  healServiceUsed: boolean;
}
export function rollShopInventory(rng: () => number, pools: { common: string[]; uncommon: string[]; potions: string[] }): ShopInventory;
```

**Where pools come from at this feature:** hardcode the arrays at the top of `src/run/Shop.ts` for now. These will move into `RewardPoolDef` / the `DataRepository` in Feature 19 — leave a `// TODO(F19): move to repo` comment so the refactor is easy to find.

```ts
const COMMON_ITEMS = [
  "item.iron_sword", "item.wooden_shield", "item.apprentice_wand",
  "item.hunter_bow", "item.padded_armor", "item.soldier_badge",
];
const UNCOMMON_ITEMS = ["item.ember_staff", "item.bloodstone", "item.owl_feather"];
const POTION_POOL = ["potion.healing", "potion.focus", "potion.fire_flask"];
```

Feature 20 adds the uncommon item defs; in Feature 13 the uncommon list may dereference ids that don't exist yet — guard `rollShopInventory` so unknown ids are filtered out, falling back to common picks.

Composition per `CONTENT_CATALOG.md` § Shops:
- 2 random common items.
- 1 random uncommon item.
- 2 random potions (with repeats allowed; if pool runs out, take the same potion type twice).
- 1 heal service.

Persist the shop inventory **per node** on the `RunState` so leaving and re-entering the same shop shows the same items + their sold state. Add `RunState.shopStates: Record<NodeId, ShopInventory>`.

### Shop screen (`src/ui/screens/ShopScreen.ts`)
- Launched when the player visits a `node.type === "shop"`.
- Header: current gold.
- Three sections:
  - **Items** — each item shows displayName, rarity, stat bonuses summary, price, Buy button. Sold-out items render greyed.
  - **Potions** — same pattern.
  - **Services** — "Heal Party (8 HP each)" with price and Buy. Greys out after use.
- Buying an item:
  - Deducts gold.
  - Opens the same equip-or-stash modal used in the reward screen, or auto-stashes if no decision is needed.
  - Marks the slot sold.
- Buying a potion: deducts gold, adds to `inventory.potions`, marks sold.
- "Leave" → returns to map, marks node visited.

### Disabled states
- Item/potion you can't afford: button greyed with tooltip "Not enough gold".
- Heal service after use: "Already used".

### Tests (`src/run/Shop.test.ts`)
- `rollShopInventory` returns exactly 3 items and 2 potions.
- Buying an item deducts the correct gold and marks `sold = true`.
- Heal service heals each living hero by 8 HP, capped at maxHp, and sets `healServiceUsed`.
- Insufficient gold rejects the purchase without mutating state.

## Out of Scope
- Selling items.
- Restocking after revisits (single-visit by default; persistent sold state already covers re-visits).
- Removing negative conditions service (no persistent conditions exist in prototype).

## Acceptance Criteria
- Shop nodes open the ShopScreen with the documented inventory shape.
- Player can buy items, potions, and the heal service, with gold deducted correctly.
- Sold items remain sold if the player leaves and re-enters the shop within the same run.
- All shop tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/15 (Feature 13 — Shop Node).
>
> Read `MAP_AND_NODES.md` § Shop, `CONTENT_CATALOG.md` § Shops, and `ROADMAP.md` (M5.1). Add `src/run/Shop.ts` with the listed prices and `rollShopInventory`, persist per-node shop state on `RunState`, render the `ShopScreen` with item/potion/heal sections, wire purchases through gold and inventory updates, and pass the listed tests.
