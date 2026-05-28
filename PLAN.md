# Master Implementation Plan — Hex Tactical Roguelite

This is the canonical plan for incremental implementation of the prototype. **Future implementation agents should treat this file (and the linked feature issues) as authoritative for sequencing.**

## How to Use This Plan

1. Find the next open feature issue (lowest number that is still open).
2. Open the corresponding `features/features_NN_*.md` file in the repo for the detailed scope.
3. The session prompt format is:

   > Implement <github issue link>.
   >
   > Read the linked features file plus the source docs it lists, plus `CLAUDE.md`. Stay within the issue's scope — do not opportunistically build later features.

4. At end of session, follow the **Required End-of-Session Output** rules in `CLAUDE.md`:
   - What changed.
   - Files created/modified.
   - How to run.
   - Tests/checks performed.
   - Known issues.
   - Recommended next milestone (usually the next feature issue).

## Source-of-Truth Documents

Per `CLAUDE.md`, these are authoritative. If they conflict, `SCOPE.md` and the current `ROADMAP.md` milestone win.

- `ARCHITECTURE.md` — **read first.** Locks the stack, folder layout, coordinate system, RNG, state model, and naming conventions. All features defer to this for *how* things are built.
- `SCOPE.md` — what is and is not in the prototype.
- `IMPLEMENTATION_PLAN.md` — phases.
- `ROADMAP.md` — sub-milestones (M0.x – M7.x).
- `COMBAT_DESIGN.md` — combat rules.
- `DATA_MODEL.md` — data structures.
- `CONTENT_CATALOG.md` — starter content.
- `PROGRESSION_AND_REWARDS.md` — XP/Renown/upgrades.
- `MAP_AND_NODES.md` — node graph and node types.
- `TECH_PLAN.md` — stack + architecture guidance.

## Feature Issues, In Implementation Order

Each feature is one focused session. Do not skip ahead unless the prior feature is shipped.

| # | Feature | Milestone | Issue | File |
|---|---|---|---|---|
| 00 | Project Skeleton | M0.2 | [#2](https://github.com/hearn1/hex-tactical-roguelite/issues/2) | [features_00_project_skeleton.md](features/features_00_project_skeleton.md) |
| 01 | Hex Grid | M1.1 | [#3](https://github.com/hearn1/hex-tactical-roguelite/issues/3) | [features_01_hex_grid.md](features/features_01_hex_grid.md) |
| 02 | Units and Turn Order | M1.2 | [#4](https://github.com/hearn1/hex-tactical-roguelite/issues/4) | [features_02_units_and_turns.md](features/features_02_units_and_turns.md) |
| 03 | Movement | M1.3 | [#5](https://github.com/hearn1/hex-tactical-roguelite/issues/5) | [features_03_movement.md](features/features_03_movement.md) |
| 04 | Actions, Damage, Healing | M1.4 | [#6](https://github.com/hearn1/hex-tactical-roguelite/issues/6) | [features_04_actions.md](features/features_04_actions.md) |
| 05 | Enemy AI | M1.5 | [#7](https://github.com/hearn1/hex-tactical-roguelite/issues/7) | [features_05_enemy_ai.md](features/features_05_enemy_ai.md) |
| 06 | Class Actions (full sets) | M2.1 | [#8](https://github.com/hearn1/hex-tactical-roguelite/issues/8) | [features_06_class_actions.md](features/features_06_class_actions.md) |
| 07 | Item Equipment | M2.2 | [#9](https://github.com/hearn1/hex-tactical-roguelite/issues/9) | [features_07_item_equipment.md](features/features_07_item_equipment.md) |
| 08 | Victory Reward Screen | M3.1 | [#10](https://github.com/hearn1/hex-tactical-roguelite/issues/10) | [features_08_reward_screen.md](features/features_08_reward_screen.md) |
| 09 | Leveling | M3.2 | [#11](https://github.com/hearn1/hex-tactical-roguelite/issues/11) | [features_09_leveling.md](features/features_09_leveling.md) |
| 10 | Branching Map | M4.1 | [#12](https://github.com/hearn1/hex-tactical-roguelite/issues/12) | [features_10_branching_map.md](features/features_10_branching_map.md) |
| 11 | Combat Node Integration | M4.2 | [#13](https://github.com/hearn1/hex-tactical-roguelite/issues/13) | [features_11_combat_node_integration.md](features/features_11_combat_node_integration.md) |
| 12 | Boss and Run End | M4.3 | [#14](https://github.com/hearn1/hex-tactical-roguelite/issues/14) | [features_12_boss_and_run_end.md](features/features_12_boss_and_run_end.md) |
| 13 | Shop Node | M5.1 | [#15](https://github.com/hearn1/hex-tactical-roguelite/issues/15) | [features_13_shop.md](features/features_13_shop.md) |
| 14 | Camp / Event Node | M5.2 | [#16](https://github.com/hearn1/hex-tactical-roguelite/issues/16) | [features_14_camp_event.md](features/features_14_camp_event.md) |
| 15 | Recruit / Pet Node | M5.3 | [#17](https://github.com/hearn1/hex-tactical-roguelite/issues/17) | [features_15_recruit_pet.md](features/features_15_recruit_pet.md) |
| 16 | Renown Calculation | M6.1 | [#18](https://github.com/hearn1/hex-tactical-roguelite/issues/18) | [features_16_renown.md](features/features_16_renown.md) |
| 17 | Meta Upgrade Menu | M6.2 | [#19](https://github.com/hearn1/hex-tactical-roguelite/issues/19) | [features_17_meta_upgrades.md](features/features_17_meta_upgrades.md) |
| 18 | Save/Load Meta Progression | M6.3 | [#20](https://github.com/hearn1/hex-tactical-roguelite/issues/20) | [features_18_save_load.md](features/features_18_save_load.md) |
| 19 | Data Repository | M7.1 | [#21](https://github.com/hearn1/hex-tactical-roguelite/issues/21) | [features_19_data_repository.md](features/features_19_data_repository.md) |
| 20 | Content Expansion + Difficulty | M7.2 | [#22](https://github.com/hearn1/hex-tactical-roguelite/issues/22) | [features_20_content_expansion.md](features/features_20_content_expansion.md) |

## Future DnD-Feel Backlog

These are skeletal tracking issues proposed after the first prototype milestones. They are intentionally lighter than Features 00-20 and should be filled out in a later planning session before implementation.

| # | Feature | Theme | Issue | File |
|---|---|---|---|---|
| 21 | Run Setup and Party Creation | Character creation | [#52](https://github.com/hearn1/hex-tactical-roguelite/issues/52) | [features_21_run_setup_party_creation.md](features/features_21_run_setup_party_creation.md) |
| 22 | Backgrounds and Personal Traits | Character identity | [#53](https://github.com/hearn1/hex-tactical-roguelite/issues/53) | [features_22_backgrounds_and_personal_traits.md](features/features_22_backgrounds_and_personal_traits.md) |
| 23 | Ability Checks Lite | Tabletop dice moments | [#54](https://github.com/hearn1/hex-tactical-roguelite/issues/54) | [features_23_ability_checks_lite.md](features/features_23_ability_checks_lite.md) |
| 24 | Expanded Event Framework | Event systems | [#55](https://github.com/hearn1/hex-tactical-roguelite/issues/55) | [features_24_expanded_event_framework.md](features/features_24_expanded_event_framework.md) |
| 25 | Event Content Pack: Adventure Scenes | Event variety | [#56](https://github.com/hearn1/hex-tactical-roguelite/issues/56) | [features_25_event_content_pack_adventure_scenes.md](features/features_25_event_content_pack_adventure_scenes.md) |
| 26 | Longer Run Map Template | Run length | [#57](https://github.com/hearn1/hex-tactical-roguelite/issues/57) | [features_26_longer_run_map_template.md](features/features_26_longer_run_map_template.md) |
| 27 | Encounter Variety Pack | Combat variety | [#58](https://github.com/hearn1/hex-tactical-roguelite/issues/58) | [features_27_encounter_variety_pack.md](features/features_27_encounter_variety_pack.md) |
| 28 | Elite and Boss Mechanics | Set-piece fights | [#59](https://github.com/hearn1/hex-tactical-roguelite/issues/59) | [features_28_elite_and_boss_mechanics.md](features/features_28_elite_and_boss_mechanics.md) |
| 29 | Class Level-Up Choices | Character growth | [#60](https://github.com/hearn1/hex-tactical-roguelite/issues/60) | [features_29_class_level_up_choices.md](features/features_29_class_level_up_choices.md) |
| 30 | Rest, Camp, and Supplies | Party management | [#61](https://github.com/hearn1/hex-tactical-roguelite/issues/61) | [features_30_rest_camp_and_supplies.md](features/features_30_rest_camp_and_supplies.md) |
| 31 | Shop Services and Tavern Flavor | Adventure stops | [#62](https://github.com/hearn1/hex-tactical-roguelite/issues/62) | [features_31_shop_services_and_tavern_flavor.md](features/features_31_shop_services_and_tavern_flavor.md) |
| 32 | Magic Item Identity Pack | Loot identity | [#63](https://github.com/hearn1/hex-tactical-roguelite/issues/63) | [features_32_magic_item_identity_pack.md](features/features_32_magic_item_identity_pack.md) |
| 33 | Party Bonds and Banter Log | Party personality | [#64](https://github.com/hearn1/hex-tactical-roguelite/issues/64) | [features_33_party_bonds_and_banter_log.md](features/features_33_party_bonds_and_banter_log.md) |
| 34 | Quest Rumors and Node Forecasts | Map decisions | [#65](https://github.com/hearn1/hex-tactical-roguelite/issues/65) | [features_34_quest_rumors_and_node_forecasts.md](features/features_34_quest_rumors_and_node_forecasts.md) |
| 35 | Adventure Modifiers and Run Seeds | Run variety | [#66](https://github.com/hearn1/hex-tactical-roguelite/issues/66) | [features_35_adventure_modifiers_and_run_seeds.md](features/features_35_adventure_modifiers_and_run_seeds.md) |
| 36 | Bestiary and Rules Glossary | Player reference | [#67](https://github.com/hearn1/hex-tactical-roguelite/issues/67) | [features_36_bestiary_and_rules_glossary.md](features/features_36_bestiary_and_rules_glossary.md) |

**Start here:** Feature 00 → [#2](https://github.com/hearn1/hex-tactical-roguelite/issues/2).

## Dependencies (Why Order Matters)

- 00 is required by everything (no project to build in otherwise).
- 01 → 02 → 03 → 04 → 05 must be sequential — each builds on the last and together they form the M1 sandbox.
- 06 and 07 require 05 (a working combat).
- 08 requires 04 (combat) + 07 (inventory targets).
- 09 requires 08 (XP comes from rewards).
- 10 can technically start any time after 00, but it's most useful after 05 so combat is real.
- 11 requires 10 and the combat sandbox (≥05).
- 12 requires 11.
- 13–15 require 11 (map flow exists).
- 16 requires 12 (run-end summary exists).
- 17 requires 16 (Renown to spend).
- 18 requires 17 (something to save).
- 19 is a refactor — easiest after 17 so most content exists; do not do it earlier or you'll re-refactor.
- 20 requires 19.

## Scope Discipline Reminder

From `CLAUDE.md`:
- Implement only the requested feature.
- Do not opportunistically add unrelated systems.
- Avoid large refactors unless necessary for the current feature.

## Out of Prototype (Hard Cuts)

Per `SCOPE.md`: no multiplayer, no online services, no full 5E rules, no character creator, no procedural visuals, no cloud saves, no Steam integration. Do not implement these even if convenient.
