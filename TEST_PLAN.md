# Test Plan

## Manual Smoke Test — Combat Sandbox

1. Start prototype.
2. Enter combat sandbox.
3. Confirm party and enemies spawn.
4. Select active unit.
5. Confirm movement hexes highlight.
6. Move to a valid hex.
7. Attempt invalid move through occupied hex; confirm blocked.
8. Select attack action.
9. Confirm only valid targets highlight.
10. Attack enemy.
11. Confirm combat log shows roll/result/damage.
12. End turn.
13. Confirm enemies take turns automatically.
14. Defeat all enemies.
15. Confirm victory state appears.
16. Restart combat and allow party defeat.
17. Confirm defeat state appears.

## Manual Smoke Test — Rewards

1. Win combat.
2. Confirm reward screen appears.
3. Confirm each character receives XP.
4. Confirm gold increases.
5. Select an item or potion reward.
6. Confirm inventory updates.
7. Equip an item.
8. Confirm stats/actions update.
9. Enter next combat and confirm item effect applies.

## Manual Smoke Test — Map

1. Start new run.
2. Confirm map appears.
3. Select an available connected node.
4. Complete the node.
5. Confirm next connected nodes unlock.
6. Confirm disconnected nodes cannot be selected.
7. Reach boss node.
8. Win boss fight.
9. Confirm run victory summary.

## Manual Smoke Test — Meta Progression

1. End a run by victory or defeat.
2. Confirm Renown is awarded.
3. Open meta-upgrade menu.
4. Purchase starting gold upgrade.
5. Start new run.
6. Confirm starting gold increased.
7. Restart app/project.
8. Confirm upgrade persists.

## Automated Test Candidates

### HexGrid Tests
- Distance between same hex is 0.
- Adjacent hex distance is 1.
- Neighbor lookup returns 6 directions for interior hex.
- Movement range excludes occupied cells.
- Movement range respects movement points.

### Combat Tests
- Natural 1 misses.
- Natural 20 crits.
- Normal hit requires roll >= armor.
- Damage cannot reduce HP below 0.
- Healing cannot exceed max HP.
- Defeated units cannot act.
- Victory triggers when all enemies are defeated.
- Defeat triggers when all heroes are defeated.

### Reward Tests
- XP is applied after victory.
- Level-up triggers at threshold.
- Gold reward adds to run gold.
- Chosen item enters inventory.
- Equipped item modifies stats.

### Map Tests
- Only connected nodes are selectable.
- Completing node unlocks next nodes.
- Boss victory ends run.

### Meta Tests
- Renown calculation is deterministic.
- Purchased upgrade reduces Renown.
- Starting upgrades apply to new run.
- Save/load preserves purchased upgrades.

## Regression Checklist
Before any session ends:

- Project runs.
- No compile errors.
- Existing tests pass.
- Combat can still complete.
- New feature has at least one manual validation note.
- Documentation is updated if behavior changed.
