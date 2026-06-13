import type { PartyMember, PendingLevelUp } from "../state/RunState.ts";
import type { RunState } from "../state/RunState.ts";
import type { CampaignState } from "../state/CampaignState.ts";
import type { RunModifier } from "../state/types.ts";
import type { EventChoice, EventEffect, CheckEffect, ChoiceRequirement } from "../data/events.ts";
import { DEFAULT_EVENT_POOL_ID, EVENT_POOLS, EVENT_REGISTRY } from "../data/events.ts";
import { NODE_REGISTRY } from "../data/nodes.ts";
import { POTION_REGISTRY } from "../data/potions.ts";
import { applyXpToPartyMember } from "./Leveling.ts";
import { enqueuePendingLevelUps } from "./LevelUp.ts";
import { resolveCheck, checkModifierFor, formatCheckLog, type CheckResult } from "./AbilityCheck.ts";
import { completeQuest, failQuest, getQuestState } from "./QuestState.ts";
import { applyQuestOutcomeHook } from "./QuestOutcomeApplicator.ts";
import { appendAdventureLog } from "./AdventureLog.ts";

export function restParty(party: PartyMember[]): void {
  for (const pm of party) {
    if (pm.hp <= 0) continue;
    const healAmount = Math.max(1, Math.floor(pm.maxHp * 0.4));
    pm.hp = Math.min(pm.maxHp, pm.hp + healAmount);
  }
}

export function trainPartyMember(pm: PartyMember, xp: number): ReturnType<typeof applyXpToPartyMember> {
  return applyXpToPartyMember(pm, xp);
}

/** Gold spent by the camp "Brew Potion" choice (F30 / #61). A small cost makes it a real tradeoff. */
export const CAMP_BREW_POTION_COST = 10;
/** Potion produced by the camp "Brew Potion" choice. */
export const CAMP_BREW_POTION_ID = "potion.healing";

export interface CampActionResult {
  ok: boolean;
  /** Human-readable log line for the camp outcome (success) or the reason it was blocked. */
  message: string;
}

/**
 * Camp "Brew Potion": spend {@link CAMP_BREW_POTION_COST} gold to add one Healing Potion to the
 * run inventory (F30). Returns `ok: false` with a reason when the party can't afford it; the UI
 * disables the choice ahead of time, so this is the defensive guard. Mirrors the gold bookkeeping
 * used by event effects (both `run.gold` and `run.inventory.gold`).
 */
export function brewPotion(run: RunState): CampActionResult {
  if (run.gold < CAMP_BREW_POTION_COST) {
    return { ok: false, message: `Not enough gold to brew a potion (need ${CAMP_BREW_POTION_COST}).` };
  }
  run.gold -= CAMP_BREW_POTION_COST;
  run.inventory.gold -= CAMP_BREW_POTION_COST;
  run.inventory.potions.push(CAMP_BREW_POTION_ID);
  const name = POTION_REGISTRY[CAMP_BREW_POTION_ID]?.displayName ?? CAMP_BREW_POTION_ID;
  return { ok: true, message: `Brewed a ${name} (spent ${CAMP_BREW_POTION_COST} gold).` };
}

/**
 * Camp "Prepare for Combat": queue a one-fight blessing on `run.runModifiers` (F30). The buff
 * persists across non-combat nodes until the next battle consumes it ({@link createCombatFromRun}),
 * letting the player save it for a chosen fight. Stored in the single {@link RunModifier} union
 * per the L3 constraint — no separate buff type.
 */
export function prepareForCombat(run: RunState): CampActionResult {
  const modifier: RunModifier = { kind: "next_combat_blessing" };
  run.runModifiers.push(modifier);
  return { ok: true, message: describeRunModifier(modifier) };
}

export function applyEventChoiceEffects(choice: EventChoice, run: RunState, rng: () => number): string[] {
  return applyEffectList(choice.effects, run, rng);
}

/** A single human-readable log line describing a run modifier granted by a `buff` effect. */
/** Compute the cumulative event DC bonus from run modifiers. */
export function eventDcBonus(run: Pick<RunState, "runModifiers">): number {
  let bonus = 0;
  for (const mod of run.runModifiers) {
    if (mod.kind === "event_dc_bonus") bonus += mod.value;
  }
  return bonus;
}

/** Compute the cumulative event reward multiplier from run modifiers. */
export function eventRewardMultiplier(run: Pick<RunState, "runModifiers">): number {
  let mult = 1.0;
  for (const mod of run.runModifiers) {
    if (mod.kind === "event_reward_multiplier") mult *= mod.value;
  }
  return mult;
}

/** Apply event_reward_multiplier from run modifiers to a numeric amount. */
export function scaleEventReward(amount: number, run: Pick<RunState, "runModifiers">): number {
  const mult = eventRewardMultiplier(run);
  return mult !== 1.0 ? Math.floor(amount * mult) : amount;
}

export function describeRunModifier(mod: RunModifier): string {
  switch (mod.kind) {
    case "gold_multiplier":
      return `Gold rewards boosted (x${mod.value}) for the run.`;
    case "shop_discount":
      return `Shop prices reduced by ${Math.round(mod.value * 100)}% for the run.`;
    case "global_stat":
      return `Party gains +${mod.value} ${mod.stat} for the run.`;
    case "first_hit_bonus_damage":
      return `Your first hit each battle deals +${mod.amount} damage.`;
    case "next_combat_blessing":
      return `The party is prepared — each hero is Blessed (+2 to their first attack or heal) at the start of the next battle.`;
    case "reward_xp_multiplier":
      return `XP rewards boosted (x${mod.value}) for the run.`;
    case "enemy_hp_multiplier":
      return `Enemy max HP scaled (x${mod.value}) for the run.`;
    case "enemy_damage_bonus":
      return `Enemies deal +${mod.value} damage for the run.`;
    case "event_dc_bonus":
      return `Event check DCs increased by +${mod.value} for the run.`;
    case "event_reward_multiplier":
      return `Numeric event rewards boosted (x${mod.value}) for the run.`;
    case "elite_reward_multiplier":
      return `Elite rewards boosted (x${mod.value}) for the run.`;
  }
  return "A run modifier is active.";
}

/**
 * Grant XP to one hero, returning a log line that notes any level-up. In-range level-ups are
 * pushed onto `out` (when supplied) so the screen flow can route to the choice screen (F29).
 */
function applyXpToHero(pm: PartyMember, amount: number, out?: PendingLevelUp[]): string {
  const result = applyXpToPartyMember(pm, amount);
  if (result.leveledUp && out) {
    enqueuePendingLevelUps(out, pm.instanceId, pm.classId, result.levelsGained);
  }
  return result.leveledUp
    ? `${pm.displayName} gains ${amount} XP and reaches level ${result.newLevel}!`
    : `${pm.displayName} gains ${amount} XP.`;
}

/**
 * Apply a flat list of event effects to run state, returning log messages.
 * Hero-pick effects (`stat_boost`, `check`, and `xp` with `target: "picked_hero"`) are resolved
 * by the screen flow with a chosen hero (see {@link resolveEventChoiceWithHero}), so they are
 * skipped here.
 */
export function applyEffectList(
  effects: EventEffect[],
  run: RunState,
  rng: () => number,
  out?: PendingLevelUp[],
  campaign?: CampaignState,
): string[] {
  const messages: string[] = [];

  const erm = eventRewardMultiplier(run);

  for (const effect of effects) {
    if (effect.type === "gold") {
      const scaled = erm !== 1.0 ? Math.floor(effect.amount * erm) : effect.amount;
      run.gold += scaled;
      run.inventory.gold += scaled;
      messages.push(`Party gains ${scaled} gold${scaled !== effect.amount ? ` (${effect.amount} × ${erm})` : ""}.`);
    } else if (effect.type === "gold_cost") {
      const cost = Math.min(effect.amount, run.gold);
      run.gold -= cost;
      run.inventory.gold -= cost;
      messages.push(`Party spends ${cost} gold.`);
    } else if (effect.type === "item") {
      run.inventory.items.push(effect.itemId);
      messages.push(`Gained ${effect.itemId}.`);
    } else if (effect.type === "heal_party") {
      const pct = erm !== 1.0 ? Math.floor(effect.percent * erm) : effect.percent;
      let healedCount = 0;
      for (const pm of run.party) {
        if (pm.hp <= 0) continue;
        const healAmount = Math.max(1, Math.floor(pm.maxHp * pct / 100));
        pm.hp = Math.min(pm.maxHp, pm.hp + healAmount);
        healedCount++;
      }
      messages.push(`Healed ${healedCount} party members.`);
    } else if (effect.type === "hp_damage") {
      const dmg = erm !== 1.0 ? Math.floor(effect.amount * erm) : effect.amount;
      const living = run.party.filter((p) => p.hp > 0);
      if (living.length > 0 && effect.target === "random_hero") {
        const target = living[Math.floor(rng() * living.length)];
        target.hp = Math.max(1, target.hp - dmg);
        messages.push(`${target.displayName} takes ${dmg} damage (now ${target.hp} HP).`);
      }
    } else if (effect.type === "potion") {
      run.inventory.potions.push(effect.potionId);
      messages.push(`Gained a potion.`);
    } else if (effect.type === "xp") {
      const scaled = erm !== 1.0 ? Math.floor(effect.amount * erm) : effect.amount;
      if (effect.target === "party") {
        for (const pm of run.party) {
          const result = applyXpToPartyMember(pm, scaled);
          if (result.leveledUp && out) {
            enqueuePendingLevelUps(out, pm.instanceId, pm.classId, result.levelsGained);
          }
        }
        messages.push(`Each hero gains ${scaled} XP${scaled !== effect.amount ? ` (${effect.amount} × ${erm})` : ""}.`);
      } else if (effect.target === "random_hero") {
        const living = run.party.filter((p) => p.hp > 0);
        if (living.length > 0) {
          const target = living[Math.floor(rng() * living.length)];
          messages.push(applyXpToHero(target, scaled, out));
        }
      }
      // `picked_hero` is applied by the hero-pick flow, not here.
    } else if (effect.type === "buff") {
      run.runModifiers.push(effect.modifier);
      messages.push(describeRunModifier(effect.modifier));
    } else if (effect.type === "noop") {
      messages.push(`Nothing happens.`);
    } else if (effect.type === "log_entry") {
      appendAdventureLog(run, {
        kind: "quest_outcome",
        text: effect.message,
        sourceKey: `event_log:${effect.message}`,
      });
      messages.push(effect.message);
    } else if (effect.type === "quest_resolve") {
      if (!campaign) {
        console.warn(`quest_resolve effect for "${effect.questId}" skipped: no campaign context`);
      } else {
        const { questId, resolution, outcomeHookId } = effect;
        const state = getQuestState(campaign.questProgress, questId);
        if (state?.status !== "active") {
          console.warn(`quest_resolve: quest "${questId}" is not active (status: ${state?.status ?? "not found"}), skipping`);
        } else {
          const actNumber = campaign.currentActNumber;
          if (resolution === "complete") {
            completeQuest(campaign.questProgress, questId, outcomeHookId, actNumber);
          } else {
            failQuest(campaign.questProgress, questId, actNumber, outcomeHookId);
          }
          const hookResult = applyQuestOutcomeHook(outcomeHookId, campaign);
          if (hookResult.applied) {
            messages.push(`Quest resolved: ${questId} → ${resolution}`);
          }
        }
      }
    }
  }

  return messages;
}

export function applyStatBoost(pm: PartyMember, stat: string, amount: number): string {
  const key = stat as keyof typeof pm.bonusStats;
  pm.bonusStats[key] = (pm.bonusStats[key] ?? 0) + amount;
  return `${pm.displayName} gains +${amount} ${stat}.`;
}

/**
 * Resolve a `check` event effect for a chosen hero: roll the check, log it, then apply the
 * matching outcome branch. A `"partial"` result with no `onPartial` falls back to `onFailure`.
 * Draws exactly one `rng()` (the d20) before any branch effects consume further randomness.
 */
export function resolveCheckEffect(
  effect: CheckEffect,
  pm: PartyMember,
  run: RunState,
  rng: () => number,
  out?: PendingLevelUp[],
  campaign?: CampaignState,
): { result: CheckResult; messages: string[] } {
  const modifier = checkModifierFor(pm, effect.check.stat);
  const dcBonus = eventDcBonus(run);
  const adjustedDc = effect.check.dc + dcBonus;
  const result = resolveCheck(effect.check.stat, modifier, adjustedDc, rng, effect.check.partialWithin);

  const branch =
    result.outcome === "success"
      ? effect.onSuccess
      : result.outcome === "partial"
        ? (effect.onPartial ?? effect.onFailure)
        : effect.onFailure;

  // Branch effects resolve with the attempting hero in scope, so an outcome can grant that
  // hero a permanent stat or XP (e.g. a Spirit check that rewards +1 Spirit on success).
  const messages = [formatCheckLog(pm.displayName, result), ...applyEffectsForHero(branch, pm, run, rng, out, campaign)];
  return { result, messages };
}

/**
 * Apply a list of effects with a chosen hero in scope. Hero-targeted effects resolve against
 * `pm`: `stat_boost` and `xp: picked_hero` hit that hero, and a nested `check` rolls for them.
 * Everything else falls through to {@link applyEffectList}. Shared by check branches and
 * hero-pick choices so the two paths stay consistent.
 */
function applyEffectsForHero(
  effects: EventEffect[],
  pm: PartyMember,
  run: RunState,
  rng: () => number,
  out?: PendingLevelUp[],
  campaign?: CampaignState,
): string[] {
  const messages: string[] = [];
  for (const effect of effects) {
    if (effect.type === "check") {
      messages.push(...resolveCheckEffect(effect, pm, run, rng, out, campaign).messages);
    } else if (effect.type === "stat_boost") {
      messages.push(applyStatBoost(pm, effect.stat, effect.amount));
    } else if (effect.type === "xp" && effect.target === "picked_hero") {
      messages.push(applyXpToHero(pm, effect.amount, out));
    } else {
      messages.push(...applyEffectList([effect], run, rng, out, campaign));
    }
  }
  return messages;
}

export interface RequirementResult {
  ok: boolean;
  /** Human-readable reason shown on a disabled choice when `ok` is false. */
  reason?: string;
}

/**
 * Pure evaluation of a choice's requirements against current run state. Returns the first
 * unmet requirement's reason so the UI can disable the choice and explain why (never hide it).
 */
export function evaluateRequirements(choice: EventChoice, run: RunState): RequirementResult {
  for (const req of choice.requirements ?? []) {
    const result = evaluateRequirement(req, run);
    if (!result.ok) return result;
  }
  return { ok: true };
}

function evaluateRequirement(req: ChoiceRequirement, run: RunState): RequirementResult {
  switch (req.type) {
    case "minGold":
      return run.gold >= req.amount
        ? { ok: true }
        : { ok: false, reason: `Requires ${req.amount} gold.` };
    case "hasItem":
      return run.inventory.items.includes(req.itemId)
        ? { ok: true }
        : { ok: false, reason: `Requires ${req.itemId}.` };
    case "livingHero":
      return run.party.some((p) => p.hp > 0)
        ? { ok: true }
        : { ok: false, reason: `Requires a living hero.` };
    case "partySizeAtLeast":
      return run.party.length >= req.n
        ? { ok: true }
        : { ok: false, reason: `Requires a party of at least ${req.n}.` };
    case "hasFlag":
      return run.eventSelections[req.flagId] === "set"
        ? { ok: true }
        : { ok: false, reason: `Requires a prior quest achievement to be unlocked.` };
  }
}

/** True when any effect in the choice needs the player to pick a hero before resolving. */
export function choiceNeedsHeroPick(choice: EventChoice): boolean {
  return choice.effects.some(
    (e) =>
      e.type === "stat_boost" ||
      e.type === "check" ||
      (e.type === "xp" && e.target === "picked_hero"),
  );
}

export interface EventChoiceResolution {
  messages: string[];
  /** When true the screen must prompt for a hero before the choice can resolve. */
  needsHeroPick: boolean;
}

/**
 * Resolve a choice that needs no hero pick: applies every effect and returns the log lines.
 * Choices containing a hero-pick effect return `needsHeroPick: true` with no state change —
 * the screen then collects a hero and calls {@link resolveEventChoiceWithHero}.
 */
export function resolveEventChoice(
  choice: EventChoice,
  run: RunState,
  rng: () => number,
  out?: PendingLevelUp[],
  campaign?: CampaignState,
): EventChoiceResolution {
  if (choiceNeedsHeroPick(choice)) {
    return { messages: [], needsHeroPick: true };
  }
  return { messages: applyEffectList(choice.effects, run, rng, out, campaign), needsHeroPick: false };
}

/**
 * Resolve a choice for a chosen hero. Hero-pick effects (`stat_boost`, `check`,
 * `xp: picked_hero`) target `pm`; all other effects fall through to {@link applyEffectList}.
 */
export function resolveEventChoiceWithHero(
  choice: EventChoice,
  pm: PartyMember,
  run: RunState,
  rng: () => number,
  out?: PendingLevelUp[],
  campaign?: CampaignState,
): { messages: string[] } {
  return { messages: applyEffectsForHero(choice.effects, pm, run, rng, out, campaign) };
}

/**
 * Deterministically choose (and persist) the event for a node, drawing from the run RNG (L1).
 * Resolution order: a previously stored selection wins (idempotent re-visits), then a node's
 * pinned `eventId`, then a draw from the node's `eventPoolId` (or the default shared pool, L2).
 * Unseen events in the pool are preferred so a run shows variety before repeating.
 */
export function selectEventForNode(run: RunState, nodeId: string, rng: () => number): string {
  const existing = run.eventSelections[nodeId];
  if (existing) return existing;

  const node = NODE_REGISTRY[nodeId];
  if (node?.eventId) {
    run.eventSelections[nodeId] = node.eventId;
    return node.eventId;
  }

  const poolId = node?.eventPoolId ?? DEFAULT_EVENT_POOL_ID;
  const pool = EVENT_POOLS[poolId] ?? EVENT_POOLS[DEFAULT_EVENT_POOL_ID];
  const used = new Set(Object.values(run.eventSelections));
  // No repeats within a run unless an event opts in with `repeatable: true`. Prefer the
  // still-available events; only fall back to the full pool if every entry is exhausted.
  const available = pool.filter((eid) => !used.has(eid) || EVENT_REGISTRY[eid]?.repeatable === true);
  const candidates = available.length > 0 ? available : pool;
  const chosen = candidates[Math.floor(rng() * candidates.length)];
  run.eventSelections[nodeId] = chosen;
  return chosen;
}
