# Campaign Targets

> Design contract for act duration and local testing targets.
> This document establishes the targets that act map templates (#161) and encounter pool
> tasks (#162) must aim at. No gameplay implementation is required here.

---

## 1. Run Duration Goals

| Act | Duration Target | Notes |
|-----|----------------|-------|
| Act 1 | 15–25 min | Shorter tutorial act; must be larger than the current single-run prototype |
| Act 2 | 30–45 min | Introduces ogre/skeleton families; single strong boss |
| Act 3 | 40–60 min | Multi-priority encounters; largest act by node count |
| Act 4 | 35–50 min | Campaign climax; shorter than Act 3 but mechanically denser |
| **Full campaign** | **2–3 hours** | Sum across all four acts at target pacing |

These are design targets, not hard limits. Early builds will fall well short while encounter
pools and content are placeholder. The targets exist to size map graphs and node counts
correctly from the start.

---

## 2. Expected Node Count Per Act

Node counts here refer to **resolved nodes** — nodes the player actually completes on a
given path through the act, not total nodes in the graph.

| Act | Min path (nodes resolved) | Expected path | Max path (longest route) |
|-----|--------------------------|---------------|--------------------------|
| Act 1 | 5 | 7 | 10 |
| Act 2 | 7 | 9–10 | 13 |
| Act 3 | 8 | 11–12 | 16 |
| Act 4 | 6 | 9 | 12 |

"Min path" is the shortest viable route: enter act, resolve mandatory encounters, reach boss.
"Expected path" is what a typical player who takes one or two optional nodes resolves.
"Max path" includes a full side route and most optional nodes.

The boss node is always the final resolved node; it is not included in the counts above.

---

## 3. Act 1 Sizing Constraint

Act 1 must be larger than the current single-run prototype (approximately 5 nodes including
boss). The minimum viable path for Act 1 is **5 non-boss nodes + boss**, for a total of 6
resolved nodes minimum. The expected path is 7 resolved nodes.

Act 1 is intentionally smaller than Acts 2–4. It is the tutorial act. Overloading it with
content before the player understands the systems is counterproductive.

---

## 4. Minimum Viable Campaign Path

A minimum viable local test path must be able to exercise:

- At least one combat encounter per act.
- At least one optional node per act (shop, camp, or rest — player's choice).
- At least one act transition (party carry-forward from Act 1 to Act 2).
- The Act 4 boss and campaign completion flow.

The minimum node counts above satisfy this. A local test playthrough on minimum paths takes
roughly **1.5–2 hours** with placeholder encounters.

---

## 5. Placeholder Systems

The following systems are intentionally placeholder for this milestone:

| System | Placeholder Status |
|--------|-------------------|
| Encounter pools (normal) | Hardcoded encounter IDs per act; full pools land in #162 |
| Encounter pools (elite) | One hardcoded elite per act; no per-act pool yet |
| Side routes | Defined as node stubs returning to main path; no runtime side quest logic |
| Event node content | Simple stub choices; full event authoring is later work |
| Shop inventory | Fixed item list per act; weighted pools land in #162 |
| Pacing/balance | No tuning; duration targets reflect future-state not current content |

---

## 6. Relationship to Other Documents

- **`ROADMAP.md`** — M4 and M5 milestones map to the act/node structure defined here.
- **`MAP_AND_NODES.md`** — Node types and map generation phases; node counts here must be
  achievable with the node type mix defined in `ACT_NODE_RULES.md`.
- **`ACT_IDENTITIES.md`** — Per-act mechanical identity and boss shape; duration targets
  must be consistent with the encounter complexity defined there.
- **`ACT_NODE_RULES.md`** — Required/optional node mix and side-route rules that constrain
  how the node counts here are distributed across node types.
