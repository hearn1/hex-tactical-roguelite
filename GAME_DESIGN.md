# Game Design

## High Concept
DnRogueLite is a 5E-inspired tactical roguelite where the player controls a small party through branching adventure nodes. Combat is turn-based on a hex grid. Rewards include individual character XP, items, potions, gold, recruits, pets, and run-defining buffs. Across runs, the player unlocks better starting options such as extra starting gold, bonus XP/levels, starting gear, and stat boosts.

## Core Pillars

### 1. Tabletop Feel, Videogame Pace
The game should evoke the feeling of a tabletop fantasy combat encounter without implementing every tabletop rule. Dice rolls, class identity, positioning, healing, loot, and post-fight rewards matter. Long rule lookups, obscure edge cases, and complex character sheets do not.

### 2. Party Growth During the Run
Characters should become attached to the run. They gain XP, level up, equip items, drink potions, and may be replaced or joined by recruits/pets.

### 3. Meaningful Tactical Combat
The hex grid should matter. Movement, range, melee engagement, blocking, focus fire, healing, and enemy targeting should create interesting small decisions.

### 4. Branching Adventure Decisions
The map should create risk/reward choices. The player chooses between combat, shops, camps, shrines, events, recruits, elite fights, and bosses.

### 5. Permanent Progress Without Removing Challenge
Meta-unlocks should make future runs more flexible and give a sense of progress, but they should not trivialize the tactical game. Permanent bonuses should be capped and mostly affect early-run setup.

## Core Gameplay Loop

1. **Start Run**
   - Choose starting hero/party setup.
   - Apply unlocked starting bonuses.
   - Receive starting gold, potions, and equipment.

2. **Choose Map Node**
   - Select one of the connected next nodes on a branching act map.

3. **Resolve Node**
   - Combat nodes enter tactical battle.
   - Shop nodes allow spending gold.
   - Camp/rest nodes heal or upgrade.
   - Shrine/event nodes grant risk/reward choices.
   - Recruit/pet nodes offer party expansion.

4. **Combat**
   - Player controls each party member on a hex grid.
   - Each unit gets movement and one main action per turn.
   - Actions come from class abilities and equipped items.
   - Enemies use simple readable AI.

5. **Post-Combat Rewards**
   - XP is distributed to participating characters.
   - Gold and loot are awarded.
   - Player may choose from item/potion/buff/recruit rewards.
   - Characters may level up and unlock new stats/actions.

6. **Continue, Win, or Die**
   - Party death ends the run.
   - Defeating the act boss wins the prototype run.
   - Run result grants permanent meta-currency.

7. **Spend Permanent Unlocks**
   - Upgrade starting gold, starting XP, starting equipment options, stats, potion slots, or class availability.

## Prototype Run Shape

The first complete prototype should contain one short act:

- 8 to 10 map nodes total.
- 3 to 5 required combat encounters.
- 1 shop.
- 1 camp/rest node.
- 1 recruit or pet node.
- 1 act boss.

The run should last roughly 10 to 20 minutes in prototype form.

## Win/Loss

### Win Condition
Defeat the boss at the end of the act.

### Loss Condition
All player-controlled party members are defeated.

### Partial Progress
Even failed runs grant some meta-currency based on progress:

- Nodes cleared.
- Elite/boss attempts.
- Characters leveled.
- Gold earned.
- First-time achievements, later.

## Party Model

### Prototype Party Size
- Start with 3 heroes.
- Maximum active party size: 4.
- Pets may occupy a separate pet slot later; prototype can treat pets as normal allied units or defer them.

### Prototype Classes
- Guardian: frontline melee defender.
- Acolyte: healer/support.
- Arcanist: ranged spell damage/control.

### Future Classes
- Ranger: ranged physical damage.
- Rogue: mobile burst damage.
- Druid: pet/summon/nature support.
- Bard: buffs/debuffs.
- Warlock: risk/reward magic.

## Design Tone
The theme should be original fantasy adventure, not an official Dungeons & Dragons product. Use familiar tabletop-inspired concepts such as parties, classes, gear, dice, quests, and encounters, but avoid relying on protected setting names, proprietary monsters, or full rule replication.
