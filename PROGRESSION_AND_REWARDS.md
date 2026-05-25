# Progression and Rewards

The game has two progression tiers:

1. **Permanent starting unlocks** earned across runs.
2. **In-run rewards** earned after combats and nodes.

## Tier 1 — Permanent Starting Unlocks

### Purpose
Permanent unlocks create long-term progression and let players customize how future runs begin.

### Meta-Currency
Use a single prototype currency:

- `Renown`

Renown is earned at the end of a run based on progress.

Example formula:

```text
renownEarned = nodesCleared * 2 + elitesDefeated * 5 + bossDefeated * 15 + charactersLeveled * 1
minimum failed-run reward = 1
```

### Upgrade Categories

| Upgrade | Effect | Cap |
|---|---|---:|
| Starting Gold | +5 starting gold per rank. | 5 ranks |
| Starting XP | Starting party gains +10 XP per rank. | 5 ranks |
| Veteran Start | One chosen starting hero begins at +1 level. | 1 rank prototype |
| Starter Armory | Unlocks extra starting item choices. | 3 ranks |
| Stat Training | Chosen starting hero gains +1 stat. | 3 ranks |
| Potion Belt | Start with +1 potion. | 2 ranks |
| Recruit Network | Start with one extra recruit option. | Future |
| Pet Bond | Start with one pet buff choice. | Future |

### Design Rules
Permanent upgrades should:

- Mostly affect the start of a run.
- Be capped.
- Not invalidate early combat.
- Unlock options more often than raw power.

## Tier 2 — In-Run Rewards

### Purpose
In-run rewards are the D&D-like loot/XP moment after combat. They should make each run branch differently.

### Reward Types

| Reward | Description |
|---|---|
| Character XP | Each participating character gains XP. |
| Gold | Shared party currency for shops/events. |
| Items | Weapons, armor, trinkets, tools. |
| Potions | Consumables used in or outside combat. |
| Buffs | Temporary or run-long boons. |
| Recruits | New party members. |
| Pets | Passive buffs or allied units. |

## Combat Reward Flow

After victory:

1. Show XP gained per character.
2. Apply level-ups.
3. Show gold gained.
4. Offer reward choices.
5. Player selects/equips/stashes rewards.
6. Return to map.

## XP and Leveling

### Prototype Level Curve

| Level | XP Required Total |
|---:|---:|
| 1 | 0 |
| 2 | 20 |
| 3 | 50 |
| 4 | 90 |
| 5 | 140 |

Prototype run should usually end around level 3 or 4.

### Level-Up Reward
On level-up, keep the choice simple:

- +1 max HP and +1 chosen stat, or
- Unlock/upgrade one class action, later.

Phase 1 prototype can automate level-up:

- Guardian: +2 HP, +1 Might.
- Acolyte: +1 HP, +1 Spirit.
- Arcanist: +1 HP, +1 Spirit.

## Items

### Item Slots
Prototype slots:

- Weapon
- Armor
- Trinket

### Item Effects
Items can provide:

- Stat bonuses.
- Armor bonuses.
- Max HP bonuses.
- New action.
- Action modifier.

### Rarity
Prototype rarities:

- Common
- Uncommon
- Rare

Rarity should affect numbers only slightly in the first prototype.

## Potions

Prototype potions:

- Healing Potion: restore HP.
- Focus Potion: next action gains +2 to hit or +2 healing.
- Fire Flask: ranged consumable damage.

## Reward Choice Model
Use a simple choice screen:

- Always grant XP and gold.
- Then offer 3 reward cards.
- Player chooses 1.

Example reward cards:

- Item card.
- Potion bundle.
- Bonus gold.
- Character XP boost.
- Temporary buff.

## Boss Rewards
Winning the boss ends the prototype run and grants:

- Large Renown.
- Completion flag.
- Optional new permanent unlock availability.

## Failure Rewards
On defeat:

- Grant Renown based on progress.
- Show summary: nodes cleared, best character, gold earned, enemies defeated.
- Return to meta-upgrade menu.
