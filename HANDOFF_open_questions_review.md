# Handoff Prompt — Resolve Open Questions to Make Issues Implementation-Ready

> Paste everything below the line into a fresh Claude Code session in this repo. It is self-contained: every open question from the 2026-06-03 planning pass is embedded with a recommended option and alternatives, so you can run the review without re-reading all the issue comments.

---

## Role & Goal

You are finalizing the design for the `hearn1/hex-tactical-roguelite` prototype (a small, playable 5E-inspired hex-tactical roguelite — respect `CLAUDE.md` Scope Discipline; this is **not** a full tabletop simulator). A planning pass on 2026-06-03 posted a finalized plan as a comment on each of issues #52–#67 and the bug #69. Each feature comment ends with an **Open Questions for Maintainer** section. Your job is to drive those open questions to a decision **with the maintainer**, then record the decisions so each issue is ready for an implementer to pick up cold.

This is a **decision/recording pass — do not write feature code.**

## Source of truth (read if you need to verify an option against the code)
`SCOPE.md` → current milestone in `ROADMAP.md` → `COMBAT_DESIGN.md`, `DATA_MODEL.md`, `CONTENT_CATALOG.md`, `GAME_DESIGN.md`, plus each `features/features_NN_*.md`. The planning comments cite real `path:line` anchors; trust those but spot-check if a choice hinges on current behavior. Use the `gh` CLI; the local checkout is the working dir.

## Workflow (do this)

1. **Confirm the register is current.** Optionally run `gh issue view <N> --repo hearn1/hex-tactical-roguelite --comments` for any issue to confirm the embedded open questions still match the posted "Open Questions for Maintainer" section. The register below is the authoritative working copy.
2. **Resolve shared decisions ONCE.** Some questions are the same decision surfacing on two issues (see **Cross-Issue Linked Decisions**). Ask those first, then apply the answer to every linked issue.
3. **Present decisions to the maintainer with `AskUserQuestion`.** Batch up to 4 questions per call (group by issue). For every question: put the **recommended** option **first** and append `(Recommended)` to its label; include the alternative(s); keep the trade-off in the option description. The maintainer can always pick "Other".
4. **Record decisions back to GitHub.** After an issue's questions are answered, post a comment to that issue:
   ```
   gh issue comment <N> --repo hearn1/hex-tactical-roguelite --body-file <tmp>
   ```
   Use this heading and structure (write the body to a temp file first to avoid Windows PowerShell escaping, post, then delete it):
   ```
   ## Open Questions Resolved — <today's date>
   ### Decisions
   - <question> → **<chosen option>**. <one-line rationale / any maintainer note>
   ### Implementation-Ready
   <"All open questions resolved; ready to implement." or list any still-open items>
   ```
5. **Keep decisions consistent.** When recording a linked decision, reference the sibling issue (e.g. "consistent with #66"). Do **not** edit `features/*.md` and do **not** close any issue.
6. **Report** a final summary: a table of issue → decisions made, and flag anything the maintainer deferred or marked "Other" that needs a follow-up.

Notes:
- #69 (bug) has **no** open questions — skip it; it's already implementation-ready.
- If the maintainer picks an option that contradicts a linked issue, surface the conflict and reconcile before recording.

---

## Cross-Issue Linked Decisions (resolve these ONCE, apply to all listed issues)

- **L1 — RNG stream model.** Appears in **#54 Q2** and **#66 Q1**. One decision: single shared seeded stream vs. per-system sub-streams. *(Recommended: single shared stream.)* Record on both.
- **L2 — Event placement model.** Appears in **#55 Q1** and **#56 Q2**. One decision: per-node `eventPoolId` (curated, deterministic) with a default shared pool, vs. one global shared pool. *(Recommended: per-node pools + default shared pool.)* Record on both.
- **L3 — "Prepare/buff" reuse of `RunModifier`.** Touches **#55 Q2**, **#61**, **#66**. Keep a single `RunModifier` union as the home for run/encounter buffs; don't fork. Confirm once, keep consistent.

---

## Decision Register (recommended + alternatives, by issue)

### #54 — F23 Ability Checks Lite
1. **Partial-success model.** Recommended: **margin band (`partialWithin`)** — a near-miss within N of the DC reads as "partial". Alt: **flat rule** ("fail by ≤ some fixed amount = partial"). Alt: **binary only** (no partials). Trade-off: band gives per-check authoring flexibility; flat is simpler but rigid; binary is least flavorful.
2. **RNG stream (LINKED L1).** Recommended: **single shared seeded stream** for combat + checks (simplest, F35-reproducible). Alt: **dedicated check sub-stream** (robust to interleaving, more plumbing). Trade-off: shared means combat RNG changes shift later check draws.

### #55 — F24 Expanded Event Framework
1. **Event placement (LINKED L2).** Recommended: **per-node `eventPoolId` with a default shared pool**. Alt: **single global shared pool** (current behavior). Trade-off: per-node lets F25/F26 curate signature scenes; global is less code now.
2. **`buff` event power.** Recommended: **reuse the existing `RunModifier` union as-is**, permanent allowed (LINKED L3). Alt: **cap/temporary-only event buffs**. Trade-off: as-is is least code; capping avoids a single event swinging a run.

### #52 — F21 Run Setup & Party Creation
1. **Party size.** Recommended: **fixed 3, encoded as one constant, UI size-agnostic, documented as current-implementation-only** (already confirmed by maintainer). Alt: **selectable 1–4 now** (breaks encounter tuning). Trade-off: constant keeps future resizing cheap without building a variable selector now.
2. **Class-targeted meta upgrades with duplicate classes.** Today `party.find(pm => classId === ...)` lands the effect on the **first** matching hero. Recommended: **keep first-match for the prototype** (flag it in setup UI). Alt: **apply to all heroes of that class**. Alt: **let the player assign** the upgrade target. Trade-off: first-match is simplest but slightly unintuitive with duplicates.
3. **Hero names.** Recommended: **non-empty required, duplicates allowed** (cosmetic). Alt: **enforce unique names**. Trade-off: unique adds validation for no gameplay benefit.

### #53 — F22 Backgrounds and Personal Traits
1. **Background set.** Recommended: **5 backgrounds**, one minor effect each. Suggested set: *Hedge Scholar* (+1 Spirit), *Caravan Guard* (+1 Might), *Cutpurse* (+1 Agility), *Merchant's Heir* (+10 gold), *Field Medic* (+1 Healing Potion). Alt: **4 or 6**; Alt: **different effect menu**. Trade-off: 5 fits the 4–6 guidance and the 3 check stats + gold + potion levers.
2. **Quick Start background.** Recommended: **none** (keeps Custom vs Quick contrast meaningful). Alt: **fixed default per class**. Trade-off: defaults give Quick Start a small identity but blur the feature's purpose.

### #56 — F25 Event Content Pack: Adventure Scenes
1. **Count + tags.** Recommended: **10 events**, tag vocabulary `risk/social/treasure/heal/train/moral`. Alt: **8 minimal events**; Alt: **no tags**. Trade-off: 10 + tags gives the no-repeat pool variety and future map-gen hooks cheaply.
2. **Guaranteed vs pooled placement (LINKED L2).** Recommended: **support per-node guaranteed events for a few signature scenes, rest pooled** (follows L2). Alt: **fully pooled**. Trade-off: guaranteed scenes add authored-moment feel; pooled is simpler.

### #57 — F26 Longer Run Map Template
1. **Length / acts.** Recommended: **~12 nodes, single act** (no second act). Alt: **10 nodes**; Alt: **16+**. Trade-off: 12 feels like an expedition without big QA/balance cost.
2. **New combat nodes' encounters.** Recommended: **reuse existing encounters** at new placements (avoids content sprawl). Alt: **author fresh encounters** (overlaps F27). Trade-off: reuse is faster; fresh is more varied.
3. **Template structure.** Recommended: **explicit `MAP_TEMPLATES = { short, long }` + `mapTemplateId` on `RunState`** (testable, F35-selectable). Alt: **single registry gated at init**. Trade-off: explicit map is cleaner for tests and seeds.

### #62 — F31 Shop Services and Tavern Flavor
1. **Service set.** Recommended: **3 — Heal / Remove-Drawback / Buy-Rumor**; defer identify-item & hire-guide. Alt: **just Heal + Rumor**; Alt: **include identify/upgrade** (adds item-identification complexity SCOPE cuts). Trade-off: 3 hits "≥2 services" with low new state.
2. **Remove-Drawback timing.** Recommended: **pair with F35 drawbacks** (gives it real targets). Alt: **operate on combat conditions now** (works without F35). Trade-off: pairing is more meaningful; now-version risks being a near-noop until F35.
3. **Buy-Rumor reveal.** Recommended: **exact node type + title** (no hidden state). Alt: **vague hint**. Trade-off: exact is clearer; vague is more "rumor"-flavored but withholds info.

### #66 — F35 Adventure Modifiers and Run Seeds
1. **RNG stream (LINKED L1).** Recommended: **single global stream** (document interleaving caveat). Alt: **per-system sub-streams**. (Same decision as #54 Q2.)
2. **Seed visibility.** Recommended: **player-editable seed input in setup + display on run summary**. Alt: **internal-only seed with "copy seed" on summary**. Trade-off: editable enables shared/seeded runs; internal is less UI.
3. **Modifier vs difficulty.** Recommended: **modifiers STACK with the difficulty toggle** (not an alternate ladder; SCOPE bars extra ladders). Alt: **modifier replaces difficulty effects**. Trade-off: stacking preserves the existing toggle; replacing risks a second ladder.
4. **Modifier list.** Recommended: **4–6 modifiers, each a clear bonus+drawback**, reusing/extending the `RunModifier` union (e.g. *Generous Patron*, *Cursed Road*, *Veteran's Burden*). **Needs maintainer sign-off on the exact list + numbers.** Alt: fewer/different. Trade-off: readable few > many opaque.

### #58 — F27 Encounter Variety Pack
1. **New enemies?** Recommended: **data-only, 0 new enemies** (recompose + positions + reward pools). Alt: **exactly 1 new enemy** (specify AI tag from `brute/skirmisher/support/caster`). Trade-off: data-only avoids bestiary sprawl; one enemy adds variety at small cost.
2. **Encounter selection.** Recommended: **fixed `encounterId` per node for now**. Alt: **seeded combat-node pool** (varies per run; ties to F35). Trade-off: fixed is deterministic + simple; pool adds replay variety but couples to F35.

### #59 — F28 Elite and Boss Mechanics
1. **Boss mechanic scope.** Recommended: **telegraphed heavy attack as the headline**, optional light ≤50% phase flag. Alt: **telegraph only**; Alt: **phase/enrage only** (less interactive). Trade-off: telegraph is the most readable, reactable mechanic.
2. **Elite trait.** Recommended: **include "Rally"** (survivors gain to-hit when first elite falls; reuses bonus plumbing). Alt: **defer elites** to a follow-up. Trade-off: small add now vs. keeping the slice boss-only.
3. **Telegraph cadence.** Recommended: **unlocked/intensified at ≤50% HP** (dovetails the existing reinforcement threshold). Alt: **fixed every-2-boss-turns**. Trade-off: ≤50% ties to an existing hook; fixed is simplest to test.

### #60 — F29 Class Level-Up Choices
1. **Upgrade tables.** Recommended: **per-class tables with a shared fallback list** (caps authoring). Alt: **shared generic list for all classes**. Trade-off: per-class = identity; shared = less content.
2. **Action upgrades now?** Recommended: **stat/maxHp/passive first**, action upgrades as a fast follow. Alt: **include action upgrades now** (more new state: `unlockedActionIds`/`actionUpgrades`). Trade-off: deferring keeps the first slice lean.
3. **Choice vs auto gain.** Recommended: **chosen upgrade REPLACES that level's auto stat gain** (preserves power curve). Alt: **choices add ON TOP** (inflates power). Trade-off: replace keeps balance; on-top is more generous.

### #61 — F30 Rest, Camp, and Supplies
1. **Repair Gear + Supplies.** Recommended: **drop Repair Gear (no durability system) and add NO supplies resource** this slice; gate recovery by once-per-camp. Alt: **add a small supplies counter**; Alt: **add durability+repair**. Trade-off: dropping both avoids new persistent state and healing glut.
2. **Brew Potion cost.** Recommended: **small gold cost** (real tradeoff). Alt: **free but once per camp**. Trade-off: cost creates a decision; free is simpler but weaker.
3. **"Prepare" buff duration.** Recommended: **next-combat-only**. Alt: **persists until used**. Trade-off: next-combat-only is clearer and harder to hoard.

### #63 — F32 Magic Item Identity Pack
1. **Hook system cap.** Recommended: **~3 generic declarative hook types** (oncePerCombatBonus / conditionalStatBonus / grantAction), **zero per-item handlers**. Alt: **per-item `if (itemId===…)` handlers** (what the Planning Note warns against); Alt: **full effect-scripting** (over-engineered). Trade-off: 3 hooks balances flavor vs. complexity budget.
2. **Consumables.** Recommended: **model consumables as new potions** (no new use-system). Alt: **add a consumable item slot + use flow**. Trade-off: potions reuse existing flow; new slot is a new system.
3. **Count + signature items.** Recommended: **~10 items** (uncommon/rare mix). **Needs maintainer input** on the rare/uncommon split and any signature items guaranteed in reward pools. Alt: 8 or 12.

### #67 — F36 Bestiary and Rules Glossary
1. **Visibility.** Recommended: **show ALL prototype entries** (simplest; no new state) with an `isDiscovered()` seam for later gating. Alt: **discover-over-time** (needs `discoveredEnemyIds` state). Trade-off: show-all is best as an authoring/QA aid; discovery adds state for mild anti-spoiler value.
2. **In-run entry point.** Recommended: **small persistent button on Map/Combat** (+ Main Menu). Alt: **menu-only**. Trade-off: persistent button satisfies "inspect without leaving the run" most directly.
3. **Where glossary text lives.** Recommended: **separate `*_INFO` map** for condition/enemy descriptions (don't touch combat data shapes). Alt: **add `description` fields to enemy/condition types**. Trade-off: separate map avoids editing combat-critical types.

---

## After all decisions are recorded
- Confirm each of #52–#67 has an "Open Questions Resolved" comment and no dangling questions.
- Produce a final table: issue → key decisions → any maintainer "Other"/deferred items.
- Note which decisions are now hard constraints for implementers (especially the LINKED ones: L1 RNG model, L2 event placement, L3 `RunModifier` reuse).
