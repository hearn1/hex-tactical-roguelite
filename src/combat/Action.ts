import type { ActionDef, ConditionApply } from "../data/actions.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import type { AbilityKey } from "../data/abilities.ts";
import type { UnitInstance, CombatState, ConditionId, ActionUpgradeBonus, ActionResult, ActionElement } from "../state/types.ts";
import { distance, hexKey } from "../core/hex.ts";
import { roll } from "../core/dice.ts";
import { applyCondition } from "./Condition.ts";
import { DIFFICULTY_CONFIG } from "../data/difficulty.ts";
import { LEVELUP_PASSIVE_FIRST_HEAL_BONUS, FIRST_HEAL_BONUS_AMOUNT } from "../data/levelups.ts";
import { resolveOncePerCombatBonus, resolveAttackBonus } from "./ItemHooks.ts";
import { getCritFloor, getVindicatorAttackBonus, getEnchanterAttackPenalty, getCloisteredHealBonus, getBeaconSaveBonus } from "./Passives.ts";
import { heroLifeState, handleUnitDroppedToZero, clearDeathSavesOnHealing, isTargetableByEnemies } from "./DeathSaves.ts";
import { checkEnemyThresholdTraits } from "./Traits.ts";
import { resolvePostDamageAftermath } from "./PostDamage.ts";
import type { PostDamageCategory } from "./PostDamage.ts";
import { coverArmorBonusForTarget } from "./Terrain.ts";

/** Elite "Rally" to-hit bonus granted to survivors when the first elite member falls. */
export const RALLY_TO_HIT_BONUS = 2;
/** How many of the survivor's turns the Rally bonus lasts. */
export const RALLY_DURATION = 2;

const EMPTY_BONUS: ActionUpgradeBonus = {};

/** Map an action id to an element for VFX tinting. Defaults to physical when unknown. */
function actionElement(id: string): ActionElement {
  if (id.includes("fire")) return "fire";
  if (id.includes("frost") || id.includes("ice")) return "frost";
  if (id.includes("arcane") || id.includes("bless") || id.includes("ward")) return "arcane";
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

  // Consume per-encounter charge if the action has a charge limit.
  if (action.charges !== undefined && action.charges > 0) {
    const used = state.perEncounterUses[action.id] ?? 0;
    if (used >= action.charges) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} tries to use ${action.displayName} but has no remaining charges this encounter.`,
        round,
      });
      if (!skipHasActed) attacker.hasActed = true;
      return { amount: 0, isCrit: false, kind: "miss", actionElement: el };
    }
    state.perEncounterUses[action.id] = used + 1;
  }

  // Consume a spell slot if the action requires one (#118). Cantrips and martial actions are free.
  if (action.resourceType === "spell_slot") {
    const cost = action.slotCost ?? 1;
    const remaining = attacker.spellSlotsRemaining ?? 0;
    if (remaining < cost) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} tries to cast ${action.displayName} but has no spell slots remaining.`,
        round,
      });
      if (!skipHasActed) attacker.hasActed = true;
      return { amount: 0, isCrit: false, kind: "miss", actionElement: el };
    }
    attacker.spellSlotsRemaining = remaining - cost;
  }

  // ── removeConditions (Cleanse) ──
  if (action.effect.type === "removeConditions") {
    target.conditions = [];
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — all conditions removed.`,
      round,
    });
    attacker.hasActed = true;
    return { amount: 0, isCrit: false, kind: "heal", actionElement: "heal" };
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
    for (const u of affected) {
      const hit = !isAutoMiss && (isCrit || (d20 + atkMod + prof) >= u.stats.armor);
      if (hit) {
        const formula = rewriteFormula(action.effect.formula, attacker);
        const result = roll(formula, rng);
        let dmg = result.total;
        if (isCrit) dmg *= 2;
        if (attacker.team === "enemy") {
          const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
          dmg += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0);
        }
        const beforeHp = u.hp;
        u.hp = Math.max(0, u.hp - dmg);
        totalDmg += beforeHp - u.hp;
        hitCount++;
        if (u.hp <= 0) {
          handleUnitDroppedToZero(u, state);
        }
      }
    }
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — hits ${hitCount} enemies for ${totalDmg} total damage (d20=${d20}).`,
      round,
    });
    attacker.hasActed = true;
    return { amount: totalDmg, isCrit, kind: "damage", actionElement: el };
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
      if (!skipHasActed) attacker.hasActed = true;
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
      if (!skipHasActed) attacker.hasActed = true;
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
      if (!skipHasActed) attacker.hasActed = true;
      return { amount: 0, isCrit: false, kind: "damage", actionElement: el };
    }
    const condDuration = action.effect.duration + (actionBonus(attacker, action.id).conditionDurationBonus ?? 0);
    applyCondition(target, action.effect.conditionId as ConditionId, condDuration);
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — ${action.effect.conditionId} applied.`,
      round,
    });
    if (!skipHasActed) attacker.hasActed = true;
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
        if (!skipHasActed) attacker.hasActed = true;
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
      if (!skipHasActed) attacker.hasActed = true;
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
      if (!skipHasActed) attacker.hasActed = true;
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
    if (!skipHasActed) attacker.hasActed = true;
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
      if (!skipHasActed) attacker.hasActed = true;
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
    for (const u of affected) {
      const hit = !isAutoMiss && (isCrit || (d20 + atkMod + prof) >= u.stats.armor);
      if (hit) {
        const formula = rewriteFormula(action.effect.formula, attacker);
        const result = roll(formula, rng);
        let dmg = result.total;
        if (isCrit) dmg *= 2;
        if (attacker.team === "enemy") {
          const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
          dmg += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0);
        }
        const beforeHp = u.hp;
        u.hp = Math.max(0, u.hp - dmg);
        totalDmg += beforeHp - u.hp;
        hitCount++;
        if (u.hp <= 0) {
          handleUnitDroppedToZero(u, state);
        }
      }
    }
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — hits ${hitCount} enemies for ${totalDmg} total damage (d20=${d20}).`,
      round,
    });
    if (!skipHasActed) attacker.hasActed = true;
    return { amount: totalDmg, isCrit, kind: "damage", actionElement: el };
  }

  if (action.effect.type === "damage" && action.effect.targetMode === "aoe_radius") {
    const radius = action.effect.radius ?? action.range;
    const isFriendly = action.targetType === "ally";
    const affected = state.units.filter(
      (u) => u.hp > 0 && distance(attacker.pos, u.pos) <= radius &&
        (isFriendly ? u.team === attacker.team : u.team !== attacker.team),
    );
    if (affected.length === 0) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — no targets in radius.`,
        round,
      });
      if (!skipHasActed) attacker.hasActed = true;
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
    for (const u of affected) {
      const hit = !isAutoMiss && (isCrit || (d20 + atkMod + prof) >= u.stats.armor);
      if (hit) {
        const formula = rewriteFormula(action.effect.formula, attacker);
        const result = roll(formula, rng);
        let dmg = result.total;
        if (isCrit) dmg *= 2;
        const beforeHp = u.hp;
        u.hp = Math.max(0, u.hp - dmg);
        totalDmg += beforeHp - u.hp;
        hitCount++;
        if (u.hp <= 0) {
          handleUnitDroppedToZero(u, state);
        }
      }
    }
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — hits ${hitCount} targets for ${totalDmg} total damage (d20=${d20}).`,
      round,
    });
    if (!skipHasActed) attacker.hasActed = true;
    return { amount: totalDmg, isCrit, kind: "damage", actionElement: el };
  }

  if (action.effect.type === "damage" && action.effect.targetMode === "primary_plus_adjacent") {
    resolvePrimaryPlusAdjacent(action, attacker, target, state, rng, skipHasActed);
    return { amount: 0, isCrit: false, kind: "damage", actionElement: el };
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

  // Sanctuary condition: negate the first attack against the warded target.
  const sanctuaryIdx = target.conditions.findIndex((c) => c.id === "sanctuary");
  if (sanctuaryIdx >= 0) {
    target.conditions.splice(sanctuaryIdx, 1);
    state.log.push({
      kind: "action",
      text: `[T${round}] ${target.displayName}'s Sanctuary wards off ${attacker.displayName}'s attack!`,
      round,
    });
    if (!skipHasActed) attacker.hasActed = true;
    return { amount: 0, isCrit: false, kind: "miss", actionElement: el };
  }

  const d20 = Math.floor(rng() * 20) + 1;
  const attackTotal = d20 + stat + proficiency - weakenedPenalty + blessedBonus + ralliedBonus - enchanterPenalty + vindicatorBonus + recklessAttackBonus;
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
    if (!skipHasActed) attacker.hasActed = true;
    return { amount: 0, isCrit: false, kind: "miss", actionElement: el };
  }

  const formula = rewriteFormula(action.effect.formula, attacker);
  const result = roll(formula, rng);
  let damage = result.total;
  if (isCrit) damage *= 2;
  if (attacker.team === "enemy") {
    const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
    damage += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0);
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
  if (target.team === "hero" && !target.reactionUsedThisTurn && target.passives?.includes("archetype_passive.vindicator_below_50_attack")) {
    const isMelee = distance(attacker.pos, target.pos) <= 1;
    if (isMelee && attacker.hp > 0) {
      target.reactionUsedThisTurn = true;
      const retribAction = ACTION_REGISTRY["action.archetype_retributive_strike"];
      if (retribAction) {
        const retribFormula = rewriteFormula("1d6 + str", target);
        const retribResult = roll(retribFormula, rng);
        const retribD20 = Math.floor(rng() * 20) + 1;
        const retribTotal = retribD20 + target.stats.str + (2 + Math.floor((target.level - 1) / 3));
        const retribCrit = retribD20 >= getCritFloor(target);
        const retribHit = retribD20 !== 1 && (retribCrit || retribTotal >= attacker.stats.armor);
        if (retribHit) {
          let retribDmg = retribResult.total;
          if (retribCrit) retribDmg *= 2;
          attacker.hp = Math.max(0, attacker.hp - retribDmg);
          state.log.push({
            kind: "action",
            text: `[T${round}] ${target.displayName}'s Retributive Strike hits ${attacker.displayName} for ${retribDmg} damage!`,
            round,
          });
          if (attacker.hp <= 0) {
            handleUnitDroppedToZero(attacker, state);
          }
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

  if (!skipHasActed) attacker.hasActed = true;
  return { amount: dealt, isCrit, kind: "damage", actionElement: el, shouldCheckCombatEnd: aftermath.shouldCheckCombatEnd };
}

function resolvePrimaryPlusAdjacent(
  action: ActionDef,
  attacker: UnitInstance,
  target: UnitInstance,
  state: CombatState,
  rng: () => number,
  skipHasActed?: boolean,
): void {
  const round = state.round;
  const attackStat = action.accuracyStat ?? "str";
  const stat = attacker.stats[attackStat];
  const proficiency = 2 + Math.floor((attacker.level - 1) / 3);
  const dmgFormula = (action.effect as { formula: string }).formula;

  const d20 = Math.floor(rng() * 20) + 1;
  const attackTotal = d20 + stat + proficiency;
  const isCrit = d20 === 20;
  const isAutoMiss = d20 === 1;
  const hit = !isAutoMiss && (isCrit || attackTotal >= target.stats.armor);

  if (hit) {
    const formula = rewriteFormula(dmgFormula, attacker);
    const result = roll(formula, rng);
    let damage = result.total;
    if (isCrit) damage *= 2;
    if (attacker.team === "enemy") {
      const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
      damage += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0);
    }
    const beforeHp = target.hp;
    target.hp = Math.max(0, target.hp - damage);
    const dealt = beforeHp - target.hp;
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} +${stat}+${proficiency}=${attackTotal} vs ${target.stats.armor} → hit, ${dealt} dmg.`,
      round,
    });
    if (target.hp <= 0) {
      handleUnitDroppedToZero(target, state);
    }
  } else {
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} +${stat}+${proficiency}=${attackTotal} vs ${target.stats.armor} → miss.`,
      round,
    });
  }

  const adjacentHeroes = state.units.filter(
    (u) => u.team === "hero" && u.hp > 0 && u.instanceId !== target.instanceId && distance(attacker.pos, u.pos) === 1,
  );
  for (const hero of adjacentHeroes) {
    const d20s = Math.floor(rng() * 20) + 1;
    const attTotal = d20s + stat + proficiency;
    const crit = d20s === 20;
    const autoMiss = d20s === 1;
    const hits = !autoMiss && (crit || attTotal >= hero.stats.armor);
    if (hits) {
      const formula = rewriteFormula(dmgFormula, attacker);
      const res = roll(formula, rng);
      let dmg = res.total;
      if (crit) dmg *= 2;
      if (attacker.team === "enemy") {
        const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
        dmg += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0);
      }
      const before = hero.hp;
      hero.hp = Math.max(0, hero.hp - dmg);
      const dealt = before - hero.hp;
      state.log.push({
        kind: "action",
        text: `[T${round}] Ground Slam hits ${hero.displayName} — ${dealt} dmg.`,
        round,
      });
      if (hero.hp <= 0) {
        if (hero.hp <= 0) {
          handleUnitDroppedToZero(hero, state);
        }
      }
    } else {
      state.log.push({
        kind: "action",
        text: `[T${round}] Ground Slam misses ${hero.displayName}.`,
        round,
      });
    }
  }

  checkEnemyThresholdTraits(target, state);
  if (!skipHasActed) attacker.hasActed = true;
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
    state.bossTelegraph = null;
    return;
  }

  for (const hero of struck) {
    const formula = rewriteFormula(formulaSource, boss);
    let damage = roll(formula, rng).total;
    const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
    damage += dc.enemyDamageBonus + (state.modifierDamageBonus ?? 0);

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

    if (hero.hp > 0) {
      applyCondition(hero, "slowed", 1);
      state.log.push({
        kind: "action",
        text: `[T${round}] ${hero.displayName} is Slowed by the impact.`,
        round,
      });
    } else {
      handleUnitDroppedToZero(hero, state);
    }
  }

  state.bossTelegraph = null;
}

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
