# Feature 08 — Victory Reward Screen (M3.1)

## Goal
After a combat victory, open a reward screen that grants XP and gold, presents 3 reward cards, and updates the inventory. Level-up math lands in Feature 09.

## Source Docs
- `ARCHITECTURE.md` § State Model, § Screen Routing
- `PROGRESSION_AND_REWARDS.md` § Combat Reward Flow, § Reward Choice Model
- `CONTENT_CATALOG.md` § Items, § Potions, § Encounters (rewards)
- `DATA_MODEL.md` § EncounterDef (rewardPoolId)
- `ROADMAP.md` (M3.1)

## Includes

### Reward calculation (`src/run/RewardManager.ts`)
```ts
export interface CombatReward {
  xpPerHero: number;
  gold: number;
  cards: RewardCard[];   // exactly 3
}
export type RewardCard =
  | { kind: "item"; itemId: string }
  | { kind: "potion"; potionId: string }
  | { kind: "gold"; amount: number };

export function generateReward(encounter: EncounterDef, rng: () => number): CombatReward;
```

Formulas for the prototype:
- **XP per hero** = `5 * (number of enemies in encounter)`. All living heroes get the full amount (per `PROGRESSION_AND_REWARDS.md`: "Each participating character gains XP").
- **Gold** = `roll("2d6", rng).total + 3 * numEnemies`. (Aim for ~10–25 from a 2–3 enemy fight.)
- **Reward cards** = always exactly 3:
  - Card 1: an **item** drawn from a basic common pool (Iron Sword, Wooden Shield, Padded Armor, Apprentice Wand, Soldier Badge — avoid duplicates of items already in inventory or equipped if possible).
  - Card 2: a **potion** (50% Healing Potion, 30% Focus Potion, 20% Fire Flask).
  - Card 3: a **gold** card worth `5 + roll("1d4")`.
- Uncommon items (Ember Staff, Bloodstone, Owl Feather) appear only via "uncommon reward pool" encounters (those land in Feature 11 / 20). For Feature 08, common only.

### Potion defs (`src/data/items.ts` or `src/data/potions.ts`)
Add:
- `potion.healing` — Heal target hero 8 HP (capped). Usable out of combat too.
- `potion.focus` — +2 to next attack/heal roll (apply `Blessed`-like buff).
- `potion.fire_flask` — Range 3 consumable, `1d6` fire damage to one enemy.

For Feature 08, only **acquisition** matters. Potion **use** can be wired here or deferred to a small follow-up; recommend wiring at least Healing Potion use in the inventory panel so the player can heal between fights.

### Reward screen (`src/ui/screens/RewardScreen.ts`)
- Triggered automatically when `combatState.status === "victory"`.
- Shows:
  - "XP +N" per surviving hero (no leveling math yet — that's Feature 09; just add `xp` to each hero's `xp` field).
  - "Gold +N" added to `inventory.gold`.
  - 3 reward cards as clickable buttons. Player picks exactly one.
  - For an item card: after picking, prompt "Equip to Guardian / Acolyte / Arcanist" or "Stash". Stashing puts the item id into `inventory.items`. Equipping moves the previously equipped item (if any) into `inventory.items`.
- "Continue" button (visible after the choice is made) sets `gameState.screen = "main_menu"` for now. The real return-to-map flow lands in Feature 11.

### Inventory updates
- Equipping/stashing flows through `Inventory` updates.
- `inventory.gold` increments on screen entry (not when the player clicks anything — gold is always granted).

### Tests (`src/run/RewardManager.test.ts`)
- A 3-enemy encounter yields `xpPerHero = 15`.
- `generateReward` always returns exactly 3 cards.
- With a fixed RNG seed, the output is deterministic.
- The pool excludes items already held by all heroes (best effort; if pool is empty after filtering, fall back to any common).

## Out of Scope
- Level-up math (Feature 09).
- Map node integration (Feature 11).
- Uncommon/rare reward pools (Feature 20 content expansion).
- Sell-back at shop (Feature 13 is buy-only).

## Acceptance Criteria
- Victory transitions to the reward screen automatically.
- XP and gold visibly increase on the screen.
- Player can pick exactly one reward card and (if item) equip or stash it.
- Continue returns to main menu without crash.
- Reward generation tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/10 (Feature 08 — Victory Reward Screen).
>
> Read `ARCHITECTURE.md`, `PROGRESSION_AND_REWARDS.md` § Combat Reward Flow + Reward Choice Model, `CONTENT_CATALOG.md` items/potions, `DATA_MODEL.md` § EncounterDef, and `ROADMAP.md` (M3.1). Add `RewardManager` with the listed formulas, a `RewardScreen` showing XP/gold/3 cards with equip-or-stash, add potion defs and basic Healing Potion use, and pass the reward tests. Defer level-up math to Feature 09.
