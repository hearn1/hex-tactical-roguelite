# Implementation Verticals

Each vertical should be independently testable and should create a visible improvement to the playable prototype.

## Vertical 1 — Tactical Combat Sandbox

### Goal
Prove that hex-grid party combat is fun and technically stable.

### Includes
- Hex grid rendering.
- Unit placement.
- Player party and enemies.
- Turn order.
- Movement.
- Basic attacks/actions.
- Health, damage, healing, defeat.
- Enemy AI.
- Combat log.
- Win/loss state.

### Acceptance Criteria
- Player can complete a combat encounter from start to finish.
- Units cannot move through occupied hexes.
- Range and targeting rules are enforced.
- Enemy turns resolve automatically.
- Combat ends correctly when one side is defeated.

## Vertical 2 — Class and Item Actions

### Goal
Make actions come from character class and equipment rather than one hardcoded attack.

### Includes
- Action definitions.
- Class actions.
- Item-granted actions.
- Cooldowns or once-per-combat actions, if needed.
- Tooltips.
- Action availability rules.

### Acceptance Criteria
- Guardian, Acolyte, and Arcanist each play differently.
- At least one equipped item changes available actions or stats.
- UI shows why an action cannot be used.

## Vertical 3 — Post-Combat Rewards

### Goal
Create the D&D-like reward moment after winning fights.

### Includes
- XP awarded to each surviving/participating character.
- Gold award.
- Item/potion drops.
- Level-up handling.
- Reward choice UI.
- Inventory update.

### Acceptance Criteria
- Winning combat opens a reward screen.
- Characters gain XP and can level up.
- Gold and items persist into the run state.
- Player can equip or stash a reward item.

## Vertical 4 — Branching Map and Node Flow

### Goal
Prove the run structure outside combat.

### Includes
- Act map generation or hardcoded prototype map.
- Node graph with connected paths.
- Current node tracking.
- Combat, shop, camp, recruit/pet, event, and boss node types.
- Run completion state.

### Acceptance Criteria
- Player chooses from connected next nodes.
- Combat nodes launch combat and return to map after victory.
- Boss node can end the run in victory.

## Vertical 5 — Shops, Rest, Recruits, and Pets

### Goal
Add non-combat decisions that affect the party.

### Includes
- Shop inventory and prices.
- Buy/sell or buy-only prototype.
- Camp/rest healing or upgrades.
- Recruit offers.
- Pet offers or placeholder pet implementation.

### Acceptance Criteria
- Player can spend gold at a shop.
- Player can heal or upgrade at a rest/camp node.
- Player can add a recruit or pet-like ally through a node.

## Vertical 6 — Permanent Meta Progression

### Goal
Add the first tier of unlocks: start-of-run improvements earned across runs.

### Includes
- Meta-currency earned at run end.
- Persistent save file.
- Upgrade menu.
- Starting gold upgrades.
- Starting XP/level upgrades.
- Starting equipment/stat/potion upgrades.

### Acceptance Criteria
- Run completion/failure grants meta-currency.
- Player can buy a permanent upgrade.
- New runs apply purchased upgrades.
- Save/load works across app restarts.

## Vertical 7 — Data-Driven Content Pipeline

### Goal
Make future content easy to add without rewriting core systems.

### Includes
- Definitions for classes, actions, items, enemies, encounters, nodes, and upgrades.
- Validation for missing IDs or invalid references.
- Central data repository/load step.
- Sample content catalog.

### Acceptance Criteria
- Adding a new item/action/enemy mostly requires editing data definitions.
- Invalid content produces a clear error.
- Runtime systems use definitions rather than duplicated hardcoded logic.

## Vertical 8 — Difficulty and Content Expansion

### Goal
Extend prototype into a replayable game.

### Includes
- Difficulty tiers.
- More encounters.
- More classes.
- More items.
- More events.
- Balance tuning.
- Optional second act.

### Acceptance Criteria
- Difficulty changes enemy scaling/rewards.
- Content can be added safely through existing data structures.
- Prototype remains playable without regressions.
