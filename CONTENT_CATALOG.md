# Prototype Content Catalog

This is starter content for the first playable prototype. Keep numbers small and readable.

## Playable Classes

### Guardian
Role: frontline defender.

Base stats:

| Stat | Value |
|---|---:|
| Max HP | 18 |
| Armor | 14 |
| Move | 3 |
| Might | 3 |
| Agility | 1 |
| Spirit | 0 |

Actions:

- Slash
- Shield Bash
- Guard

### Acolyte
Role: healer/support.

Base stats:

| Stat | Value |
|---|---:|
| Max HP | 14 |
| Armor | 12 |
| Move | 3 |
| Might | 1 |
| Agility | 1 |
| Spirit | 3 |

Actions:

- Mace Strike
- Mend Wounds
- Bless

### Arcanist
Role: ranged spell damage/control.

Base stats:

| Stat | Value |
|---|---:|
| Max HP | 11 |
| Armor | 11 |
| Move | 3 |
| Might | 0 |
| Agility | 1 |
| Spirit | 4 |

Actions:

- Fire Bolt
- Frost Shard
- Arcane Ward

## Player Actions

| Action | User | Range | Effect |
|---|---|---:|---|
| Slash | Guardian | 1 | Attack, 1d6 + Might damage. |
| Shield Bash | Guardian | 1 | Attack, 1d4 + Might damage, applies Weakened. |
| Guard | Guardian | Self | Gain Guarded. |
| Mace Strike | Acolyte | 1 | Attack, 1d6 + Might damage. |
| Mend Wounds | Acolyte | 3 | Heal ally for 1d6 + Spirit. |
| Bless | Acolyte | 3 | Ally gains Blessed. |
| Fire Bolt | Arcanist | 4 | Spell attack, 1d8 + Spirit damage. |
| Frost Shard | Arcanist | 4 | Spell attack, 1d6 + Spirit damage, applies Slowed. |
| Arcane Ward | Arcanist | 3 | Ally gains Guarded. |

## Enemies

### Goblin Skirmisher
- Role: fast ranged nuisance.
- HP 8, Armor 12, Move 4.
- Actions: Rusty Stab, Shortbow Shot.
- AI tag: skirmisher.

### Wolf
- Role: melee chaser.
- HP 10, Armor 12, Move 5.
- Actions: Bite.
- AI tag: brute.

### Skeleton Archer
- Role: ranged attacker.
- HP 9, Armor 12, Move 3.
- Actions: Bone Arrow.
- AI tag: skirmisher.

### Bandit Brute
- Role: durable melee enemy.
- HP 16, Armor 13, Move 3.
- Actions: Heavy Club.
- AI tag: brute.

### Cult Acolyte
- Role: enemy support/caster.
- HP 12, Armor 11, Move 3.
- Actions: Dark Bolt, Minor Heal.
- AI tag: support.

### Boss: Ogre Hexbreaker
- Role: act boss.
- HP 42, Armor 13, Move 3.
- Actions: Massive Swing, Ground Slam, Roar.
- AI tag: boss.

## Enemy Actions

| Action | Range | Effect |
|---|---:|---|
| Rusty Stab | 1 | 1d4 + Might damage. |
| Shortbow Shot | 4 | 1d6 + Agility damage. |
| Bite | 1 | 1d6 + Might damage. |
| Bone Arrow | 5 | 1d6 + Agility damage. |
| Heavy Club | 1 | 1d8 + Might damage. |
| Dark Bolt | 4 | 1d6 + Spirit damage. |
| Minor Heal | 3 | Heal ally for 1d4 + Spirit. |
| Massive Swing | 1 | High melee damage. |
| Ground Slam | 1 | Hits adjacent enemies around boss or applies Slowed. |
| Roar | 3 | Applies Weakened to nearby heroes. |

## Items

### Weapons

| Item | Slot | Rarity | Effect |
|---|---|---|---|
| Iron Sword | Weapon | Common | +1 Might. |
| Wooden Shield | Weapon/Offhand or Trinket | Common | +1 Armor. |
| Apprentice Wand | Weapon | Common | +1 Spirit. |
| Hunter Bow | Weapon | Common | Grants Arrow Shot. |
| Ember Staff | Weapon | Uncommon | +1 Spirit, Fire Bolt deals +1 damage. |

### Armor

| Item | Slot | Rarity | Effect |
|---|---|---|---|
| Padded Armor | Armor | Common | +1 max HP. |
| Chain Vest | Armor | Common | +1 Armor, -1 Move if needed later. |
| Runed Robe | Armor | Uncommon | +1 Spirit, +1 max HP. |

### Trinkets

| Item | Slot | Rarity | Effect |
|---|---|---|---|
| Lucky Charm | Trinket | Common | Once per combat, first natural 1 becomes a normal miss. |
| Bloodstone | Trinket | Uncommon | +2 max HP. |
| Owl Feather | Trinket | Uncommon | +1 range on spell actions. |
| Soldier Badge | Trinket | Common | +1 Might. |

## Potions

| Potion | Effect |
|---|---|
| Healing Potion | Heal 8 HP. |
| Focus Potion | Next attack/heal gains +2. |
| Fire Flask | Range 3 consumable, deals 1d6 fire damage. |

## Encounters

### Road Ambush
- 2 Goblin Skirmishers.
- 1 Wolf.
- Basic reward pool.

### Old Graveyard
- 2 Skeleton Archers.
- 1 Wolf or Goblin.
- Basic reward pool.

### Bandit Toll
- 1 Bandit Brute.
- 2 Goblin Skirmishers.
- Basic reward pool.

### Cult Ritual
- 1 Cult Acolyte.
- 2 Skeleton Archers.
- Uncommon reward chance.

### Elite: Broken Banner Company
- 1 Bandit Brute.
- 1 Cult Acolyte.
- 2 Goblin Skirmishers.
- Better reward pool.

### Boss: Ogre Hexbreaker
- 1 Ogre Hexbreaker.
- Optional: 1 Skeleton Archer reinforcement if boss drops below 50% HP.

## Shops

Basic shop inventory:

- 2 random common items.
- 1 random uncommon item.
- 2 potions.
- Heal service.

## Permanent Upgrades

| Upgrade | Cost | Effect |
|---|---:|---|
| Coin Purse I | 5 Renown | +5 starting gold. |
| Coin Purse II | 10 Renown | Additional +5 starting gold. |
| Training Manual I | 8 Renown | Starting party gains +10 XP. |
| Potion Belt I | 8 Renown | Start with 1 Healing Potion. |
| Veteran Guardian | 12 Renown | Guardian starts with +1 Might. |
| Apprentice Kit | 12 Renown | Arcanist may start with Apprentice Wand. |
