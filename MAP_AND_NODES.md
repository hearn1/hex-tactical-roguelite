# Map and Nodes

## Map Inspiration
The map should feel similar to a branching roguelite path map. The player sees several upcoming choices and commits to one connected path at a time.

## Prototype Act Structure
Use one act for the prototype.

Recommended structure:

- Start node.
- 3 to 4 layers of branching nodes.
- Pre-boss rest/shop layer.
- Boss node.

Example:

```text
Start
  -> Combat A / Combat B
      -> Shop / Event / Combat
          -> Elite / Recruit / Camp
              -> Combat / Shop
                  -> Boss
```

## Node Data
Each node should have:

- `id`
- `type`
- `title`
- `description`
- `encounterId` if combat/boss/elite.
- `shopPoolId` if shop.
- `rewardPoolId` if reward/event.
- `nextNodeIds`
- `visited`
- `available`

## Node Types

### Start
Initial run node. Applies starting party, upgrades, and loadout.

### Combat
Standard fight. Main source of XP, gold, items, and potions.

### Elite Combat
Harder fight with better rewards. Prototype can include one optional elite.

### Boss
Final act fight. Winning the boss completes the prototype run.

### Shop
Spend gold on items, potions, or services.

Prototype shop actions:

- Buy item.
- Buy potion.
- Heal one character.
- Remove one negative condition, if conditions persist later.

### Camp / Rest
Recover or improve party.

Prototype choices:

- Heal all party members for 40% max HP.
- Upgrade one item.
- Train one character for XP.

### Shrine / Buff Node
Gain a run-wide buff or character buff, potentially with a drawback later.

Prototype examples:

- +1 Might to one hero.
- +1 Spirit to one hero.
- Start next combat Blessed.

### Event
Short choice-based node. Keep very simple in prototype.

Example:

- Take 5 damage to gain 20 gold.
- Spend 15 gold to gain a random potion.
- Gain XP for one character.

### Recruit Node
Offer a new party member.

Prototype:

- Pick one of two recruits.
- If party is full, replace a current hero or decline.

### Pet Node
Future-friendly node type. Prototype can either:

- Treat pet as a simple allied unit, or
- Defer with placeholder text and reward.

Recommended prototype behavior: pet node grants a passive pet buff rather than adding a full unit.

Example pet buffs:

- `Battle Hound`: first enemy hit each combat takes +1 damage.
- `Owl Familiar`: first spell each combat gains +2 to hit.
- `Pack Mule`: +20% gold rewards.

## Map Generation

### Phase 1
Use a hardcoded map. This reduces risk and makes testing easier.

### Phase 2
Generate maps from a template:

- Fixed layer count.
- Random node type choices per layer.
- Guaranteed path to boss.
- Guaranteed at least one shop/rest before boss.

## Node Flow

1. Player selects available next node.
2. Node screen resolves the selected node.
3. If combat, launch combat scene/state.
4. On combat victory, show rewards.
5. Mark node complete.
6. Unlock connected next nodes.
7. Return to map.

## Acceptance Criteria

- Player cannot select disconnected nodes.
- Completed nodes stay marked.
- Next nodes become available after completion.
- Boss node ends the run on victory.
- Map state persists during the current run.
