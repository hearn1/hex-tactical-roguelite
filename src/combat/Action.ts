import type { ActionDef } from "../data/actions.ts";
import type { UnitInstance, CombatState, ConditionId } from "../state/types.ts";
import { distance, hexKey } from "../core/hex.ts";
import { roll } from "../core/dice.ts";
import { applyCondition } from "./Condition.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { DIFFICULTY_CONFIG } from "../data/difficulty.ts";

export function validTargets(
  action: ActionDef,
  attacker: UnitInstance,
  state: CombatState,
): UnitInstance[] {
  const living = state.units.filter((u) => u.hp > 0);
  switch (action.targetType) {
    case "self":
      return living.filter((u) => u.instanceId === attacker.instanceId);
    case "ally":
      return living.filter(
        (u) => u.team === attacker.team && u.instanceId !== attacker.instanceId && distance(attacker.pos, u.pos) <= action.range,
      );
    case "ally_or_self":
      return living.filter(
        (u) => u.team === attacker.team && distance(attacker.pos, u.pos) <= action.range,
      );
    case "enemy":
      return living.filter(
        (u) => u.team !== attacker.team && distance(attacker.pos, u.pos) <= action.range,
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
    applyCondition(target, action.effect.conditionId as ConditionId, action.effect.duration);
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

    const formula = rewriteFormula(action.effect.formula, attacker);
    const result = roll(formula, rng);
    const healed = result.total + blessedBonus;
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
  const attackTotal = d20 + stat + proficiency - weakenedPenalty + blessedBonus;
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
    applyCondition(target, action.effect.applyCondition.id as ConditionId, action.effect.applyCondition.duration);
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
