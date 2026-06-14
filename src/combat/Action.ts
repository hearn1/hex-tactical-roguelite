import type { ActionDef, ConditionApply } from "../data/actions.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import { payActionCosts, getTurnEconomy } from "./ActionEconomy.ts";
import { chargesRemaining } from "./ActionBar.ts";
import type { AbilityKey } from "../data/abilities.ts";
import type { UnitInstance, CombatState, ConditionId, ActionUpgradeBonus, ActionResult, ActionElement } from "../state/types.ts";
import { distance, hexKey } from "../core/hex.ts";
import { roll } from "../core/dice.ts";
import { applyCondition } from "./Condition.ts";
import { DIFFICULTY_CONFIG } from "../data/difficulty.ts";
import { LEVELUP_PASSIVE_FIRST_HEAL_BONUS, FIRST_HEAL_BONUS_AMOUNT } from "../data/levelups.ts";
import { resolveOncePerCombatBonus, resolveAttackBonus } from "./ItemHooks.ts";
import { getCritFloor, getVindicatorAttackBonus, getEnchanterAttackPenalty, getCloisteredHealBonus, getBeaconSaveBonus } from "./Passives.ts";
import { heroLifeState, clearDeathSavesOnHealing, isTargetableByEnemies } from "./DeathSaves.ts";
import { checkEnemyThresholdTraits, setTelegraphLastResolvedRound } from "./Traits.ts";
import { resolvePostDamageAftermath } from "./PostDamage.ts";
import type { PostDamageCategory, PostDamageCause } from "./PostDamage.ts";
import { coverArmorBonusForTarget } from "./Terrain.ts";
import { isReactionAvailable, markReactionUsed, trySpendReactionResource } from "./ReactionResolver.ts";

/** Elite "Rally" to-hit bonus granted to survivors when the first elite member falls. */
export const RALLY_TO_HIT_BONUS = 2;
/** How many of the survivor's turns the Rally bonus lasts. */
export const RALLY_DURATION = 2;

const EMPTY_BONUS: ActionUpgradeBonus = {};

/** Map an action id to an element for VFX tinting. Defaults to physical when unknown. */
function actionElement(id: string): ActionElement {
  if (id.includes("fire")) return "fire";
  if (id.includes("frost") || id.includes("ice")) return "frost";
  if (id.includes("arcane") || id.includes("bless") || id.includes("ward") || id.includes("counter")) return "arcane";
  if (id.includes("heal") || id.includes("mend")) return "heal";
  if (id.includes("dark") || id.includes("roar")) return "dark";
  return "physical";
}

/** Per-action level-up bonus for this attacker (F29), or an empty bonus when none applies. */
function actionBonus(attacker: UnitInstance, actionId: string): ActionUpgradeBonus {
  return attacker.actionUpgrades?.[actionId] ?? EMPTY_BONUS;
}

/**
 * Roll a saving throw: d20 + stat modifier vs DC.
 * Returns true if the save succeeds (the effect is negated or resisted).
 */
export function rollSave(unit: UnitInstance, stat: AbilityKey, dc: number, rng: () => number, state?: CombatState): boolean {
  const mod = unit.stats[stat];
  const bonus = (state && getBeaconSaveBonus(unit, state)) ?? 0;
  const d20 = Math.floor(rng() * 20) + 1;
  return (d20 + mod + bonus) >= dc;
}

/** An action's effective range including any level-up range bonus (F29). */
export function effectiveRange(action: ActionDef, attacker: UnitInstance): number {
  return action.range + (actionBonus(attacker, action.id).rangeBonus ?? 0);
}

export function validTargets(
  action: ActionDef,
  attacker: UnitInstance,
  state: CombatState,
): UnitInstance[] {
  const range = effectiveRange(action, attacker);
  const isHeal = action.effect.type === "heal";

  function heroHealable(u: UnitInstance): boolean {
    const ls = heroLifeState(u);
    if (ls === "dead") return false;
    if (ls === "downed" || ls === "stable") return true;
    return u.hp > 0;
  }

  switch (action.targetType) {
    case "self":
      return state.units.filter((u) => u.instanceId === attacker.instanceId && u.hp > 0);

    case "ally":
      return state.units.filter((u) => {
        if (u.team !== attacker.team || u.instanceId === attacker.instanceId) return false;
        if (distance(attacker.pos, u.pos) > range) return false;
        if (isHeal && u.team === "hero") return heroHealable(u);
        if (isHeal) return u.hp > 0 && u.hp < u.stats.maxHp;
        return u.hp > 0 && heroLifeState(u) === "standing";
      });

    case "ally_or_self":
      return state.units.filter((u) => {
        if (u.team !== attacker.team) return false;
        if (distance(attacker.pos, u.pos) > range) return false;
        if (isHeal && u.team === "hero") return heroHealable(u);
        if (isHeal) return u.hp > 0;
        return u.hp > 0 && heroLifeState(u) === "standing";
      });

    case "enemy":
      return state.units.filter((u) => {
        if (u.team === attacker.team) return false;
        if (distance(attacker.pos, u.pos) > range) return false;
        // Enemies targeting heroes: only standing heroes are valid targets.
        if (u.team === "hero") return isTargetableByEnemies(u);
        return u.hp > 0;
      });
  }
}

function rewriteFormula(formula: string, attacker: UnitInstance): string {
  return formula
    .replace("+ str", `+ ${attacker.stats.str}`)
    .replace("+ dex", `+ ${attacker.stats.dex}`)
    .replace("+ con", `+ ${attacker.stats.con}`)
    .replace("+ int", `+ ${attacker.stats.int}`)
    .replace("+ wis", `+ ${attacker.stats.wis}`)
    .replace("+ cha", `+ ${attacker.stats.cha}`)
    .replace("+ level", `+ ${attacker.level}`);
}

export function resolveAction(
  action: ActionDef,
  attacker: UnitInstance,
  target: UnitInstance,
  state: CombatState,
  rng: () => number,
  skipHasActed?: boolean,
  bonusDamage = 0,
): ActionResult {
  const el = actionElement(action.id);
  const round = state.round;

  // Guard: check charge and resource availability before paying any costs.
  if (action.charges !== undefined && action.charges > 0) {
    const used = state.perEncounterUses[action.id] ?? 0;
    if (used >= action.charges) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} tries to use ${action.displayName} but has no remaining charges this encounter.`,
        round,
      });
      return { amount: 0, isCrit: false, kind: "miss", actionElement: el };
    }
  }

  if (action.resourceType === "spell_slot") {
    const cost = action.slotCost ?? 1;
    const remaining = attacker.spellSlotsRemaining ?? 0;
    if (remaining < cost) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} tries to cast ${action.displayName} but has no spell slots remaining.`,
        round,
      });
      return { amount: 0, isCrit: false, kind: "miss", actionElement: el };
    }
  }

  if (action.sorceryPointCost !== undefined && action.sorceryPointCost > 0) {
    const remaining = attacker.sorceryPointsRemaining ?? 0;
    if (remaining < action.sorceryPointCost) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} tries to use ${action.displayName} but has no Sorcery Points remaining.`,
        round,
      });
      return { amount: 0, isCrit: false, kind: "miss", actionElement: el };
    }
  }

  if (action.kiPointCost !== undefined && action.kiPointCost > 0) {
    const remaining = attacker.kiPointsRemaining ?? 0;
    if (remaining < action.kiPointCost) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} tries to use ${action.displayName} but has no Ki points remaining.`,
        round,
      });
      return { amount: 0, isCrit: false, kind: "miss", actionElement: el };
    }
  }

  // Pay all costs (timing economy + charges + spell slots + ki + sorcery) as one atomic step.
  if (!skipHasActed) {
    payActionCosts(attacker, action, state);
  }

  // ── grantExtraAction (Action Surge) ──
  if (action.effect.type === "grantExtraAction") {
    getTurnEconomy(attacker).extraActionsRemaining += 1;
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — gains an extra action this turn!`,
      round,
    });
    return { amount: 0, isCrit: false, kind: "heal", actionElement: "arcane" };
  }

  // ── marker (attack_action_modifier data markers, e.g. Extra Attack) ──
  if (action.effect.type === "marker") {
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} activates ${action.displayName}.`,
      round,
    });
    return { amount: 0, isCrit: false, kind: "heal", actionElement: "physical" };
  }

  // ── removeConditions (Cleanse) ──
  if (action.effect.type === "removeConditions") {
    target.conditions = [];
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — all conditions removed.`,
      round,
    });
    return { amount: 0, isCrit: false, kind: "heal", actionElement: "heal" };
  }

  // ── counterTelegraph (Counterspell) ──
  if (action.effect.type === "counterTelegraph") {
    const range = effectiveRange(action, attacker);
    const telegraphMatches = state.bossTelegraph && state.bossTelegraph.sourceId === target.instanceId;
    if (state.bossTelegraph && telegraphMatches && distance(attacker.pos, target.pos) <= range) {
      const telegraphAction = ACTION_REGISTRY[state.bossTelegraph.actionId];
      const actionName = telegraphAction?.displayName ?? "telegraphed action";
      state.bossTelegraph = null;
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} Counterspells ${target.displayName}'s ${actionName} — the windup fizzles.`,
        round,
      });
      return { amount: 0, isCrit: false, kind: "heal", actionElement: el };
    }
    // No telegraph to counter (or out of range) — fall back to applying the counterspelled condition.
    applyCondition(target, "counterspelled" as ConditionId, 1);
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — no telegraph to counter.`,
      round,
    });
    return { amount: 0, isCrit: false, kind: "damage", actionElement: el };
  }

  // ── lineDamage (Lightning Bolt) ──
  if (action.effect.type === "lineDamage") {
    const lineRange = action.effect.lineRange;
    const affected = state.units.filter(
      (u) => u.team !== attacker.team && u.hp > 0 && distance(attacker.pos, u.pos) <= lineRange,
    );
    const atkStat = action.accuracyStat ?? "str";
    const atkMod = attacker.stats[atkStat];
    const prof = 2 + Math.floor((attacker.level - 1) / 3);
    const d20 = Math.floor(rng() * 20) + 1;
    const isCrit = d20 >= getCritFloor(attacker);
    const isAutoMiss = d20 === 1;
    let totalDmg = 0;
    let hitCount = 0;
    const lineHits: { targetUnitId: string; previousHp: number; damageAmount: number }[] = [];
    for (const u of affected) {
      const hit = !isAutoMiss && (isCrit || (d20 + atkMod + prof) >= u.stats.armor);
      if (hit) {
        const formula = rewriteFormula(action.effect.formula, attacker);
        const result = roll(formula, rng);
        let dmg = result.total;
        if (isCrit) dmg *= 2;
        if (attacker.team === "enemy") {
          const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
          dmg += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0) + (attacker.bonusDamage ?? 0);
        }
        const beforeHp = u.hp;
        u.hp = Math.max(0, u.hp - dmg);
        const dealt = beforeHp - u.hp;
        totalDmg += dealt;
        hitCount++;
        lineHits.push({ targetUnitId: u.instanceId, previousHp: beforeHp, damageAmount: dealt });
      }
    }
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — hits ${hitCount} enemies for ${totalDmg} total damage (d20=${d20}).`,
      round,
    });
    const lineCategory: PostDamageCategory = (atkStat === "int" || atkStat === "wis" || atkStat === "cha") ? "spell" : "weapon";
    let lineShouldCheckCombatEnd = false;
    for (const h of lineHits) {
      const ar = resolvePostDamageAftermath({ state, targetUnitId: h.targetUnitId, sourceUnitId: attacker.instanceId, actionId: action.id, cause: "line", category: lineCategory, previousHp: h.previousHp, damageAmount: h.damageAmount });
      if (ar.shouldCheckCombatEnd) lineShouldCheckCombatEnd = true;
    }
    return { amount: totalDmg, isCrit, kind: "damage", actionElement: el, shouldCheckCombatEnd: lineShouldCheckCombatEnd };
  }

  if (action.effect.type === "applyCondition") {
    // Taunt action: also sets forcedTargetId on the enemy.
    if (action.id === "action.archetype_taunt") {
      const condDuration = action.effect.duration + (actionBonus(attacker, action.id).conditionDurationBonus ?? 0);
      applyCondition(target, "taunted" as ConditionId, condDuration);
      target.forcedTargetId = attacker.instanceId;
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — taunted! ${target.displayName} must target ${attacker.displayName}.`,
        round,
      });
      return { amount: 0, isCrit: false, kind: "damage", actionElement: el };
    }
    if (action.effect.targetMode === "aoe_around_caster") {
      const isFriendly = action.targetType === "ally";
      const affected = state.units.filter(
        (u) => u.hp > 0 && distance(attacker.pos, u.pos) <= action.range &&
          (isFriendly ? u.team === attacker.team : u.team !== attacker.team),
      );
      for (const u of affected) {
        applyCondition(u, action.effect.conditionId as ConditionId, action.effect.duration);
      }
      const condName = action.effect.conditionId;
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — ${condName} applied to ${affected.length} target(s).`,
        round,
      });
      return { amount: 0, isCrit: false, kind: "damage", actionElement: el };
    }
    if (action.effect.targetMode === "aoe_radius") {
      const radius = action.effect.radius ?? action.range;
      const isFriendly = action.targetType === "ally";
      const affected = state.units.filter(
        (u) => u.hp > 0 && distance(attacker.pos, u.pos) <= radius &&
          (isFriendly ? u.team === attacker.team : u.team !== attacker.team),
      );
      for (const u of affected) {
        applyCondition(u, action.effect.conditionId as ConditionId, action.effect.duration);
      }
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — ${action.effect.conditionId} applied to ${affected.length} target(s).`,
        round,
      });
      return { amount: 0, isCrit: false, kind: "damage", actionElement: el };
    }
    const condDuration = action.effect.duration + (actionBonus(attacker, action.id).conditionDurationBonus ?? 0);
    applyCondition(target, action.effect.conditionId as ConditionId, condDuration);
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — ${action.effect.conditionId} applied.`,
      round,
    });
    return { amount: 0, isCrit: false, kind: "damage", actionElement: el };
  }

  if (action.effect.type === "heal") {
    if (action.effect.targetMode === "aoe_radius") {
      const radius = action.effect.radius ?? action.range;
      const affected = state.units.filter((u) => {
        if (u.team !== attacker.team || distance(attacker.pos, u.pos) > radius) return false;
        if (u.team === "hero") {
          const ls = heroLifeState(u);
          return ls !== "dead" && (ls === "downed" || ls === "stable" || (u.hp > 0 && u.hp < u.stats.maxHp));
        }
        return u.hp > 0 && u.hp < u.stats.maxHp;
      });
      if (affected.length === 0) {
        state.log.push({
          kind: "action",
          text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — no injured allies in range.`,
          round,
        });
        return { amount: 0, isCrit: false, kind: "heal", actionElement: "heal" };
      }
      const formula = rewriteFormula(action.effect.formula, attacker);
      let totalHealed = 0;
      for (const u of affected) {
        const result = roll(formula, rng);
        let healAmount = result.total;
        const bIdx = attacker.conditions.findIndex((c) => c.id === "blessed");
        if (bIdx >= 0) {
          healAmount += 2;
          attacker.conditions.splice(bIdx, 1);
        }
        const before = u.hp;
        u.hp = Math.min(Math.max(u.hp, 0) + healAmount, u.stats.maxHp);
        const actual = u.hp - before;
        totalHealed += actual;
        if (actual > 0) clearDeathSavesOnHealing(u, state);
      }
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — heals ${affected.length} allies for ${totalHealed} total.`,
        round,
      });
      return { amount: totalHealed, isCrit: false, kind: "heal", actionElement: "heal" };
    }
    if (action.effect.targetMode === "aoe_around_caster") {
      const affected = state.units.filter((u) => {
        if (u.team !== attacker.team || distance(attacker.pos, u.pos) > action.range) return false;
        if (u.team === "hero") {
          const ls = heroLifeState(u);
          return ls !== "dead" && (ls === "downed" || ls === "stable" || u.hp > 0);
        }
        return u.hp > 0;
      });
      const formula = rewriteFormula(action.effect.formula, attacker);
      let totalHealed = 0;
      for (const u of affected) {
        const result = roll(formula, rng);
        let healAmount = result.total + getCloisteredHealBonus(attacker);
        const bIdx = attacker.conditions.findIndex((c) => c.id === "blessed");
        if (bIdx >= 0) {
          healAmount += 2;
          attacker.conditions.splice(bIdx, 1);
        }
        const before = u.hp;
        u.hp = Math.min(Math.max(u.hp, 0) + healAmount, u.stats.maxHp);
        const actual = u.hp - before;
        totalHealed += actual;
        if (actual > 0) clearDeathSavesOnHealing(u, state);
      }
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — heals ${affected.length} allies for ${totalHealed} total.`,
        round,
      });
      return { amount: totalHealed, isCrit: false, kind: "heal", actionElement: "heal" };
    }

    const blessedIdx = attacker.conditions.findIndex((c) => c.id === "blessed");
    let blessedBonus = 0;
    if (blessedIdx >= 0) {
      blessedBonus = 2;
      attacker.conditions.splice(blessedIdx, 1);
      state.log.push({
        kind: "action",
        text: `[T${round}] Blessed consumed — +2 to heal.`,
        round,
      });
    }

    // Field Prayer passive (F29): first heal each combat restores extra HP.
    let firstHealBonus = 0;
    if ((attacker.passives?.includes(LEVELUP_PASSIVE_FIRST_HEAL_BONUS) ?? false) && !attacker.firstHealDone) {
      firstHealBonus = FIRST_HEAL_BONUS_AMOUNT;
      attacker.firstHealDone = true;
      state.log.push({
        kind: "action",
        text: `[T${round}] Field Prayer — +${FIRST_HEAL_BONUS_AMOUNT} to this heal.`,
        round,
      });
    }

    const formula = rewriteFormula(action.effect.formula, attacker);
    const result = roll(formula, rng);

    // Item hook: once-per-combat first heal bonus (e.g. Lantern Moth Pin).
    const healHookResult = resolveOncePerCombatBonus(attacker, "firstHealDone", state);
    const itemHealBonus = healHookResult.healBonus ?? 0;

    // Cloistered passive: +2 to every heal action.
    const cloisteredBonus = getCloisteredHealBonus(attacker);

    const healed = result.total + blessedBonus + firstHealBonus + (actionBonus(attacker, action.id).healBonus ?? 0) + itemHealBonus + cloisteredBonus;
    const before = target.hp;
    target.hp = Math.min(Math.max(target.hp, 0) + healed, target.stats.maxHp);
    const actual = target.hp - before;
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — heal ${actual}. ${target.displayName}: ${target.hp}/${target.stats.maxHp} HP.`,
      round,
    });
    if (actual > 0) clearDeathSavesOnHealing(target, state);
    return { amount: actual, isCrit: false, kind: "heal", actionElement: "heal" };
  }

  if (action.effect.type === "damage" && action.effect.targetMode === "aoe_around_caster") {
    const affected = state.units.filter(
      (u) => u.team !== attacker.team && u.hp > 0 && distance(attacker.pos, u.pos) <= action.range,
    );
    if (affected.length === 0) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — no enemies in range.`,
        round,
      });
      return { amount: 0, isCrit: false, kind: "damage", actionElement: el };
    }
    const atkStat = action.accuracyStat ?? "str";
    const atkMod = attacker.stats[atkStat];
    const prof = 2 + Math.floor((attacker.level - 1) / 3);
    const d20 = Math.floor(rng() * 20) + 1;
    const isCrit = d20 >= getCritFloor(attacker);
    const isAutoMiss = d20 === 1;
    let totalDmg = 0;
    let hitCount = 0;
    const aoeAroundHits: { targetUnitId: string; previousHp: number; damageAmount: number }[] = [];
    for (const u of affected) {
      const hit = !isAutoMiss && (isCrit || (d20 + atkMod + prof) >= u.stats.armor);
      if (hit) {
        const formula = rewriteFormula(action.effect.formula, attacker);
        const result = roll(formula, rng);
        let dmg = result.total;
        if (isCrit) dmg *= 2;
        if (attacker.team === "enemy") {
          const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
          dmg += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0) + (attacker.bonusDamage ?? 0);
        }
        const beforeHp = u.hp;
        u.hp = Math.max(0, u.hp - dmg);
        const dealt = beforeHp - u.hp;
        totalDmg += dealt;
        hitCount++;
        aoeAroundHits.push({ targetUnitId: u.instanceId, previousHp: beforeHp, damageAmount: dealt });
      }
    }
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — hits ${hitCount} enemies for ${totalDmg} total damage (d20=${d20}).`,
      round,
    });
    const aoeAroundCategory: PostDamageCategory = (atkStat === "int" || atkStat === "wis" || atkStat === "cha") ? "spell" : "weapon";
    let aoeAroundShouldCheckCombatEnd = false;
    for (const h of aoeAroundHits) {
      const ar = resolvePostDamageAftermath({ state, targetUnitId: h.targetUnitId, sourceUnitId: attacker.instanceId, actionId: action.id, cause: "aoe", category: aoeAroundCategory, previousHp: h.previousHp, damageAmount: h.damageAmount });
      if (ar.shouldCheckCombatEnd) aoeAroundShouldCheckCombatEnd = true;
    }
    return { amount: totalDmg, isCrit, kind: "damage", actionElement: el, shouldCheckCombatEnd: aoeAroundShouldCheckCombatEnd };
  }

  if (action.effect.type === "damage" && action.effect.targetMode === "aoe_radius") {
    const radius = action.effect.radius ?? action.range;
    const isFriendly = action.targetType === "ally";
    const affected = state.units.filter(
      (u) => u.hp > 0 && distance(target.pos, u.pos) <= radius &&
        (isFriendly ? u.team === attacker.team : u.team !== attacker.team),
    );
    if (affected.length === 0) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — no targets in radius.`,
        round,
      });
      return { amount: 0, isCrit: false, kind: "damage", actionElement: el };
    }
    const atkStat = action.accuracyStat ?? "str";
    const atkMod = attacker.stats[atkStat];
    const prof = 2 + Math.floor((attacker.level - 1) / 3);
    const d20 = Math.floor(rng() * 20) + 1;
    const isCrit = d20 >= getCritFloor(attacker);
    const isAutoMiss = d20 === 1;
    let totalDmg = 0;
    let hitCount = 0;
    const aoeRadiusHits: { targetUnitId: string; previousHp: number; damageAmount: number }[] = [];
    for (const u of affected) {
      const hit = !isAutoMiss && (isCrit || (d20 + atkMod + prof) >= u.stats.armor);
      if (hit) {
        const formula = rewriteFormula(action.effect.formula, attacker);
        const result = roll(formula, rng);
        let dmg = result.total;
        if (isCrit) dmg *= 2;
        const beforeHp = u.hp;
        u.hp = Math.max(0, u.hp - dmg);
        const dealt = beforeHp - u.hp;
        totalDmg += dealt;
        hitCount++;
        aoeRadiusHits.push({ targetUnitId: u.instanceId, previousHp: beforeHp, damageAmount: dealt });
      }
    }
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — hits ${hitCount} targets for ${totalDmg} total damage (d20=${d20}).`,
      round,
    });
    const aoeRadiusCategory: PostDamageCategory = (atkStat === "int" || atkStat === "wis" || atkStat === "cha") ? "spell" : "weapon";
    let aoeRadiusShouldCheckCombatEnd = false;
    for (const h of aoeRadiusHits) {
      const ar = resolvePostDamageAftermath({ state, targetUnitId: h.targetUnitId, sourceUnitId: attacker.instanceId, actionId: action.id, cause: "aoe", category: aoeRadiusCategory, previousHp: h.previousHp, damageAmount: h.damageAmount });
      if (ar.shouldCheckCombatEnd) aoeRadiusShouldCheckCombatEnd = true;
    }
    return { amount: totalDmg, isCrit, kind: "damage", actionElement: el, shouldCheckCombatEnd: aoeRadiusShouldCheckCombatEnd };
  }

  if (action.effect.type === "damage" && action.effect.targetMode === "primary_plus_adjacent") {
    return resolvePrimaryPlusAdjacent(action, attacker, target, state, rng);
  }

  const attackStat = action.accuracyStat ?? "str";
  const stat = attacker.stats[attackStat];
  const proficiency = 2 + Math.floor((attacker.level - 1) / 3);

  const weakenedIdx = attacker.conditions.findIndex((c) => c.id === "weakened");
  const weakenedPenalty = weakenedIdx >= 0 ? 2 : 0;

  // Rally (elite trait): a persistent to-hit bonus that lasts its duration (not consumed).
  const ralliedIdx = attacker.conditions.findIndex((c) => c.id === "rallied");
  const ralliedBonus = ralliedIdx >= 0 ? RALLY_TO_HIT_BONUS : 0;

  const blessedIdx = attacker.conditions.findIndex((c) => c.id === "blessed");
  let blessedBonus = 0;
  if (blessedIdx >= 0) {
    blessedBonus = 2;
    attacker.conditions.splice(blessedIdx, 1);
    state.log.push({
      kind: "action",
      text: `[T${round}] Blessed consumed — +2 to roll.`,
      round,
    });
  }

  // Enchanter aura: enemies attacking allies (not self) suffer -1 attack.
  const enchanterPenalty = getEnchanterAttackPenalty(attacker, state);

  // Vindicator wounded bonus: +2 attack when below 50% HP.
  const vindicatorBonus = getVindicatorAttackBonus(attacker);

  // Reckless condition: the attacker gets +3 to hit when reckless.
  const recklessAttackBonus = attacker.conditions.some((c) => c.id === "reckless") ? 3 : 0;

  // Rattled condition: attacker suffers -2 to their next attack roll (consumed on use).
  const rattledIdx = attacker.conditions.findIndex((c) => c.id === "rattled");
  const rattledPenalty = rattledIdx >= 0 ? 2 : 0;
  if (rattledIdx >= 0) {
    attacker.conditions.splice(rattledIdx, 1);
  }

  // Sanctuary condition: negate the first attack against the warded target.
  const sanctuaryIdx = target.conditions.findIndex((c) => c.id === "sanctuary");
  if (sanctuaryIdx >= 0) {
    target.conditions.splice(sanctuaryIdx, 1);
    state.log.push({
      kind: "action",
      text: `[T${round}] ${target.displayName}'s Sanctuary wards off ${attacker.displayName}'s attack!`,
      round,
    });
    return { amount: 0, isCrit: false, kind: "miss", actionElement: el };
  }

  const d20 = Math.floor(rng() * 20) + 1;
  const attackTotal = d20 + stat + proficiency - weakenedPenalty + blessedBonus + ralliedBonus - enchanterPenalty + vindicatorBonus + recklessAttackBonus - rattledPenalty;
  const critFloor = getCritFloor(attacker);
  const isCrit = d20 >= critFloor;
  const isAutoMiss = d20 === 1;
  const wardedBonus = target.conditions.some((c) => c.id === "warded") ? 3 : 0;
  const armoredBonus = target.conditions.some((c) => c.id === "armored") ? 3 : 0;
  const recklessDefensePenalty = target.conditions.some((c) => c.id === "reckless") ? 5 : 0;
  const coverBonus = coverArmorBonusForTarget(state, action, attacker, target);
  const effectiveArmor = target.stats.armor + wardedBonus + armoredBonus + recklessDefensePenalty + coverBonus;
  const hit = !isAutoMiss && (isCrit || attackTotal >= effectiveArmor);

  if (!hit) {
    if (isAutoMiss) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=1 → auto-miss.`,
        round,
      });
    } else {
      const armorParts: string[] = [];
      if (wardedBonus > 0) armorParts.push(`+${wardedBonus} warded`);
      if (coverBonus > 0) armorParts.push(`+${coverBonus} cover`);
      const armorDisplay = armorParts.length > 0
        ? `${target.stats.armor} (${armorParts.join(", ")})=${effectiveArmor}`
        : `${target.stats.armor}`;
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} +${stat}+${proficiency}=${attackTotal} vs ${armorDisplay} → miss.`,
        round,
      });
    }
    return { amount: 0, isCrit: false, kind: "miss", actionElement: el };
  }

  const formula = rewriteFormula(action.effect.formula, attacker);
  const result = roll(formula, rng);
  let damage = result.total;
  if (isCrit) damage *= 2;
  if (attacker.team === "enemy") {
    const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
    damage += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0) + (attacker.bonusDamage ?? 0);
  }
  // Opportunist burst (e.g. the ambusher's first strike on an exposed/wounded foe).
  if (bonusDamage > 0) damage += bonusDamage;
  // Level-up action damage upgrade (F29), e.g. Pressing Strike / Ember Focus.
  damage += actionBonus(attacker, action.id).damageBonus ?? 0;

  // Item hook: continuous attack bonus (e.g. Emberglass Wand for spell attacks).
  const itemAttackType = (attackStat === "int" || attackStat === "wis" || attackStat === "cha") ? "spell" : attackStat === "str" ? "melee" : null;
  if (itemAttackType) {
    damage += resolveAttackBonus(attacker, itemAttackType, state);
  }

  // Item hook: once-per-combat first attack bonus (e.g. Runemark Blade for melee).
  const firstAttackTrigger = itemAttackType === "melee" ? "firstMeleeAttack" : itemAttackType === "spell" ? "firstSpellAttack" : null;
  if (firstAttackTrigger) {
    const onceResult = resolveOncePerCombatBonus(attacker, firstAttackTrigger, state);
    if (onceResult.damageBonus) damage += onceResult.damageBonus;
  }

  // Check for Empowered condition: consume it to add +1d6 damage.
  const empoweredIdx = attacker.conditions.findIndex((c) => c.id === "empowered");
  if (empoweredIdx >= 0) {
    const empowermentRoll = roll("1d6", rng);
    damage += empowermentRoll.total;
    attacker.conditions.splice(empoweredIdx, 1);
    state.log.push({
      kind: "action",
      text: `[T${round}] Empowered Spell consumed — +${empowermentRoll.total} bonus damage.`,
      round,
    });
  }

  const guardedIdx = target.conditions.findIndex((c) => c.id === "guarded");
  if (guardedIdx >= 0) {
    const beforeDmg = damage;
    damage = Math.max(1, Math.floor(damage / 2));
    target.conditions.splice(guardedIdx, 1);
    state.log.push({
      kind: "action",
      text: `[T${round}] Guarded consumed — ${beforeDmg} damage reduced to ${damage}.`,
      round,
    });
  }

  // Item hook: once-per-combat first hit taken reduction (e.g. Ward-Stitched Vest).
  const hitReduction = resolveOncePerCombatBonus(target, "firstHitTaken", state);
  if (hitReduction.damageReduction) {
    damage = Math.max(0, damage - hitReduction.damageReduction);
  }

  // Defensive reactions on hit.
  const isSpellAttack = attackStat === "int" || attackStat === "wis" || attackStat === "cha";
  const isRangedAttack = distance(attacker.pos, target.pos) > 1;

  // Uncanny Dodge: halve weapon damage (melee or ranged) once per reaction window.
  if (
    target.team === "hero" &&
    !isSpellAttack &&
    target.passives?.includes("passive.uncanny_dodge") &&
    isReactionAvailable(target)
  ) {
    const before = damage;
    damage = Math.max(0, Math.floor(damage / 2));
    markReactionUsed(target);
    state.log.push({
      kind: "action",
      text: `[T${round}] [REACTION] ${target.displayName}'s Uncanny Dodge halves incoming damage: ${before} → ${damage}.`,
      round,
    });
  }

  // Deflect Missiles: reduce ranged weapon damage by 1d10 + DEX, spending 1 ki point.
  if (
    target.team === "hero" &&
    isRangedAttack &&
    !isSpellAttack &&
    target.passives?.includes("passive.monk.deflect_missiles") &&
    isReactionAvailable(target) &&
    trySpendReactionResource(target, state, "ki_point", 1)
  ) {
    const deflectRoll = roll("1d10", rng);
    const deflectAmt = deflectRoll.total + target.stats.dex;
    const before = damage;
    damage = Math.max(0, damage - deflectAmt);
    markReactionUsed(target);
    state.log.push({
      kind: "action",
      text: `[T${round}] [REACTION] ${target.displayName}'s Deflect Missiles reduces damage by ${deflectAmt} (1d10+DEX): ${before} → ${damage}.`,
      round,
    });
  }

  const beforeHp = target.hp;
  target.hp = Math.max(0, target.hp - damage);
  const dealt = beforeHp - target.hp;

  if (isCrit) {
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} crit! ${dealt} dmg (${damage} before reduction). ${target.displayName}: ${target.hp}/${target.stats.maxHp} HP.`,
      round,
    });
  } else {
    const hitArmorParts: string[] = [];
    if (wardedBonus > 0) hitArmorParts.push(`+${wardedBonus} warded`);
    if (coverBonus > 0) hitArmorParts.push(`+${coverBonus} cover`);
    const hitArmorDisplay = hitArmorParts.length > 0
      ? `${target.stats.armor} (${hitArmorParts.join(", ")})=${effectiveArmor}`
      : `${target.stats.armor}`;
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} +${stat}+${proficiency}=${attackTotal} vs ${hitArmorDisplay} → hit, ${dealt} dmg. ${target.displayName}: ${target.hp}/${target.stats.maxHp} HP.`,
      round,
    });
  }

  // Apply condition with optional save negation.
  if (action.effect.type === "damage" && action.effect.applyCondition) {
    const condApply: ConditionApply = action.effect.applyCondition;
    const saveResisted = condApply.save && rollSave(target, condApply.save.stat, condApply.save.dc, rng, state);
    if (saveResisted) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${target.displayName} saves vs ${condApply.save!.stat} (DC ${condApply.save!.dc}) — condition negated.`,
        round,
      });
    } else {
      const condDuration = condApply.duration + (actionBonus(attacker, action.id).conditionDurationBonus ?? 0);
      applyCondition(target, condApply.id as ConditionId, condDuration);
      state.log.push({
        kind: "action",
        text: `[T${round}] ${action.displayName} hits — ${condApply.id} applied.`,
        round,
      });
    }
  }

  // Vindicator Retributive Strike reaction: when a Vindicator is hit by melee, strike back.
  let retribAftermath: import("./PostDamage.ts").PostDamageResult | null = null;
  if (target.team === "hero" && isReactionAvailable(target) && target.passives?.includes("archetype_passive.vindicator_below_50_attack")) {
    const isMelee = distance(attacker.pos, target.pos) <= 1;
    if (isMelee && attacker.hp > 0) {
      markReactionUsed(target);
      const retribAction = ACTION_REGISTRY["action.archetype_retributive_strike"];
      if (retribAction) {
        const retribFormula = rewriteFormula("1d6 + str", target);
        const retribResult = roll(retribFormula, rng);
        const retribD20 = Math.floor(rng() * 20) + 1;
        const retribTotal = retribD20 + target.stats.str + (2 + Math.floor((target.level - 1) / 3));
        const retribCrit = retribD20 >= getCritFloor(target);
        const retribHit = retribD20 !== 1 && (retribCrit || retribTotal >= attacker.stats.armor);
        if (retribHit) {
          const retribPreviousHp = attacker.hp;
          let retribDmg = retribResult.total;
          if (retribCrit) retribDmg *= 2;
          attacker.hp = Math.max(0, attacker.hp - retribDmg);
          state.log.push({
            kind: "action",
            text: `[T${round}] ${target.displayName}'s Retributive Strike hits ${attacker.displayName} for ${retribDmg} damage!`,
            round,
          });
          retribAftermath = resolvePostDamageAftermath({
            state,
            targetUnitId: attacker.instanceId,
            sourceUnitId: target.instanceId,
            cause: "retaliation",
            category: "weapon",
            previousHp: retribPreviousHp,
          });
        } else {
          state.log.push({
            kind: "action",
            text: `[T${round}] ${target.displayName}'s Retributive Strike misses ${attacker.displayName}.`,
            round,
          });
        }
      }
    }
  }

  // Hellish Rebuke: Fiend Warlock reaction — deal 2d10 + CHA fire damage to the attacker after being hit.
  let hellishRebukeAftermath: import("./PostDamage.ts").PostDamageResult | null = null;
  const hellishRebukeId = "action.warlock.hellish_rebuke";
  if (
    target.team === "hero" &&
    target.archetypeId === "archetype.warlock.fiend" &&
    isReactionAvailable(target) &&
    attacker.hp > 0 &&
    (chargesRemaining(hellishRebukeId, state.perEncounterUses as Record<string, number>) ?? 1) > 0 &&
    trySpendReactionResource(target, state, "spell_slot", 1)
  ) {
    const hellishAction = ACTION_REGISTRY[hellishRebukeId];
    if (hellishAction) {
      markReactionUsed(target);
      const uses = state.perEncounterUses as Record<string, number>;
      uses[hellishRebukeId] = (uses[hellishRebukeId] ?? 0) + 1;
      const hellishFormula = rewriteFormula("2d10 + cha", target);
      const hellishResult = roll(hellishFormula, rng);
      const hellishPrevHp = attacker.hp;
      attacker.hp = Math.max(0, attacker.hp - hellishResult.total);
      state.log.push({
        kind: "action",
        text: `[T${round}] [REACTION] ${target.displayName}'s Hellish Rebuke retaliates for ${hellishResult.total} fire damage!`,
        round,
      });
      hellishRebukeAftermath = resolvePostDamageAftermath({
        state,
        targetUnitId: attacker.instanceId,
        sourceUnitId: target.instanceId,
        actionId: hellishRebukeId,
        cause: "retaliation",
        category: "spell",
        previousHp: hellishPrevHp,
      });
    }
  }

  // Cutting Words: College of Lore Bard reaction — apply rattled to the attacker after they hit.
  if (
    target.team === "hero" &&
    target.archetypeId === "archetype.bard.college_of_lore" &&
    isReactionAvailable(target) &&
    attacker.hp > 0
  ) {
    markReactionUsed(target);
    const rattledCond = attacker.conditions.findIndex((c) => c.id === "rattled");
    if (rattledCond < 0) {
      attacker.conditions.push({ id: "rattled", remainingTurns: 1 });
    }
    state.log.push({
      kind: "action",
      text: `[T${round}] [REACTION] ${target.displayName}'s Cutting Words rattles ${attacker.displayName} (−2 to next attack).`,
      round,
    });
  }

  const category: PostDamageCategory = itemAttackType === "spell" ? "spell" : "weapon";
  const aftermath = resolvePostDamageAftermath({
    state,
    targetUnitId: target.instanceId,
    sourceUnitId: attacker.instanceId,
    actionId: action.id,
    cause: "single_target",
    category,
    previousHp: beforeHp,
  });

  return {
    amount: dealt,
    isCrit,
    kind: "damage",
    actionElement: el,
    shouldCheckCombatEnd: aftermath.shouldCheckCombatEnd || (retribAftermath?.shouldCheckCombatEnd ?? false) || (hellishRebukeAftermath?.shouldCheckCombatEnd ?? false),
    shouldStopCaller: (retribAftermath?.shouldStopCaller ?? false) || (hellishRebukeAftermath?.shouldStopCaller ?? false),
  };
}

function resolvePrimaryPlusAdjacent(
  action: ActionDef,
  attacker: UnitInstance,
  target: UnitInstance,
  state: CombatState,
  rng: () => number,
): ActionResult {
  const round = state.round;
  const el = actionElement(action.id);
  const attackStat = action.accuracyStat ?? "str";
  const stat = attacker.stats[attackStat];
  const proficiency = 2 + Math.floor((attacker.level - 1) / 3);
  const dmgFormula = (action.effect as { formula: string }).formula;
  const category: PostDamageCategory = (attackStat === "int" || attackStat === "wis" || attackStat === "cha") ? "spell" : "weapon";

  const d20 = Math.floor(rng() * 20) + 1;
  const attackTotal = d20 + stat + proficiency;
  const isCrit = d20 === 20;
  const isAutoMiss = d20 === 1;
  const hit = !isAutoMiss && (isCrit || attackTotal >= target.stats.armor);

  // Collect all hits: apply HP mutations for every affected unit first, then call aftermath.
  const hitEntries: { targetUnitId: string; previousHp: number; damageAmount: number; cause: PostDamageCause }[] = [];
  let totalDmg = 0;

  if (hit) {
    const formula = rewriteFormula(dmgFormula, attacker);
    const result = roll(formula, rng);
    let damage = result.total;
    if (isCrit) damage *= 2;
    if (attacker.team === "enemy") {
      const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
      damage += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0) + (attacker.bonusDamage ?? 0);
    }
    const beforeHp = target.hp;
    target.hp = Math.max(0, target.hp - damage);
    const dealt = beforeHp - target.hp;
    totalDmg += dealt;
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} +${stat}+${proficiency}=${attackTotal} vs ${target.stats.armor} → hit, ${dealt} dmg.`,
      round,
    });
    hitEntries.push({ targetUnitId: target.instanceId, previousHp: beforeHp, damageAmount: dealt, cause: "single_target" });
  } else {
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} +${stat}+${proficiency}=${attackTotal} vs ${target.stats.armor} → miss.`,
      round,
    });
  }

  // Splash hits the primary target's team — the attacker's opponents — so hero classes never
  // friendly-fire their own adjacent allies (the original code hardcoded the hero team for the
  // enemy Ground Slam). A melee strike radiates around the attacker ("all nearby foes"); a
  // ranged strike arcs out from the primary target, matching Twin Bolt / Chain Lightning /
  // Swift Quiver, which "arc from the primary target."
  const splashAnchor = distance(attacker.pos, target.pos) <= 1 ? attacker.pos : target.pos;
  const adjacentTargets = state.units.filter(
    (u) => u.team === target.team && u.hp > 0 && u.instanceId !== target.instanceId && distance(splashAnchor, u.pos) === 1,
  );
  for (const splash of adjacentTargets) {
    const d20s = Math.floor(rng() * 20) + 1;
    const attTotal = d20s + stat + proficiency;
    const crit = d20s === 20;
    const autoMiss = d20s === 1;
    const hits = !autoMiss && (crit || attTotal >= splash.stats.armor);
    if (hits) {
      const formula = rewriteFormula(dmgFormula, attacker);
      const res = roll(formula, rng);
      let dmg = res.total;
      if (crit) dmg *= 2;
      if (attacker.team === "enemy") {
        const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
        dmg += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0) + (attacker.bonusDamage ?? 0);
      }
      const before = splash.hp;
      splash.hp = Math.max(0, splash.hp - dmg);
      const dealt = before - splash.hp;
      totalDmg += dealt;
      state.log.push({
        kind: "action",
        text: `[T${round}] ${action.displayName} hits ${splash.displayName} — ${dealt} dmg.`,
        round,
      });
      hitEntries.push({ targetUnitId: splash.instanceId, previousHp: before, damageAmount: dealt, cause: "adjacent" });
    } else {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${action.displayName} misses ${splash.displayName}.`,
        round,
      });
    }
  }

  let shouldCheckCombatEnd = false;
  for (const h of hitEntries) {
    const ar = resolvePostDamageAftermath({ state, targetUnitId: h.targetUnitId, sourceUnitId: attacker.instanceId, actionId: action.id, cause: h.cause, category, previousHp: h.previousHp, damageAmount: h.damageAmount });
    if (ar.shouldCheckCombatEnd) shouldCheckCombatEnd = true;
  }

  return { amount: totalDmg, isCrit, kind: "damage", actionElement: el, shouldCheckCombatEnd };
}


/**
 * Resolves a wound-up boss telegraph (F28 / #59). Every living hero standing on one of the
 * pre-marked target hexes takes the telegraphed action's damage (plus the difficulty bonus,
 * reduced by Guarded) and is Slowed. Heroes who moved clear of the area take nothing. The
 * telegraph is cleared afterward. Damage rolls use the shared seeded stream; the schedule
 * (which hexes, which turn) was fixed when the telegraph was set, so it is RNG-free.
 */
export function resolveBossTelegraph(
  boss: UnitInstance,
  state: CombatState,
  rng: () => number,
): void {
  const telegraph = state.bossTelegraph;
  if (!telegraph) return;
  const round = state.round;
  const action = ACTION_REGISTRY[telegraph.actionId];
  const formulaSource =
    action && action.effect.type === "damage" ? action.effect.formula : "1d8 + str";
  const displayName = action?.displayName ?? "Ground Slam";

  const targetSet = new Set(telegraph.targetHexes);
  const struck = state.units.filter(
    (u) => u.team === "hero" && u.hp > 0 && targetSet.has(hexKey(u.pos)),
  );

  state.log.push({
    kind: "action",
    text: `[T${round}] ${boss.displayName} unleashes ${displayName}!`,
    round,
  });

  if (struck.length === 0) {
    state.log.push({
      kind: "action",
      text: `[T${round}] ${displayName} crashes down — the heroes cleared the area, no one is hit.`,
      round,
    });
    setTelegraphLastResolvedRound(state, boss, "boss_ground_slam_telegraph", round);
    state.bossTelegraph = null;
    return;
  }

  for (const hero of struck) {
    const formula = rewriteFormula(formulaSource, boss);
    let damage = roll(formula, rng).total;
    const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
    damage += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0) + (boss.bonusDamage ?? 0);

    const guardedIdx = hero.conditions.findIndex((c) => c.id === "guarded");
    if (guardedIdx >= 0) {
      const beforeDmg = damage;
      damage = Math.max(1, Math.floor(damage / 2));
      hero.conditions.splice(guardedIdx, 1);
      state.log.push({
        kind: "action",
        text: `[T${round}] Guarded consumed — ${beforeDmg} damage reduced to ${damage}.`,
        round,
      });
    }

    const beforeHp = hero.hp;
    hero.hp = Math.max(0, hero.hp - damage);
    const dealt = beforeHp - hero.hp;
    state.log.push({
      kind: "action",
      text: `[T${round}] ${displayName} hits ${hero.displayName} — ${dealt} dmg. ${hero.displayName}: ${hero.hp}/${hero.stats.maxHp} HP.`,
      round,
    });

    const aftermath = resolvePostDamageAftermath({
      state,
      targetUnitId: hero.instanceId,
      sourceUnitId: boss.instanceId,
      cause: "boss_telegraph",
      category: "weapon",
      previousHp: beforeHp,
      damageAmount: dealt,
    });

    if (aftermath.targetStillValid) {
      applyCondition(hero, "slowed", 1);
      state.log.push({
        kind: "action",
        text: `[T${round}] ${hero.displayName} is Slowed by the impact.`,
        round,
      });
    }
  }

  setTelegraphLastResolvedRound(state, boss, "boss_ground_slam_telegraph", round);
  state.bossTelegraph = null;
}

// Future direct damage sources — call resolvePostDamageAftermath with an appropriate cause:
//   item / potion direct damage  → cause: "item"
//   trait direct damage          → cause: "trait"
// Item-granted actions already route via resolveAction; item hooks must NOT call the helper directly.

export function checkVictoryDefeat(state: CombatState): void {
  const enemiesAlive = state.units.filter((u) => u.team === "enemy" && u.hp > 0);

  if (enemiesAlive.length === 0) {
    state.status = "victory";
    state.bossTelegraph = null;
    state.log.push({ kind: "victory", text: `[T${state.round}] Victory.`, round: state.round });
    return;
  }

  // Defeat when the party has no standing heroes and no downed heroes still rolling saves.
  const standingHeroes = state.units.filter((u) => u.team === "hero" && heroLifeState(u) === "standing");
  const downedHeroes = state.units.filter((u) => u.team === "hero" && heroLifeState(u) === "downed");
  const canStillRecover = standingHeroes.length > 0 || downedHeroes.length > 0;

  if (!canStillRecover) {
    state.status = "defeat";
    state.bossTelegraph = null;
    state.log.push({ kind: "defeat_squad", text: `[T${state.round}] Defeat.`, round: state.round });
  }
}

export function removeDefeatedFromQueue(state: CombatState): void {
  const toRemove = new Set(
    state.units
      .filter((u) => {
        if (u.team === "enemy") return u.hp <= 0;
        return heroLifeState(u) === "dead";
      })
      .map((u) => u.instanceId),
  );
  if (toRemove.size === 0) return;
  if (state.bossTelegraph && toRemove.has(state.bossTelegraph.sourceId)) {
    state.bossTelegraph = null;
  }
  const before = state.activeIndex;
  const activeId = state.turnQueue[state.activeIndex];
  const activeRemoved = toRemove.has(activeId);
  state.turnQueue = state.turnQueue.filter((id) => !toRemove.has(id));
  if (activeRemoved) {
    state.activeIndex = Math.min(before, state.turnQueue.length - 1);
  } else {
    state.activeIndex = state.turnQueue.indexOf(activeId);
  }
}
