import type { AbilityKey } from "../data/abilities.ts";
import { ABILITY_FULL_LABELS, DEFAULT_ABILITY_SCORES, abilityMod } from "../data/abilities.ts";
import type { PartyMember } from "../state/RunState.ts";

export type CheckOutcome = "success" | "failure" | "partial";

export interface CheckResult {
  /** Raw d20 face (1..20). */
  roll: number;
  stat: AbilityKey;
  /** Effective stat modifier used for the roll. */
  modifier: number;
  /** roll + modifier. */
  total: number;
  dc: number;
  outcome: CheckOutcome;
  /** total - dc. Negative on a miss; a near-miss inside `partialWithin` reads as partial. */
  margin: number;
}

const OUTCOME_LABEL: Record<CheckOutcome, string> = {
  success: "Success",
  failure: "Failure",
  partial: "Partial success",
};

/**
 * Resolve a `d20 + modifier >= dc` ability check. Pure and deterministic: draws exactly
 * one `rng()` for the d20 so seeded sequences stay reproducible (L1: shared run RNG).
 *
 * When `partialWithin` is set, a miss whose margin is within that band
 * (`-partialWithin <= margin < 0`) reports as `"partial"` instead of `"failure"`.
 */
export function resolveCheck(
  stat: AbilityKey,
  modifier: number,
  dc: number,
  rng: () => number,
  partialWithin?: number,
): CheckResult {
  const roll = Math.floor(rng() * 20) + 1;
  const total = roll + modifier;
  const margin = total - dc;

  let outcome: CheckOutcome;
  if (margin >= 0) {
    outcome = "success";
  } else if (partialWithin !== undefined && margin >= -partialWithin) {
    outcome = "partial";
  } else {
    outcome = "failure";
  }

  return { roll, stat, modifier, total, dc, outcome, margin };
}

/**
 * Effective check modifier for a party member out of combat: derived from
 * `pm.abilityScores[stat]` using the standard 5E formula (floor((score-10)/2)).
 * Falls back to all-10 defaults for any party member without stored ability scores.
 */
export function checkModifierFor(pm: PartyMember, stat: AbilityKey): number {
  const score = pm.abilityScores?.[stat] ?? DEFAULT_ABILITY_SCORES[stat];
  return abilityMod(score);
}

/** The d20 face a hero must roll to succeed (`dc - modifier`). May be <=1 (auto) or >20 (impossible). */
export function rollNeeded(modifier: number, dc: number): number {
  return dc - modifier;
}

/** Living hero with the highest modifier for `stat`, or null if all are down. */
export function pickBestHero(party: PartyMember[], stat: AbilityKey): PartyMember | null {
  const living = party.filter((p) => p.hp > 0);
  if (living.length === 0) return null;
  return living.reduce((best, pm) =>
    checkModifierFor(pm, stat) > checkModifierFor(best, stat) ? pm : best,
  );
}

/** One readable log line reporting roll, modifier, total, DC, and outcome. */
export function formatCheckLog(heroName: string, r: CheckResult): string {
  const mod = r.modifier >= 0 ? `+${r.modifier}` : `${r.modifier}`;
  const statName = ABILITY_FULL_LABELS[r.stat];
  return `${heroName}'s ${statName} check: d20 ${r.roll} ${mod} = ${r.total} vs DC ${r.dc} — ${OUTCOME_LABEL[r.outcome]}.`;
}
