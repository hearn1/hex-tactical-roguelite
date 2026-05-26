# Feature 11 — Combat Node Integration (M4.2)

## Goal
Launch the combat sandbox from a Combat (and Elite) node on the map and return to the map through the reward screen on victory. Persist hero state between fights.

## Source Docs
- `MAP_AND_NODES.md`
- `CONTENT_CATALOG.md` § Encounters
- `ARCHITECTURE.md` § Screen Routing, § State Model
- `ROADMAP.md` (M4.2)

## Includes

### Encounter loading
- `src/data/encounters.ts` exposes `EncounterDef` keyed by id (some already added in Feature 10).
- Implement encounters from `CONTENT_CATALOG.md`:
  - `encounter.road_ambush`: 2 Goblin Skirmishers + 1 Wolf
  - `encounter.old_graveyard`: 2 Skeleton Archers + 1 Wolf
  - `encounter.bandit_toll`: 1 Bandit Brute + 2 Goblin Skirmishers
  - `encounter.cult_ritual`: 1 Cult Acolyte + 2 Skeleton Archers (uncommon reward pool)
  - Boss encounter id stays a stub here (real boss arrives in Feature 12).

Enemy positions: distribute across the right side of the grid (`q ∈ [+1, +3]`). Each encounter can have a small `spawn` array of fixed hexes, or compute from a simple layout function.

### Combat launch from map
- Clicking an available Combat/Elite node on the map:
  - Sets `gameState.combat = createCombat(encounter, party)`.
  - Navigates to `screen = "combat"`.
- `createCombat(encounter, party)`:
  - Builds `UnitInstance` for each hero from current `RunState.party` (carrying HP, XP, level, equipment, **and `bonusStats`** — event/level-up gains must persist between fights).
  - Spawns enemies per the encounter's enemy list.
  - Rolls initiative, builds turn queue.
  - **HP carries over** from prior fights — no auto-heal.
  - **Conditions are cleared** at the end of each combat (already true by default since `UnitInstance` is rebuilt from `RunState.party`, which does not store conditions).
- Document the canonical hero shape stored on `RunState.party`: a `PartyMember` record holding `{ instanceId, classId, displayName, level, xp, currentHp, bonusStats, equippedItemIds }`. `createCombat` materializes this into a fresh `UnitInstance` (resolving `stats` via `resolveStats`) on each entry; the reverse mapping on combat exit writes `currentHp`, `xp`, `level`, and `bonusStats` back.
- Heroes who died in a prior fight stay dead **only if** the entire combat was lost (then the run ends — see Defeat below). Since defeat ends the run, a hero who died but the team won is **revived to 1 HP** at the end of combat. Add this revive in the victory→reward transition. Document the choice in the combat log.

### Reward → map flow
- Reward screen's "Continue" button:
  - Persists XP/gold/items into `RunState`.
  - Marks the current node visited (`mapState.visitedNodeIds.add(currentNodeId)`).
  - Increments `RunState.nodesCleared`. If the node was elite, increments `elitesDefeated`.
  - Navigates back to `screen = "map"`.

### Defeat → end of run
- `combatState.status === "defeat"` → navigate to `screen = "run_summary"` with `runStatus = "lost"`.
- Run summary shows: nodes cleared, gold collected, best hero level, "Renown earned: 0" (real Renown lands in Feature 16; for now placeholder).
- "Return to Main Menu" clears `gameState.run`.

### Tests
- A unit test verifying `createCombat` uses the correct enemies from an encounter id.
- A unit test verifying HP carries: spawn a hero with `hp = 5`, run a combat that doesn't damage them, return; they still have `hp = 5`.
- A test verifying dead heroes revive at 1 HP after victory (not after defeat).

## Out of Scope
- Boss node (Feature 12).
- Renown calculation (Feature 16).
- Non-combat nodes (Features 13–15).

## Acceptance Criteria
- Player can complete ≥2 different combat nodes from the map.
- HP carries between fights; dead heroes are revived to 1 HP after a victory.
- Defeat ends the run with a summary screen.
- All combat-integration tests pass.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/13 (Feature 11 — Combat Node Integration).
>
> Read `MAP_AND_NODES.md`, `CONTENT_CATALOG.md` § Encounters, `ARCHITECTURE.md`, and `ROADMAP.md` (M4.2). Add encounter defs, wire Combat nodes to launch combat with HP carry-over and 1-HP revive on victory, plumb reward → map navigation, route defeat to a basic run-summary screen, and pass the listed tests.
