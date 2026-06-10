# Campaign State Inventory

> Produced for issue #310 — prerequisite to the Multi-Act Framework milestone.  
> No gameplay behavior is changed here. This document maps the existing single-act
> state so that `CampaignState` and `ActProgress` can wrap or migrate it safely.

---

## 1. Run Lifecycle

| Responsibility | File | Symbol | Notes |
|---|---|---|---|
| Run start / initialization | `src/run/PartySetup.ts` ~129 | `createRunState()` | Builds fresh `RunState`; sets `runStatus: "active"`, zeroes nodes cleared, `bossDefeated: false` |
| Full game / run reset | `src/state/GameState.ts` ~418 | `resetGameState()` | Sets `gameState.run = null`; used when returning to main menu |
| Run status field | `src/state/RunState.ts` ~82 | `RunState.runStatus` | `"active" \| "won" \| "lost"` |

---

## 2. Map & Node Progress

| Responsibility | File | Symbol | Notes |
|---|---|---|---|
| Map state shape | `src/run/MapGraph.ts` ~4 | `MapState` interface | `currentNodeId`, `visitedNodeIds`, `nodesCleared`, `elitesDefeated`, `bossDefeated` |
| Node navigation | `src/run/MapGraph.ts` ~12 | `visitNode()`, `availableNextNodes()` | Adds to visited list; computes reachable next nodes |
| Boss completion | `src/ui/screens/RewardScreen.ts` ~348 | post-combat block | Sets `run.mapState.bossDefeated = true` when current node type is `"boss"` |
| Run victory trigger | `src/ui/screens/RewardScreen.ts` ~349 | post-combat block | Sets `run.runStatus = "won"` immediately after boss defeat |
| Run loss trigger | `src/ui/screens/CombatScreen.ts` ~1202 | post-defeat block | Sets `run.runStatus = "lost"` after total party wipe; routes to `run_summary` |

---

## 3. State That Should Carry Across Acts (→ `CampaignState`)

These fields survive act transitions. The campaign wrapper should copy them into the
next act's `RunState` (or reference them directly from a parent `ActProgress` record).

| Category | Storage location | Field(s) |
|---|---|---|
| Party composition | `RunState.party: PartyMember[]` | Full array: class, archetype, background, level-up choices |
| Character level & XP | `PartyMember` (RunState.ts ~15–20) | `level`, `xp` |
| Max HP (level-based) | `PartyMember` | `maxHp` (recalculated by `applyXpToPartyMember`, Leveling.ts ~103) |
| Equipped items | `PartyMember` | `equippedItemIds`, `weapon`, `armor`, `trinket` slots |
| Ability scores | `PartyMember` | `abilityScores`, `proficiencyBonus` |
| Action upgrades & passives | `PartyMember` | `actionUpgrades`, `passives`, `levelUpChoiceIds` |
| Spells known | `PartyMember` | `spellsKnown`, `preparedActionIds` |
| Permanent death | `PartyMember` | `deadForRun: boolean` — heroes dead in Act 1 remain dead in Act 2 |
| Shared inventory | `RunState.inventory` | `items[]`, `potions[]` (gold is act-specific, see §4) |
| Relics / attunements | `RunState.inventory.items` + `PartyMember.equippedItemIds` | Persist equipped relics across acts |
| Run modifiers / boons | `RunState.runModifiers: RunModifier[]` | Decide per modifier: some should persist (e.g. permanent boons), others expire per-act |
| Quest / event choices | `RunState.eventSelections: Record<string, string>` | Persist so events can react to prior choices across acts |
| Adventure log | `RunState.adventureLog: AdventureLogEntry[]` | Accumulate across acts for end-of-campaign summary |
| Adventure modifier | `RunState.adventureModifierId: string` | May carry across acts if it's a campaign-level modifier |
| Meta progression | `MetaProgressionState` (separate from RunState) | Already persists across all runs; no change needed |

---

## 4. State That Should Reset Between Acts (Long-Rest-Style Reset)

These fields reset at the act boundary, matching the fiction of an extended rest between acts.

| Category | Storage location | Field(s) | Current reset mechanism |
|---|---|---|---|
| Current HP | `PartyMember.hp` | Reset to `maxHp` | Mirrors `applyLongRest()` (Rest.ts ~216) |
| Spell slots | `PartyMember.spellSlotsRemaining` | Reset to `spellSlotsMax` | Mirrors Long Rest (Rest.ts ~219) |
| Hit dice remaining | `PartyMember.hitDiceRemaining` | Reset to `hitDiceTotal` | Mirrors `syncHitDiceForPartyMember()` |
| In-combat conditions | `UnitInstance.conditions` (combat only) | Not persisted to `PartyMember`; always fresh | `createHeroFromPartyMember()` (GameState.ts ~214) already starts with empty conditions |
| Short rests counter | `RunState.shortRestsSinceLongRest` | Reset to 0 | Already reset by `applyLongRest()` (Rest.ts ~209) |
| Gold | `RunState.inventory.gold` / `RunState.gold` | Reset (or carry only a fraction) — **design decision needed** | Currently persists within a run; no existing reset |
| Camp supplies | `RunState.campSupplies` | Reset to starting value for new act | No existing cross-act reset |
| Map state | `RunState.mapState` | Fully reset; new act = new map | Only bossDefeated flag is meaningful to archive |
| Shop states | `RunState.shopStates` (per-node) | Reset; new act = new nodes | — |
| Camp states | `RunState.campStates` (per-node) | Reset; new act = new nodes | — |
| Recruit offers | `RunState.recruitOffers` (per-node) | Reset; new act = new nodes | — |
| Forecast reveals | `RunState.revealedForecasts` | Reset; new act = new map | — |
| Run status | `RunState.runStatus` | Reset to `"active"` for next act | — |

> **Open design question:** Should gold fully reset, fully carry, or partially carry (e.g. 50 % of surplus)?  
> The current `InventoryState` structure supports any of these options without code changes.

---

## 5. State That Already Persists Across All Runs (No Changes Needed)

| Category | File | Notes |
|---|---|---|
| Renown | `src/meta/Renown.ts` | Computed at run end; accumulated in `MetaProgressionState` |
| Meta upgrades | `src/meta/MetaUpgrades.ts` | Unlocked via renown; applied at run start |
| Difficulty settings | `GameState` top-level | Not part of `RunState`; unchanged |

---

## 6. Recommended `CampaignState` / `ActProgress` Shape

```typescript
interface ActProgress {
  actNumber: number;           // 1-indexed
  runStatus: "active" | "won" | "lost";
  mapState: MapState;          // archived snapshot at act end
  nodesCleared: number;
  elitesDefeated: number;
  bossDefeated: boolean;
  goldEarned: number;          // for summary display
}

interface CampaignState {
  campaignId: string;
  seed: number;
  difficulty: string;
  party: PartyMember[];        // single source of truth; updated after each act
  inventory: InventoryState;   // shared items/relics; gold may reset per act
  runModifiers: RunModifier[];  // campaign-level boons; filter per-act boons at act boundary
  eventSelections: Record<string, string>;  // accumulates across acts
  adventureLog: AdventureLogEntry[];        // accumulates across acts
  completedActs: ActProgress[];
  currentActNumber: number;
  campaignStatus: "active" | "won" | "lost";
}
```

The existing `RunState` maps directly onto a single act. The campaign wrapper only
needs to:

1. Archive `RunState` into `ActProgress` at act end.
2. Strip reset fields (map, shop/camp states, per-node records, run status).
3. Apply long-rest-style recovery to `PartyMember` HP/slots/hit-dice.
4. Build a new `RunState` for Act 2 by calling `createRunState()` with the surviving party.
5. Extend `GameState` with `campaign: CampaignState | null`.

---

## 7. Key Entry Points for the Campaign Model Implementation

| Task | File to touch | What to do |
|---|---|---|
| Define types | `src/state/RunState.ts` (or new `src/state/CampaignState.ts`) | Add `CampaignState`, `ActProgress` interfaces |
| Extend game state | `src/state/GameState.ts` | Add `campaign: CampaignState \| null` to `GameState` |
| Archive act | New `src/campaign/CampaignManager.ts` | `archiveAct(run, campaign)` — snapshot + reset |
| Trigger act transition | `src/ui/screens/RewardScreen.ts` ~349 | After `runStatus = "won"`, check if campaign has next act |
| Build Act 2 run | `src/run/PartySetup.ts` | Overloaded `createRunState()` accepting existing party |
| Reset HP/slots | `src/run/Rest.ts` | Reuse `applyLongRest()` logic or extract `applyActBoundaryRest()` |
