# Data Model

Use a data-driven design so new classes, items, actions, enemies, encounters, nodes, and upgrades can be added without rewriting core logic.

The exact implementation language/engine can vary, but the model below should remain stable.

## Runtime State vs Definitions

### Definitions
Definitions are static content data.

Examples:

- `ClassDef`
- `ActionDef`
- `ItemDef`
- `EnemyDef`
- `EncounterDef`
- `NodeDef`
- `UpgradeDef`

### Runtime State
Runtime state changes during a run.

Examples:

- `RunState`
- `PartyState`
- `CharacterInstance`
- `InventoryState`
- `CombatState`
- `MapState`
- `MetaProgressionState`

## Key IDs
Every definition should use a stable string ID.

Examples:

```text
class.guardian
action.slash
item.iron_sword
enemy.goblin_skirmisher
encounter.forest_ambush_01
node.shop_basic
upgrade.starting_gold_1
```

## Suggested Definition Shapes

### ClassDef
```json
{
  "id": "class.guardian",
  "displayName": "Guardian",
  "role": "Frontline Defender",
  "baseStats": {
    "maxHp": 18,
    "armor": 14,
    "move": 3,
    "might": 3,
    "agility": 1,
    "spirit": 0
  },
  "startingItems": ["item.iron_sword", "item.wooden_shield"],
  "actionIds": ["action.slash", "action.shield_bash", "action.guard"]
}
```

### ActionDef
```json
{
  "id": "action.fire_bolt",
  "displayName": "Fire Bolt",
  "description": "Ranged spell attack that deals fire damage.",
  "source": "class",
  "targetType": "enemy",
  "range": 4,
  "requiresLineOfSight": false,
  "accuracyStat": "spirit",
  "effect": {
    "type": "damage",
    "formula": "1d8 + spirit",
    "damageType": "fire"
  },
  "cost": {
    "actionPoints": 1
  }
}
```

### ItemDef
```json
{
  "id": "item.apprentice_wand",
  "displayName": "Apprentice Wand",
  "slot": "weapon",
  "rarity": "common",
  "statBonuses": {
    "spirit": 1
  },
  "grantedActionIds": ["action.spark"]
}
```

### EnemyDef
```json
{
  "id": "enemy.goblin_skirmisher",
  "displayName": "Goblin Skirmisher",
  "aiTag": "skirmisher",
  "baseStats": {
    "maxHp": 8,
    "armor": 12,
    "move": 4,
    "might": 1,
    "agility": 3,
    "spirit": 0
  },
  "actionIds": ["action.rusty_stab", "action.shortbow_shot"]
}
```

### EncounterDef
```json
{
  "id": "encounter.road_ambush_01",
  "displayName": "Road Ambush",
  "gridTemplateId": "grid.basic_01",
  "enemyGroups": [
    { "enemyId": "enemy.goblin_skirmisher", "count": 2 },
    { "enemyId": "enemy.wolf", "count": 1 }
  ],
  "rewardPoolId": "reward.basic_combat"
}
```

### NodeDef
```json
{
  "id": "node.layer2.shop_01",
  "type": "shop",
  "title": "Traveling Merchant",
  "description": "A lantern-lit wagon waits beside the road.",
  "shopPoolId": "shop.basic",
  "nextNodeIds": ["node.layer3.combat_01", "node.layer3.camp_01"]
}
```

### UpgradeDef
```json
{
  "id": "upgrade.starting_gold.rank1",
  "displayName": "Coin Purse I",
  "description": "+5 starting gold.",
  "costRenown": 5,
  "maxRank": 5,
  "effect": {
    "type": "startingGoldBonus",
    "amountPerRank": 5
  }
}
```

## Runtime State Shapes

### RunState
```json
{
  "seed": 12345,
  "act": 1,
  "gold": 30,
  "party": {},
  "inventory": {},
  "mapState": {},
  "currentNodeId": "node.start",
  "nodesCleared": 0,
  "runStatus": "active"
}
```

### CharacterInstance
```json
{
  "instanceId": "hero_001",
  "classId": "class.guardian",
  "displayName": "Mara",
  "level": 1,
  "xp": 0,
  "currentHp": 18,
  "bonusStats": {
    "maxHp": 0,
    "might": 0,
    "agility": 0,
    "spirit": 0,
    "armor": 0
  },
  "equippedItemIds": {
    "weapon": "item.iron_sword",
    "armor": "item.padded_armor",
    "trinket": null
  }
}
```

### CombatState
```json
{
  "round": 1,
  "activeUnitInstanceId": "hero_001",
  "units": [],
  "grid": {},
  "turnQueue": [],
  "log": []
}
```

## Validation Requirements
A content loader should validate:

- All referenced IDs exist.
- Class/item/enemy actions exist.
- Encounter enemy IDs exist.
- Node next IDs exist.
- Reward/shop pools exist.
- Stats are non-negative where required.
- Ranges are sensible.

## Initial Implementation Note
If data loading adds too much friction, the first combat sandbox may hardcode definitions in code. Move to structured definitions by Vertical 7 at the latest.
