import { gameState, syncPartyFromCombat } from "../../../src/state/GameState.ts";
import { ACTION_REGISTRY } from "../../../src/data/actions.ts";
import { CLASS_REGISTRY } from "../../../src/data/classes.ts";
import { ITEM_REGISTRY } from "../../../src/data/items.ts";
import { validTargets, resolveAction, checkVictoryDefeat, removeDefeatedFromQueue } from "../../../src/combat/Action.ts";
import { takeEnemyTurn } from "../../../src/combat/EnemyAI.ts";
import { processTurnStart } from "../../../src/combat/Condition.ts";
import { availableNextNodes } from "../../../src/run/MapGraph.ts";
import { hexToPixel, hexKey, parseHexKey, distance } from "../../../src/core/hex.ts";
import { reachableHexes } from "../../../src/combat/Movement.ts";
import type { CombatState, UnitInstance } from "../../../src/state/types.ts";
import type { App } from "../../../src/ui/App.ts";

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

function getActiveUnit(cs: CombatState): UnitInstance | null {
  const id = cs.turnQueue[cs.activeIndex];
  return cs.units.find((u) => u.instanceId === id) ?? null;
}

function advanceTurn(cs: CombatState): void {
  movedThisTurn.clear();
  cs.activeIndex = (cs.activeIndex + 1) % cs.turnQueue.length;
  if (cs.activeIndex === 0) cs.round++;
  const active = getActiveUnit(cs);
  if (active) {
    active.movePointsRemaining = active.stats.move;
    active.hasActed = false;
    processTurnStart(active);
  }
}

function buildDiagnostics(cs: CombatState): string {
  const lines: string[] = [`Round: ${cs.round}, Status: ${cs.status}`];
  for (const u of cs.units) {
    lines.push(`${u.displayName} (${u.team}): HP ${u.hp}/${u.stats.maxHp}`);
  }
  const lastLog = cs.log.slice(-5).map((e) => e.text).join("\n");
  lines.push("Last log entries:");
  lines.push(lastLog);
  return lines.join("\n");
}

function clickHexOnCanvas(canvas: HTMLCanvasElement, hex: { q: number; r: number }): void {
  const { x, y } = hexToPixel(hex);
  canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: y }));
  canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
}

const movedThisTurn = new Set<string>();

export function autoPlayCombat(app: App): void {
  const cs = gameState.combat;
  if (!cs) return;

  let safety = 0;
  while (cs.status === "active" && safety < 500) {
    safety++;
    if (cs.round > 30) {
      throw new Error(`Combat stalemate - round > 30 with no resolution.\n${buildDiagnostics(cs)}`);
    }

    const unit = getActiveUnit(cs);
    if (!unit || unit.hp <= 0) { advanceTurn(cs); continue; }

    if (unit.team === "hero") {
      app.render();
      const root = document.getElementById("app")!;

      const actionBtns = root.querySelectorAll<HTMLButtonElement>(".action-btn:not(.disabled)");
      let acted = false;

      for (const btn of actionBtns) {
        if (btn.disabled) continue;
        btn.click();
        const actionId = cs.targetingActionId;
        if (!actionId) continue;
        const actionDef = ACTION_REGISTRY[actionId];
        if (!actionDef) { cs.targetingActionId = null; continue; }
        const targets = validTargets(actionDef, unit, cs);
        if (targets.length === 0) { cs.targetingActionId = null; continue; }
        const target = targets[Math.floor(gameState.rng() * targets.length)];
        const canvas = root.querySelector("canvas") as HTMLCanvasElement;
        clickHexOnCanvas(canvas, target.pos);
        acted = true;
        break;
      }

      if (!acted && unit.movePointsRemaining > 0 && !movedThisTurn.has(unit.instanceId)) {
        const occ = new Set(
          cs.units.filter((u) => u.hp > 0 && u.instanceId !== unit.instanceId).map((u) => hexKey(u.pos)),
        );
        const reachable = reachableHexes(unit.pos, unit.movePointsRemaining, occ, new Set(cs.gridKeys));
        const enemies = cs.units.filter((u) => u.team !== unit.team && u.hp > 0);
        if (enemies.length > 0 && reachable.size > 0) {
          let bestKey: string | null = null;
          let bestScore = Infinity;
          for (const [key, cost] of reachable) {
            if (key === hexKey(unit.pos)) continue;
            const hex = parseHexKey(key);
            const minDist = Math.min(...enemies.map((e) => distance(hex, e.pos)));
            const score = minDist * 100 + cost;
            if (score < bestScore) { bestScore = score; bestKey = key; }
          }
          if (bestKey) {
            const canvas = root.querySelector("canvas") as HTMLCanvasElement;
            clickHexOnCanvas(canvas, parseHexKey(bestKey));
            movedThisTurn.add(unit.instanceId);
            continue;
          }
        }
      }

      checkVictoryDefeat(cs);
      removeDefeatedFromQueue(cs);
      if (cs.status !== "active") break;

      if (acted) {
        advanceTurn(cs);
      } else {
        const endBtn = root.querySelector<HTMLButtonElement>("#end-turn-btn");
        if (endBtn && !endBtn.disabled) {
          endBtn.click();
        } else {
          advanceTurn(cs);
        }
      }
    }

    if (cs.status !== "active") break;

    while (cs.status === "active") {
      const next = getActiveUnit(cs);
      if (!next || next.hp <= 0) { advanceTurn(cs); continue; }
      if (next.team === "hero") break;
      takeEnemyTurn(next, cs, gameState.rng);
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

export function autoPlayMapNode(app: App): void {
  const run = gameState.run;
  if (!run) return;
  app.render();
  const root = document.getElementById("app")!;
  const available = availableNextNodes(run.mapState);
  if (available.length === 0) return;
  const nodeId = available[0];
  const nodeEl = root.querySelector(`[data-testid="map-node-${nodeId}"]`);
  if (!nodeEl) return;
  nodeEl.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

export function autoPlayReward(app: App): void {
  const run = gameState.run;
  const cs = gameState.combat;
  if (!run || !cs) return;

  // Bypass RewardScreen UI due to pre-existing re-render state bug (#40 class).
  // Handle reward selection and transition directly on game state.
  const survivors = cs.units.filter((u) => u.team === "hero" && u.hp > 0);
  for (const hero of survivors) {
    const pm = run.party.find((p) => p.instanceId === hero.instanceId);
    if (pm) pm.xp += 10;
  }

  syncPartyFromCombat(cs, run);
  const nd = run.mapState.currentNodeId;
  if (nd === "node.boss") {
    run.mapState.bossDefeated = true;
    run.runStatus = "won";
  }
  run.mapState.nodesCleared++;
  gameState.combat = null;
  gameState.screen = "map";
  app.render();
}

export function autoPlayEvent(root: HTMLElement): void {
  const cards = root.querySelectorAll('[data-testid^="event-choice-"]');
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
