# Feature 04 — Actions, Damage, Healing (M1.4)

## Goal
Add a single basic attack action per hero (and per enemy) with attack rolls, damage, healing, hits, misses, and defeat. Full class action sets come in Feature 06.

## Source Docs
- `COMBAT_DESIGN.md` (attack rolls, damage formula, conditions)
- `CONTENT_CATALOG.md` (starter actions: Slash, Mace Strike, Fire Bolt, etc.)
- `DATA_MODEL.md` (Action definitions)
- `ROADMAP.md` (M1.4)

## Includes
- `Action` definition: id, name, range, targeting (enemy/ally/self), damage/heal formula, attack roll vs Armor.
- Give each hero one starter action (Guardian: Slash, Acolyte: Mend Wounds, Arcanist: Fire Bolt).
- Give each enemy one action (e.g., Rusty Stab for Goblin, Bite for Wolf).
- Action button(s) on the active hero's UI.
- Targeting mode: clicking the action button highlights valid targets in range; clicking a target resolves the action.
- Resolve attack: roll d20 vs Armor; on hit, roll damage; apply HP delta.
- Resolve heal: target HP increases (capped at max).
- HP bar/text on each unit token.
- Defeat: when HP ≤ 0, remove unit from grid and queue.
- Win/loss state: all enemies dead → "Victory" banner; all heroes dead → "Defeat" banner.
- Combat log records: attacker, action, roll, hit/miss, damage/heal, defeat, victory/defeat.

## Out of Scope
- Multiple actions per class, item-granted actions, cooldowns, conditions beyond simple application (those come later).
- Enemy AI — for this feature, enemies can still be passive; user can manually end their turn. (AI lands in Feature 05.)

## Acceptance Criteria
- Player can attack with each hero on their turn.
- Damage and healing apply correctly with HP caps.
- A unit at 0 HP is removed from the board and queue.
- Combat ends with a Victory or Defeat banner.
- Unit tests cover: damage application (no overheal, HP floor at 0), attack roll resolution (hit/miss threshold).

## Suggested Session Prompt
> Implement Feature 04 — Actions, Damage, Healing. Read `COMBAT_DESIGN.md`, `CONTENT_CATALOG.md`, `DATA_MODEL.md`, `ROADMAP.md` (M1.4). Add one action per hero and per enemy, attack/heal resolution, defeat, victory/defeat banners, and tests for damage/heal math.
