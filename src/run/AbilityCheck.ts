import type { CheckStat } from "../state/types.ts";
import type { PartyMember } from "../state/RunState.ts";
import { CLASS_REGISTRY } from "../data/classes.ts";

export type CheckOutcome = "success" | "failure" | "partial";

export interface CheckResult {
  /** Raw d20 face (1..20). */
  roll: number;
  stat: CheckStat;
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
  stat: CheckStat,
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
 * Effective check modifier for a party member out of combat:
 * `classDef.baseStats[stat] + (pm.bonusStats[stat] ?? 0)`.
 * Leaves a seam for future flat bonus sources (e.g. F22 backgrounds) without wiring them here.
 */
export function checkModifierFor(pm: PartyMember, stat: CheckStat): number {
  const classDef = CLASS_REGISTRY[pm.classId];
  const base = classDef ? classDef.baseStats[stat] : 0;
  return base + (pm.bonusStats[stat] ?? 0);
}

/** The d20 face a hero must roll to succeed (`dc - modifier`). May be <=1 (auto) or >20 (impossible). */
export function rollNeeded(modifier: number, dc: number): number {
  return dc - modifier;
}

/** Living hero with the highest modifier for `stat`, or null if all are down. */
export function pickBestHero(party: PartyMember[], stat: CheckStat): PartyMember | null {
  const living = party.filter((p) => p.hp > 0);
  if (living.length === 0) return null;
  return living.reduce((best, pm) =>
    checkModifierFor(pm, stat) > checkModifierFor(best, stat) ? pm : best,
  );
}

/** One readable log line reporting roll, modifier, total, DC, and outcome. */
export function formatCheckLog(heroName: string, r: CheckResult): string {
  const mod = r.modifier >= 0 ? `+${r.modifier}` : `${r.modifier}`;
  const statName = r.stat.charAt(0).toUpperCase() + r.stat.slice(1);
  return `${heroName}'s ${statName} check: d20 ${r.roll} ${mod} = ${r.total} vs DC ${r.dc} — ${OUTCOME_LABEL[r.outcome]}.`;
}
