import type { ActionDef } from "../data/actions.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";
import type { UnitInstance, CombatState, ConditionId, ActionUpgradeBonus } from "../state/types.ts";
import { distance, hexKey } from "../core/hex.ts";
import { roll } from "../core/dice.ts";
import { applyCondition } from "./Condition.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { ENCOUNTER_REGISTRY } from "../data/encounters.ts";
import { DIFFICULTY_CONFIG } from "../data/difficulty.ts";
import { LEVELUP_PASSIVE_FIRST_HEAL_BONUS, FIRST_HEAL_BONUS_AMOUNT } from "../data/levelups.ts";

/** Elite "Rally" to-hit bonus granted to survivors when the first elite member falls. */
export const RALLY_TO_HIT_BONUS = 2;
/** How many of the survivor's turns the Rally bonus lasts. */
export const RALLY_DURATION = 2;

const EMPTY_BONUS: ActionUpgradeBonus = {};

/** Per-action level-up bonus for this attacker (F29), or an empty bonus when none applies. */
function actionBonus(attacker: UnitInstance, actionId: string): ActionUpgradeBonus {
  return attacker.actionUpgrades?.[actionId] ?? EMPTY_BONUS;
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
  const living = state.units.filter((u) => u.hp > 0);
  const range = effectiveRange(action, attacker);
  switch (action.targetType) {
    case "self":
      return living.filter((u) => u.instanceId === attacker.instanceId);
    case "ally":
      return living.filter(
        (u) => u.team === attacker.team && u.instanceId !== attacker.instanceId && distance(attacker.pos, u.pos) <= range,
      );
    case "ally_or_self":
      return living.filter(
        (u) => u.team === attacker.team && distance(attacker.pos, u.pos) <= range,
      );
    case "enemy":
      return living.filter(
        (u) => u.team !== attacker.team && distance(attacker.pos, u.pos) <= range,
      );
  }
}

function rewriteFormula(formula: string, attacker: UnitInstance): string {
  return formula
    .replace("+ might", `+ ${attacker.stats.might}`)
    .replace("+ agility", `+ ${attacker.stats.agility}`)
    .replace("+ spirit", `+ ${attacker.stats.spirit}`);
}

export function resolveAction(
  action: ActionDef,
  attacker: UnitInstance,
  target: UnitInstance,
  state: CombatState,
  rng: () => number,
  skipHasActed?: boolean,
  bonusDamage = 0,
): void {
  const round = state.round;

  if (action.effect.type === "applyCondition") {
    if (action.effect.targetMode === "aoe_around_caster") {
      const affected = state.units.filter(
        (u) => u.team !== attacker.team && u.hp > 0 && distance(attacker.pos, u.pos) <= action.range,
      );
      for (const u of affected) {
        applyCondition(u, action.effect.conditionId as ConditionId, action.effect.duration);
      }
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} — Weakened applied to ${affected.length} heroes.`,
        round,
      });
      if (!skipHasActed) attacker.hasActed = true;
      return;
    }
    const condDuration = action.effect.duration + (actionBonus(attacker, action.id).conditionDurationBonus ?? 0);
    applyCondition(target, action.effect.conditionId as ConditionId, condDuration);
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — ${action.effect.conditionId} applied.`,
      round,
    });
    if (!skipHasActed) attacker.hasActed = true;
    return;
  }

  if (action.effect.type === "heal") {
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
    const healed = result.total + blessedBonus + firstHealBonus + (actionBonus(attacker, action.id).healBonus ?? 0);
    const before = target.hp;
    target.hp = Math.min(target.hp + healed, target.stats.maxHp);
    const actual = target.hp - before;
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — heal ${actual}. ${target.displayName}: ${target.hp}/${target.stats.maxHp} HP.`,
      round,
    });
    if (!skipHasActed) attacker.hasActed = true;
    return;
  }

  if (action.effect.type === "damage" && action.effect.targetMode === "primary_plus_adjacent") {
    resolvePrimaryPlusAdjacent(action, attacker, target, state, rng, skipHasActed);
    return;
  }

  const attackStat = action.accuracyStat ?? "might";
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

  const d20 = Math.floor(rng() * 20) + 1;
  const attackTotal = d20 + stat + proficiency - weakenedPenalty + blessedBonus + ralliedBonus;
  const isCrit = d20 === 20;
  const isAutoMiss = d20 === 1;
  const hit = !isAutoMiss && (isCrit || attackTotal >= target.stats.armor);

  if (!hit) {
    if (isAutoMiss) {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=1 → auto-miss.`,
        round,
      });
    } else {
      state.log.push({
        kind: "action",
        text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} +${stat}+${proficiency}=${attackTotal} vs ${target.stats.armor} → miss.`,
        round,
      });
    }
    if (!skipHasActed) attacker.hasActed = true;
    return;
  }

  const formula = rewriteFormula(action.effect.formula, attacker);
  const result = roll(formula, rng);
  let damage = result.total;
  if (isCrit) damage *= 2;
  if (attacker.team === "enemy") {
    const dc = DIFFICULTY_CONFIG[state.difficulty ?? "normal"];
    damage += dc.enemyDamageBonus;
  }
  // Opportunist burst (e.g. the ambusher's first strike on an exposed/wounded foe).
  if (bonusDamage > 0) damage += bonusDamage;
  // Level-up action damage upgrade (F29), e.g. Pressing Strike / Ember Focus.
  damage += actionBonus(attacker, action.id).damageBonus ?? 0;

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

  const beforeHp = target.hp;
  target.hp = Math.max(0, target.hp - damage);
  const dealt = beforeHp - target.hp;

  if (isCrit) {
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=20 crit! ${dealt} dmg (${damage} before reduction). ${target.displayName}: ${target.hp}/${target.stats.maxHp} HP.`,
      round,
    });
  } else {
    state.log.push({
      kind: "action",
      text: `[T${round}] ${attacker.displayName} uses ${action.displayName} on ${target.displayName} — d20=${d20} +${stat}+${proficiency}=${attackTotal} vs ${target.stats.armor} → hit, ${dealt} dmg. ${target.displayName}: ${target.hp}/${target.stats.maxHp} HP.`,
      round,
    });
  }

  if (action.effect.type === "damage" && action.effect.applyCondition) {
    const condDuration =
      action.effect.applyCondition.duration + (actionBonus(attacker, action.id).conditionDurationBonus ?? 0);
    applyCondition(target, action.effect.applyCondition.id as ConditionId, condDuration);
    state.log.push({
      kind: "action",
      text: `[T${round}] ${action.displayName} hits — ${action.effect.applyCondition.id} applied.`,
      round,
    });
  }

  checkBossReinforcement(target, state);

  if (target.hp <= 0) {
    state.log.push({
      kind: "defeat",
      text: `[T${round}] ${target.displayName} is defeated.`,
      round,
    });
    checkEliteRally(target, state);
  }

  if (!skipHasActed) attacker.hasActed = true;
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
  const attackStat = action.accuracyStat ?? "might";
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
      damage += dc.enemyDamageBonus;
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
      state.log.push({
        kind: "defeat",
        text: `[T${round}] ${target.displayName} is defeated.`,
        round,
      });
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
        dmg += dc.enemyDamageBonus;
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
        state.log.push({
          kind: "defeat",
          text: `[T${round}] ${hero.displayName} is defeated.`,
          round,
        });
      }
    } else {
      state.log.push({
        kind: "action",
        text: `[T${round}] Ground Slam misses ${hero.displayName}.`,
        round,
      });
    }
  }

  checkBossReinforcement(target, state);
  if (!skipHasActed) attacker.hasActed = true;
}

function checkBossReinforcement(target: UnitInstance, state: CombatState): void {
  if (state.bossReinforcementSpawned) return;
  const enemyDef = ENEMY_REGISTRY[target.defId];
  if (!enemyDef || enemyDef.aiTag !== "boss") return;
  if (target.hp > Math.floor(target.stats.maxHp / 2)) return;

  state.bossReinforcementSpawned = true;
  const occupied = new Set(state.units.filter((u) => u.hp > 0).map((u) => hexKey(u.pos)));
  const candidates: { q: number; r: number }[] = [
    { q: 3, r: -2 }, { q: 3, r: -1 }, { q: 3, r: 0 },
    { q: 4, r: -2 }, { q: 4, r: -1 }, { q: 4, r: 0 },
  ];
  let spawnPos: { q: number; r: number } | null = null;
  for (const pos of candidates) {
    const key = hexKey(pos);
    if (!occupied.has(key) && state.gridKeys.includes(key)) {
      spawnPos = pos;
      break;
    }
  }
  if (!spawnPos) return;

  const archerStats = { maxHp: 9, armor: 12, move: 3, might: 1, agility: 2, spirit: 0 };
  const archer: UnitInstance = {
    instanceId: "enemy_reinforcement",
    defId: "enemy.skeleton_archer",
    displayName: "Skeleton Archer",
    team: "enemy",
    level: 1,
    xp: 0,
    stats: { ...archerStats },
    hp: 9,
    pos: spawnPos,
    conditions: [],
    movePointsRemaining: 0,
    hasActed: false,
    equippedItemIds: { weapon: null, armor: null, trinket: null },
    bonusStats: {},
  };
  state.units.push(archer);
  const activeId = state.turnQueue[state.activeIndex];
  const bossIdx = state.turnQueue.indexOf(target.instanceId);
  const insertAt = bossIdx >= 0 ? bossIdx + 1 : state.turnQueue.length;
  state.turnQueue.splice(insertAt, 0, archer.instanceId);
  const newActiveIndex = state.turnQueue.indexOf(activeId);
  if (newActiveIndex >= 0) {
    state.activeIndex = newActiveIndex;
  }

  state.log.push({
    kind: "action",
    text: `[T${state.round}] The Hexbreaker calls reinforcement — a Skeleton Archer joins!`,
    round: state.round,
  });
}

/**
 * Elite "Rally" trait (F28 / #59). The first time any enemy falls in an encounter flagged
 * `eliteTrait: "rally"`, every surviving enemy gains the `rallied` to-hit bonus for a few
 * turns — a readable "the survivors close ranks" beat. Fires at most once per combat.
 */
function checkEliteRally(fallen: UnitInstance, state: CombatState): void {
  if (state.eliteRallyTriggered) return;
  if (fallen.team !== "enemy") return;
  const encounter = state.encounterId ? ENCOUNTER_REGISTRY[state.encounterId] : undefined;
  if (!encounter || encounter.eliteTrait !== "rally") return;

  const survivors = state.units.filter((u) => u.team === "enemy" && u.hp > 0);
  if (survivors.length === 0) return;

  state.eliteRallyTriggered = true;
  for (const enemy of survivors) {
    applyCondition(enemy, "rallied", RALLY_DURATION);
  }
  state.log.push({
    kind: "action",
    text: `[T${state.round}] ${fallen.displayName} falls — the survivors Rally! (+${RALLY_TO_HIT_BONUS} to hit for ${RALLY_DURATION} turns)`,
    round: state.round,
  });
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
    action && action.effect.type === "damage" ? action.effect.formula : "1d8 + might";
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
    damage += dc.enemyDamageBonus;

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
      state.log.push({
        kind: "defeat",
        text: `[T${round}] ${hero.displayName} is defeated.`,
        round,
      });
    }
  }

  state.bossTelegraph = null;
}

export function checkVictoryDefeat(state: CombatState): void {
  const heroesAlive = state.units.filter((u) => u.team === "hero" && u.hp > 0);
  const enemiesAlive = state.units.filter((u) => u.team === "enemy" && u.hp > 0);

  if (enemiesAlive.length === 0) {
    state.status = "victory";
    state.log.push({ kind: "victory", text: `[T${state.round}] Victory.`, round: state.round });
  } else if (heroesAlive.length === 0) {
    state.status = "defeat";
    state.log.push({ kind: "defeat_squad", text: `[T${state.round}] Defeat.`, round: state.round });
  }
}

export function removeDefeatedFromQueue(state: CombatState): void {
  const deadIds = new Set(
    state.units.filter((u) => u.hp <= 0).map((u) => u.instanceId),
  );
  if (deadIds.size === 0) return;
  const before = state.activeIndex;
  const activeId = state.turnQueue[state.activeIndex];
  const activeDead = deadIds.has(activeId);
  state.turnQueue = state.turnQueue.filter((id) => !deadIds.has(id));
  if (activeDead) {
    state.activeIndex = Math.min(before, state.turnQueue.length - 1);
  } else {
    state.activeIndex = state.turnQueue.indexOf(activeId);
  }
}
