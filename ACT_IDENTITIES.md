# Act Mechanical Identities and Boss Roles

This document defines the mechanical identity and placeholder boss role for each of the four campaign acts. It is a design specification. No encounter pools, new combat mechanics, or balance tuning are implemented here.

Later encounter, boss, and test tasks should reference this document as the authoritative source for act shape.

---

## Act 1 — The Verdant Threat

**Mechanical Identity:** Introduces all baseline mechanics.

Act 1 is the tutorial act. Every core combat system — movement, melee attacks, ranged attacks, spells, conditions, healing, and the turn queue — must be reachable through normal play. Enemy AI uses the basic priority loop (move toward target, attack lowest-HP target in range). No scripted boss phases or advanced hazards are required.

**Enemy Profile:**
- Enemy families: goblins, primal nature creatures.
- AI personalities in use: `brute`, `skirmisher`.
- Conditions encountered: `Burning`, `Weakened` (optionally introduced via enemy actions).

**Boss Encounter Shape:**
A single dominant enemy (goblin warchief or primal elemental) with 1–2 normal enemy reinforcements already on the field. The boss uses the `boss` AI tag. No mid-fight reinforcement waves; the threat is the boss's elevated stats and an area-effect or multi-target attack.

**Priority Target Role:** None required. The boss is the obvious focus.

**Hazard / Telegraph Notes:**
Hazards and telegraphs are not required in Act 1. If the hazard system lands before Act 1 content is finalized, a single mild environmental hazard (e.g., a burning patch that applies `Burning` on entry) is acceptable as an optional introduction.

**Future Dependencies:**
- Goblin and primal creature data entries in the monster family registry.
- Act 1 encounter pool (normal encounters + boss encounter).
- Side quest branch: optional rescue/exploration node (see `CAMPAIGN_ARC.md`).

---

## Act 2 — The Iron Wall

**Mechanical Identity:** Single strong boss encounter.

Act 2 introduces the ogre/skeleton enemy families and culminates in a fight designed around one dominant melee threat. The act tests the party's ability to sustain through a high-damage encounter without a second kill target to fall back on. Normal encounters in the act should include at least one skeleton enemy that demonstrates undead resilience or the `Weakened` condition.

**Enemy Profile:**
- Enemy families: goblins (holdovers), ogres, skeletons.
- AI personalities in use: `brute` (ogres), `skirmisher` (goblins), `support` (necromancer lieutenant).
- Conditions encountered: `Weakened` (skeleton attacks), `Slowed` (optional ogre stomp).

**Boss Encounter Shape:**
An ogre warlord (`brute` tag, high HP, heavy melee damage) paired with a necromancer lieutenant (`support` tag) that resurrects a defeated skeleton once per fight. The necromancer is a priority target — leaving it alive causes the skeleton to re-enter play. The warlord is the final kill condition.

**Priority Target Role:** The necromancer lieutenant is a soft priority target. The party can ignore it, but doing so creates compounding pressure. This is the first encounter in the campaign that rewards deliberate target selection.

**Hazard / Telegraph Notes:**
The warlord's strongest attack should be telegraphed one turn in advance using the telegraph system when available (e.g., "Warlord readies a crushing blow — all adjacent units take 2× damage next turn"). If telegraphs are not yet implemented, a combat log warning ("The warlord winds up…") is an acceptable placeholder.

**Future Dependencies:**
- Ogre, skeleton, and necromancer data entries.
- Act 2 encounter pool.
- Telegraph system (can land independently; boss works without it via log text).
- Side quest branch: ogre deserter node offering alternate passage.

---

## Act 3 — The Ashen Choir

**Mechanical Identity:** Multiple priority targets.

Act 3 is the multi-target act. Encounters are designed around groups of medium-priority enemies rather than one dominant figure. The party cannot focus a single target and ignore the rest — spread damage and coordinated kills are required. Normal encounters introduce cultist casters with `support` or `caster` AI that buff or heal adjacent enemies if left alone.

**Enemy Profile:**
- Enemy families: skeletons (holdovers), cultists.
- AI personalities in use: `caster`, `support`, `brute` (skeleton tanks).
- Conditions encountered: `Blessed` (cultist buffs on allies), `Burning` (cultist fire spells).

**Boss Encounter Shape:**
Three cult commanders spread across the field, each with a distinct role (one `brute`, one `caster`, one `support`). The commanders must be neutralized before a high-priest fanatic activates a second phase. If all three commanders are alive when the high priest enters, they gain `Blessed` and deal increased damage. Destroying commanders before the high priest phase rewards preparation.

This is the first encounter in the campaign that uses a **multi-stage structure**: clear the commanders, then face the high priest. No new combat systems are required — this is achieved through enemy sequencing and conditional reinforcement (high priest spawns or becomes active when the last commander falls or after a turn threshold).

**Priority Target Role:** All three commanders are hard priority targets. The high priest is the final kill condition.

**Hazard / Telegraph Notes:**
Cultist commanders should telegraph their strongest actions (mass bless or a sacrifice action that heals the high priest). Hazard tiles (cursed ground that applies `Weakened` on entry) are appropriate here if the hazard system is available.

**Future Dependencies:**
- Cultist and high-priest data entries.
- Act 3 encounter pool.
- Reinforcement/activation trigger system (high priest spawning or activating on a condition).
- Side quest branch: prisoner rescue node and ancient tomb relic node (see `CAMPAIGN_ARC.md`).

---

## Act 4 — The Ascending Dark

**Mechanical Identity:** Boss plus priority supports (combines Act 2 and Act 3 patterns).

Act 4 is the campaign climax. The final encounter mixes one dominant boss threat (as in Act 2) with mandatory priority-support kills (as in Act 3). The party must manage both threat vectors simultaneously. Normal encounters leading up to the final boss use all enemy families encountered across the campaign — cultists, draconid soldiers, and arcane constructs.

**Enemy Profile:**
- Enemy families: cultists, draconid, arcane constructs.
- AI personalities in use: all tags (`brute`, `skirmisher`, `caster`, `support`, `boss`).
- Conditions encountered: all conditions from prior acts, plus any new conditions introduced by Act 4 implementation tasks.

**Boss Encounter Shape — Final Campaign Encounter:**
A draconid arcane lord (`boss` tag) with 2 draconid elite bodyguards (`brute` tag). The bodyguards protect the lord by intercepting attacks — they should be positioned between the party and the lord at fight start. The lord uses scripted phase abilities: at 50% HP it dismisses remaining bodyguards (they do not flee — they become enraged) and gains a powerful AoE or multi-target attack. Defeating the arcane lord ends the campaign.

**Priority Target Role:** The bodyguards are hard priority targets in phase 1. In phase 2, the enraged bodyguards become secondary threats to be managed while finishing the lord — neither can be safely ignored.

**Hazard / Telegraph Notes:**
The arcane lord telegraphs its phase-2 activation ("The lord's form crackles — power builds to a breaking point"). Its AoE or multi-target attack is telegraphed on the turn before it fires. Hazard tiles (arcane instability zones that deal damage at end of turn) are appropriate for the sanctum battlefield.

**Campaign Completion:** The arcane lord's defeat triggers the end-of-campaign flow: run summary, Renown calculation, and meta-currency award.

**Future Dependencies:**
- Draconid, arcane construct, and arcane lord data entries.
- Act 4 encounter pool.
- Boss phase-transition system (HP threshold triggers scripted behavior change).
- Side quest branches: courier intercept and planar anchor stabilization nodes (see `CAMPAIGN_ARC.md`).

---

## Cross-Act Dependencies

| System | First needed | Notes |
|---|---|---|
| Monster family registry | Act 1 | Goblins and primal creatures as first entries |
| Telegraph system | Act 2 boss | Log-text fallback acceptable until system lands |
| Reinforcement/activation triggers | Act 3 boss | High priest conditional spawn |
| Boss phase transitions | Act 4 boss | HP-threshold scripted behavior |
| Hazard tiles | Act 3 (optional Act 1) | Can be added per-act as the system matures |
| Side quest branches | Any act | Designed as optional — core act completion never depends on them |

Tests should be added alongside each implementation task as it lands. Act mechanical identities themselves have no runtime implementation and require no automated tests.
