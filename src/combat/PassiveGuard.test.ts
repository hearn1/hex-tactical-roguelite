/**
 * #548 — PassiveEffect exhaustiveness guard.
 *
 * Every PassiveEffect type string that appears in PASSIVE_REGISTRY must be
 * explicitly declared as either:
 *   HANDLED  — has a live runtime hook in combat/rest code, OR
 *   FLAVOR_ONLY — downgraded to honest flavor text, no runtime hook expected.
 *
 * If you add a new PassiveEffect variant and forget to wire it up, this test
 * will fail and tell you which type is uncategorised.
 */
import { describe, it, expect } from "vitest";
import { PASSIVE_REGISTRY } from "../data/passives.ts";

/**
 * Types with an active runtime hook (combat, rest, or run-setup code reads them).
 * Add a type here only when the hook exists and is tested.
 */
const HANDLED = new Set<string>([
  // Pre-epic handlers (Passives.ts functions called by Action.ts / EnemyAI / etc.)
  "armorBonus",           // computeConditionalArmor
  "critRangeExpansion",   // getCritFloor
  "damageBonus",          // getVindicatorAttackBonus
  "healBonus",            // getCloisteredHealBonus
  "attackPenaltyAura",    // getEnchanterAttackPenalty
  "saveAura",             // getBeaconSaveBonus
  "halfDamageOnHit",      // Action.ts — uncanny dodge reaction
  "deflectMissiles",      // ReactionFramework — deflect missiles reaction

  // Resource pool bonuses applied at rest / run setup (Rest.ts)
  "spellSlotBonus",
  "sorceryPointBonus",
  "kiPointBonus",

  // Epic #530 additions
  "actionChargeBonus",    // #536 — computeActionChargeBonuses + ActionEconomy
  "fastMovement",         // #537 — computeStats move bonus
  "brutalCritical",       // #538 — getBrutalCriticalExtraDamage + Action.ts
  "colossusSlayer",       // #538 — getColossusSlayerBonus + Action.ts
  "firstAttackBonusDice", // #538 — getFirstAttackBonusDice + Action.ts
  "naturalRecovery",      // #539 — syncPartyFromCombat spell-slot restore
  "onKillTempHp",         // #541 — getOnKillHpGain + PostDamage.ts
  "resistance",           // #542 — hasAllResistanceWhileRaged + Action.ts
  "auraOfProtection",     // #543 — getBeaconSaveBonus
  "draconicResilience",   // #544 — computeStats armor bonus
  "elementalAffinity",    // #544 — getSpellDamageStatBonus + Action.ts
  "empoweredEvocation",   // #546 — getSpellDamageStatBonus + Action.ts
  "dreadAmbusher",        // #547 — buildTurnQueue initiative bonus
]);

/**
 * Types with no runtime hook — the description is explicit flavor text and
 * no mechanical effect is expected until the listed system is implemented.
 * The passive is still tracked (passives[] on unit) for future use.
 */
const FLAVOR_ONLY = new Set<string>([
  "extraAttack",            // action bar surfaces Extra Attack action
  "evasion",                // AoE save-negation system pending
  "climbCostReduction",     // climb-cost system pending
  "superiorityDice",        // maneuver system pending
  "statCheckBonus",         // out-of-combat check bonus pending
  "bonusAttackAfterCantrip",// post-cantrip bonus attack pending
  "arcaneRecovery",         // in-combat slot recovery pending
  "sculptSpells",           // AoE ally-exclusion pending
  "arcaneWardRegain",       // ward HP recovery pending
  "wildShapeGrant",         // beast-form system pending
  "wildShapeBonus",         // beast-form system pending
  "jackOfAllTrades",        // out-of-combat check bonus pending
  "fontOfInspiration",      // Bardic Inspiration is an unlimited cantrip action
  "combatInspiration",      // damage-rider system pending
  "forceReroll",            // attack-reroll system pending
  "repellingBlast",         // forced-movement system pending
  "pactBlade",              // stat-substitution system pending
  "pactTome",               // additional cantrips granted at character creation
  "relentlessAvenger",      // conditional movement bonus pending
  "dangerSense",            // DEX save advantage pending
  "frenziedAttack",         // rage-conditional bonus-attack pending
  "empoweredSpell",         // Sorcery Point dice-reroll pending
  "quickenedSpell",         // Sorcery Point action-conversion pending
  "heightenedSpell",        // Sorcery Point save-disadvantage pending
  "wildMagicSurge",         // post-cast surge table pending
  "slowFall",               // fall-damage reduction pending
  "patientDefense",         // Ki dodge system pending
  "openHandTechnique",      // post-Flurry push/prone pending
  "wholenessOfBody",        // Ki self-healing pending
  "shadowArts",             // Ki darkness/silence pending
  "secondWind",             // action bar surfaces Second Wind action
  "actionSurge",            // action bar surfaces Action Surge action
  "indomitable",            // save-reroll system pending
  "divineHealth",           // disease immunity / poison resistance pending
  "stillnessOfMind",        // condition-cleanse system pending
  "improvedSneakAttack",    // conditional sneak dice system pending
]);

describe("#548 PassiveEffect exhaustiveness guard", () => {
  it("every PassiveEffect type in PASSIVE_REGISTRY is either HANDLED or FLAVOR_ONLY", () => {
    const allTypes = new Set<string>();
    for (const def of Object.values(PASSIVE_REGISTRY)) {
      allTypes.add(def.effect.type);
    }

    const uncategorised: string[] = [];
    for (const type of allTypes) {
      if (!HANDLED.has(type) && !FLAVOR_ONLY.has(type)) {
        uncategorised.push(type);
      }
    }

    expect(
      uncategorised,
      `These PassiveEffect types have no runtime hook AND are not on the FLAVOR_ONLY allowlist:\n${uncategorised.map((t) => `  • ${t}`).join("\n")}\nAdd the type to HANDLED (with a working runtime hook) or FLAVOR_ONLY (flavor-text only, no hook expected).`,
    ).toHaveLength(0);
  });

  it("HANDLED set contains no types absent from PASSIVE_REGISTRY (no phantom entries)", () => {
    const allTypes = new Set<string>();
    for (const def of Object.values(PASSIVE_REGISTRY)) {
      allTypes.add(def.effect.type);
    }

    const phantoms = [...HANDLED].filter((t) => !allTypes.has(t));
    expect(
      phantoms,
      `HANDLED lists these types that do not appear in PASSIVE_REGISTRY:\n${phantoms.map((t) => `  • ${t}`).join("\n")}\nRemove stale entries from HANDLED.`,
    ).toHaveLength(0);
  });

  it("FLAVOR_ONLY set contains no types absent from PASSIVE_REGISTRY (no phantom entries)", () => {
    const allTypes = new Set<string>();
    for (const def of Object.values(PASSIVE_REGISTRY)) {
      allTypes.add(def.effect.type);
    }

    const phantoms = [...FLAVOR_ONLY].filter((t) => !allTypes.has(t));
    expect(
      phantoms,
      `FLAVOR_ONLY lists these types that do not appear in PASSIVE_REGISTRY:\n${phantoms.map((t) => `  • ${t}`).join("\n")}\nRemove stale entries from FLAVOR_ONLY.`,
    ).toHaveLength(0);
  });
});
