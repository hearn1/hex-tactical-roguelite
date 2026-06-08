import { CLASS_REGISTRY } from "../data/classes.ts";
import type { PartyMember, RunState } from "../state/RunState.ts";

export function isPartyMemberAlive(pm: PartyMember): boolean {
  return !pm.deadForRun;
}

export function canPartyMemberBeHealed(pm: PartyMember): boolean {
  return !pm.deadForRun;
}

export function canPartyMemberRest(pm: PartyMember): boolean {
  return !pm.deadForRun;
}

export function canPartyMemberEnterCombat(pm: PartyMember): boolean {
  return !pm.deadForRun;
}

export const STARTING_CAMP_SUPPLIES = 3;
export const SHORT_RESTS_PER_LONG_REST = 2;

export interface RestHeroResult {
  instanceId: string;
  displayName: string;
  beforeHp: number;
  afterHp: number;
  diceSpent: number;
  rolls: number[];
  totalHealing: number;
  hitDiceRemaining: number;
  hitDiceTotal: number;
}

export interface RestResult {
  ok: boolean;
  message: string;
  heroes: RestHeroResult[];
  campSuppliesSpent?: number;
  hooksRecharged?: boolean;
}

export function classHitDieSize(classId: string): number {
  return CLASS_REGISTRY[classId]?.hitDieSize ?? 6;
}

export function syncHitDiceForPartyMember(pm: PartyMember): void {
  const nextTotal = Math.max(1, pm.level);
  const oldTotal = pm.hitDiceTotal ?? nextTotal;
  const remaining = pm.hitDiceRemaining ?? oldTotal;

  pm.hitDieSize = pm.hitDieSize ?? classHitDieSize(pm.classId);
  pm.hitDiceTotal = nextTotal;
  pm.hitDiceRemaining = Math.min(nextTotal, Math.max(0, remaining + Math.max(0, nextTotal - oldTotal)));
}

export function classSpellSlotsMax(classId: string): number {
  return CLASS_REGISTRY[classId]?.spellSlotsMax ?? 0;
}

/** Initializes a hero's spell-slot pool from their class (#118), preserving any remaining slots. */
export function syncSpellSlotsForPartyMember(pm: PartyMember): void {
  pm.spellSlotsMax = classSpellSlotsMax(pm.classId);
  pm.spellSlotsRemaining = Math.min(pm.spellSlotsMax, pm.spellSlotsRemaining ?? pm.spellSlotsMax);
}

export function ensureRunRestState(run: RunState): void {
  run.campSupplies ??= STARTING_CAMP_SUPPLIES;
  run.shortRestsSinceLongRest ??= 0;
  for (const pm of run.party) {
    syncHitDiceForPartyMember(pm);
    syncSpellSlotsForPartyMember(pm);
  }
}

export function shortRestsRemaining(run: RunState): number {
  ensureRunRestState(run);
  return Math.max(0, SHORT_RESTS_PER_LONG_REST - (run.shortRestsSinceLongRest ?? 0));
}

export function canAnyHeroSpendHitDice(party: PartyMember[]): boolean {
  return party.some((pm) => {
    if (!canPartyMemberRest(pm)) return false;
    syncHitDiceForPartyMember(pm);
    return pm.hp > 0 && pm.hp < pm.maxHp && (pm.hitDiceRemaining ?? 0) > 0;
  });
}

function conModifier(pm: PartyMember): number {
  const withAbilities = pm as PartyMember & {
    conMod?: number;
    constitution?: number;
    abilityScores?: { constitution?: number; con?: number };
  };
  if (typeof withAbilities.conMod === "number") return withAbilities.conMod;
  const score =
    typeof withAbilities.abilityScores?.constitution === "number"
      ? withAbilities.abilityScores.constitution
      : typeof withAbilities.abilityScores?.con === "number"
        ? withAbilities.abilityScores.con
        : typeof withAbilities.constitution === "number"
          ? withAbilities.constitution
          : undefined;
  return typeof score === "number" ? Math.floor((score - 10) / 2) : 0;
}

function rollHitDie(sides: number, rng: () => number): number {
  return Math.floor(rng() * sides) + 1;
}

export function applyShortRest(run: RunState, rng: () => number): RestResult {
  ensureRunRestState(run);
  if ((run.shortRestsSinceLongRest ?? 0) >= SHORT_RESTS_PER_LONG_REST) {
    return { ok: false, message: "No Short Rests remain before the next Long Rest.", heroes: [] };
  }
  if (!canAnyHeroSpendHitDice(run.party)) {
    return { ok: false, message: "No wounded hero has Hit Dice remaining.", heroes: [] };
  }

  const heroes: RestHeroResult[] = [];
  for (const pm of run.party) {
    if (!canPartyMemberRest(pm)) continue;
    syncHitDiceForPartyMember(pm);
    const beforeHp = pm.hp;
    const maxSpend = Math.ceil((pm.hitDiceTotal ?? pm.level) / 2);
    const spendable = Math.min(maxSpend, pm.hitDiceRemaining ?? 0);
    const rolls: number[] = [];
    let totalHealing = 0;

    if (pm.hp > 0 && pm.hp < pm.maxHp) {
      for (let i = 0; i < spendable && pm.hp < pm.maxHp; i++) {
        const roll = rollHitDie(pm.hitDieSize ?? classHitDieSize(pm.classId), rng);
        const healing = Math.max(0, roll + conModifier(pm));
        rolls.push(roll);
        totalHealing += healing;
        pm.hitDiceRemaining = Math.max(0, (pm.hitDiceRemaining ?? 0) - 1);
        pm.hp = Math.min(pm.maxHp, pm.hp + healing);
      }
    }

    if (rolls.length > 0) {
      heroes.push({
        instanceId: pm.instanceId,
        displayName: pm.displayName,
        beforeHp,
        afterHp: pm.hp,
        diceSpent: rolls.length,
        rolls,
        totalHealing,
        hitDiceRemaining: pm.hitDiceRemaining ?? 0,
        hitDiceTotal: pm.hitDiceTotal ?? pm.level,
      });
    }
  }

  if (heroes.length === 0) {
    return { ok: false, message: "No Hit Dice were spent.", heroes: [] };
  }

  run.shortRestsSinceLongRest = (run.shortRestsSinceLongRest ?? 0) + 1;
  const remaining = shortRestsRemaining(run);
  return {
    ok: true,
    message: `Short Rest complete. ${remaining} Short Rest${remaining === 1 ? "" : "s"} remaining before next Long Rest.`,
    heroes,
  };
}

function rechargeOptionalUseHooks(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const obj = target as Record<string, unknown>;
  let changed = false;

  if (obj.perEncounterMaxUses && typeof obj.perEncounterMaxUses === "object") {
    obj.perEncounterUses = { ...(obj.perEncounterMaxUses as Record<string, unknown>) };
    changed = true;
  } else if (obj.perEncounterUses && typeof obj.perEncounterUses === "object") {
    obj.perEncounterUses = {};
    changed = true;
  }

  if (obj.actionCharges && typeof obj.actionCharges === "object") {
    const charges = obj.actionCharges as Record<string, unknown>;
    for (const charge of Object.values(charges)) {
      if (!charge || typeof charge !== "object") continue;
      const c = charge as Record<string, unknown>;
      if (typeof c.max === "number") {
        c.remaining = c.max;
        changed = true;
      } else if (typeof c.maxUses === "number") {
        c.remainingUses = c.maxUses;
        changed = true;
      }
    }
  }

  return changed;
}

export function applyLongRest(run: RunState): RestResult {
  ensureRunRestState(run);
  const livingParty = run.party.filter(canPartyMemberRest);
  const cost = livingParty.length;
  if ((run.campSupplies ?? 0) < cost) {
    return { ok: false, message: `Long Rest requires ${cost} Camp Supplies.`, heroes: [] };
  }

  run.campSupplies = (run.campSupplies ?? 0) - cost;
  run.shortRestsSinceLongRest = 0;

  let hooksRecharged = rechargeOptionalUseHooks(run);
  const heroes: RestHeroResult[] = [];
  for (const pm of livingParty) {
    syncHitDiceForPartyMember(pm);
    const beforeHp = pm.hp;
    pm.hp = pm.maxHp;
    pm.hitDiceRemaining = pm.hitDiceTotal ?? pm.level;
    pm.spellSlotsMax = classSpellSlotsMax(pm.classId);
    pm.spellSlotsRemaining = pm.spellSlotsMax;
    hooksRecharged = rechargeOptionalUseHooks(pm) || hooksRecharged;
    heroes.push({
      instanceId: pm.instanceId,
      displayName: pm.displayName,
      beforeHp,
      afterHp: pm.hp,
      diceSpent: 0,
      rolls: [],
      totalHealing: Math.max(0, pm.hp - beforeHp),
      hitDiceRemaining: pm.hitDiceRemaining,
      hitDiceTotal: pm.hitDiceTotal ?? pm.level,
    });
  }

  return {
    ok: true,
    message: `Long Rest complete. Spent ${cost} Camp Supplies.`,
    heroes,
    campSuppliesSpent: cost,
    hooksRecharged,
  };
}
