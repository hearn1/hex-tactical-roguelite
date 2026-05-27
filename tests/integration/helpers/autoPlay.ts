import { gameState, syncPartyFromCombat, createCombatFromRun } from "../../../src/state/GameState.ts";
import { ACTION_REGISTRY } from "../../../src/data/actions.ts";
import { CLASS_REGISTRY } from "../../../src/data/classes.ts";
import { ITEM_REGISTRY } from "../../../src/data/items.ts";
import { validTargets, resolveAction, checkVictoryDefeat, removeDefeatedFromQueue } from "../../../src/combat/Action.ts";
import { takeEnemyTurn } from "../../../src/combat/EnemyAI.ts";
import { processTurnStart } from "../../../src/combat/Condition.ts";
import { availableNextNodes, visitNode } from "../../../src/run/MapGraph.ts";
import { NODE_REGISTRY } from "../../../src/data/nodes.ts";
import { distance, findPath, hexKey } from "../../../src/core/hex.ts";
import type { CombatState, UnitInstance } from "../../../src/state/types.ts";

function getActionIds(unit: UnitInstance): string[] {
  const classDef = CLASS_REGISTRY[unit.defId];
  const classActions = classDef ? classDef.actionIds : [];
  const grantedActions: string[] = [];
  for (const slot of ["weapon", "armor", "trinket"] as const) {
    const itemId = unit.equippedItemIds[slot];
    if (!itemId) continue;
    const itemDef = ITEM_REGISTRY[itemId];
    if (itemDef?.grantedActionIds) {
      for (const aid of itemDef.grantedActionIds) {
        if (!grantedActions.includes(aid)) grantedActions.push(aid);
      }
    }
  }
  return [...classActions, ...grantedActions];
}

function advanceTurn(cs: CombatState): void {
  cs.activeIndex = (cs.activeIndex + 1) % cs.turnQueue.length;
  if (cs.activeIndex === 0) cs.round++;
  const active = cs.units.find((u) => u.instanceId === cs.turnQueue[cs.activeIndex]);
  if (active) {
    active.movePointsRemaining = active.stats.move;
    active.hasActed = false;
    processTurnStart(active);
  }
}

export function autoPlayCombat(): void {
  const cs = gameState.combat;
  if (!cs) return;

  let safety = 0;
  while (cs.status === "active" && safety < 500) {
    safety++;
    if (cs.round > 30) {
      cs.status = "victory";
      break;
    }
    const activeId = cs.turnQueue[cs.activeIndex];
    const unit = cs.units.find((u) => u.instanceId === activeId);
    if (!unit || unit.hp <= 0) { advanceTurn(cs); continue; }

    if (unit.team === "hero") {
      const actionIds = getActionIds(unit);
      let acted = false;

      for (const actionId of actionIds) {
        const actionDef = ACTION_REGISTRY[actionId];
        if (!actionDef) continue;
        const targets = validTargets(actionDef, unit, cs);
        if (targets.length > 0) {
          resolveAction(actionDef, unit, targets[0], cs, gameState.rng);
          acted = true;
          break;
        }
      }
      if (!acted && unit.movePointsRemaining > 0) {
        const enemies = cs.units.filter((u) => u.team === "enemy" && u.hp > 0);
        if (enemies.length > 0) {
          const nearest = enemies.reduce((a, b) => {
            const da = distance(unit.hex, a.hex);
            const db = distance(unit.hex, b.hex);
            return da < db ? a : b;
          });
          const occupiedKeys = new Set(cs.units.filter((u) => u.hp > 0).map((u) => hexKey(u.hex)));
          const gridKeys = new Set(cs.mapHexes.map((h) => hexKey(h)));
          gridKeys.delete(hexKey(unit.hex));
          const path = findPath(unit.hex, nearest.hex, occupiedKeys, gridKeys, unit.movePointsRemaining);
          if (path && path.length > 0) {
            const dest = path[path.length - 1];
            unit.hex = dest;
            unit.movePointsRemaining = 0;
            unit.hasActed = true;
            acted = true;
          }
        }
      }
      if (!acted) {
        unit.hasActed = true;
      }
      checkVictoryDefeat(cs);
      removeDefeatedFromQueue(cs);
      if (cs.status !== "active") break;
      advanceTurn(cs);
    } else {
      takeEnemyTurn(unit, cs, gameState.rng);
      checkVictoryDefeat(cs);
      removeDefeatedFromQueue(cs);
      if (cs.status !== "active") break;
      advanceTurn(cs);
    }
  }

  if (cs.status === "victory") {
    if (gameState.run) {
      syncPartyFromCombat(cs, gameState.run);
    }
    gameState.screen = "reward";
  } else if (cs.status === "defeat") {
    if (gameState.run) {
      gameState.run.runStatus = "lost";
    }
    gameState.screen = "run_summary";
  }
}

export function autoPlayMapNode(): void {
  const run = gameState.run;
  if (!run) return;
  const available = availableNextNodes(run.mapState);
  if (available.length === 0) return;
  const nodeId = available[0];
  const nodeDef = NODE_REGISTRY[nodeId];
  if (!nodeDef) return;

  visitNode(run.mapState, nodeId);

  if (nodeDef.type === "combat" || nodeDef.type === "boss" || nodeDef.type === "elite") {
    if (nodeDef.encounterId) {
      gameState.combat = createCombatFromRun(run, nodeDef.encounterId, gameState.rng);
      gameState.screen = "combat";
    }
    return;
  }

  if (nodeDef.type === "shop" || nodeDef.type === "camp" || nodeDef.type === "event" || nodeDef.type === "recruit" || nodeDef.type === "pet") {
    gameState.screen = nodeDef.type;
  }
}

export function autoPlayReward(): void {
  const run = gameState.run;
  const cs = gameState.combat;
  if (!run || !cs) { gameState.screen = "map"; return; }

  for (const pm of run.party) {
    const unit = cs.units.find((u) => u.instanceId === pm.instanceId);
    if (unit) {
      pm.hp = unit.hp > 0 ? unit.hp : 1;
      pm.xp = unit.xp;
      pm.level = unit.level;
    }
  }
  const nd = NODE_REGISTRY[run.mapState.currentNodeId];
  if (nd?.type === "boss") {
    run.mapState.bossDefeated = true;
    run.runStatus = "won";
  }
  if (nd?.type === "elite") {
    run.mapState.elitesDefeated++;
  }
  run.mapState.nodesCleared++;
  gameState.combat = null;

  if (run.runStatus === "won") {
    gameState.screen = "run_summary";
  } else {
    gameState.screen = "map";
  }
}

export function autoPlayEvent(root: HTMLElement): void {
  const cards = root.querySelectorAll('[style*="cursor:pointer"]');
  if (cards.length > 0) {
    (cards[0] as HTMLElement).click();
  }
  const heroBtns = root.querySelectorAll("button");
  if (heroBtns.length > 0) {
    for (const btn of heroBtns) {
      if (btn.textContent?.trim() === "Continue") {
        btn.click();
        return;
      }
    }
    for (const btn of heroBtns) {
      if (btn.textContent?.trim() !== "Cancel") {
        btn.click();
        return;
      }
    }
  }
}

export function autoPlayNonCombatScreen(root: HTMLElement): void {
  if (!gameState.run) return;

  switch (gameState.screen) {
    case "shop": {
      const buyBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Buy" && !b.disabled);
      if (buyBtn) buyBtn.click();
      const leaveBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Leave Shop");
      if (leaveBtn) leaveBtn.click();
      break;
    }
    case "camp": {
      const leaveBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Leave");
      if (leaveBtn) {
        leaveBtn.click();
      } else {
        if (gameState.run) gameState.run.mapState.nodesCleared++;
        gameState.screen = "map";
      }
      break;
    }
    case "event": {
      autoPlayEvent(root);
      break;
    }
    case "recruit": {
      const recruitBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Recruit");
      if (recruitBtn) recruitBtn.click();
      const continueBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Continue");
      if (continueBtn) continueBtn.click();
      const skipBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Skip");
      if (!continueBtn && skipBtn) skipBtn.click();
      break;
    }
    case "pet": {
      const acceptBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Accept");
      if (acceptBtn) acceptBtn.click();
      const continueBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Continue");
      if (continueBtn) continueBtn.click();
      break;
    }
  }
}
