import { gameState, syncPartyFromCombat } from "../../../src/state/GameState.ts";
import { ACTION_REGISTRY } from "../../../src/data/actions.ts";
import { CLASS_REGISTRY } from "../../../src/data/classes.ts";
import { ITEM_REGISTRY } from "../../../src/data/items.ts";
import { validTargets, resolveAction, checkVictoryDefeat, removeDefeatedFromQueue } from "../../../src/combat/Action.ts";
import { isChargeExhausted } from "../../../src/combat/ActionBar.ts";
import { heroLifeState, resolveDeathSaveTurn } from "../../../src/combat/DeathSaves.ts";
import { takeEnemyTurn } from "../../../src/combat/EnemyAI.ts";
import { processTurnStart } from "../../../src/combat/Condition.ts";
import { availableNextNodes } from "../../../src/run/MapGraph.ts";
import { NODE_REGISTRY } from "../../../src/data/nodes.ts";
import { hexKey, parseHexKey, distance } from "../../../src/core/hex.ts";
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

// Headless hero move: update position directly, mirroring handleMoveClick's state changes
// without the DOM render and canvas-click overhead that causes worker OOM/hang in tests.
function applyHeroMove(unit: UnitInstance, destKey: string, reachable: Map<string, number>): void {
  const cost = reachable.get(destKey) ?? 1;
  unit.pos = parseHexKey(destKey);
  unit.movePointsRemaining -= cost;
}

function getActiveUnit(cs: CombatState): UnitInstance | null {
  const id = cs.turnQueue[cs.activeIndex];
  return cs.units.find((u) => u.instanceId === id) ?? null;
}

function advanceTurn(cs: CombatState): void {
  movedThisTurn.clear();
  // Mirror CombatScreen.advanceTurn: process death saves for downed heroes and skip
  // past downed/stable heroes so the outer loop always lands on an actionable unit.
  // Without this, downed heroes stay in the queue indefinitely, checkVictoryDefeat
  // never sees canStillRecover=false, and the inner enemy loop never terminates.
  const maxSkips = cs.turnQueue.length + 2;
  for (let i = 0; i < maxSkips; i++) {
    if (cs.turnQueue.length === 0) return;
    cs.activeIndex = (cs.activeIndex + 1) % cs.turnQueue.length;
    if (cs.activeIndex === 0) cs.round++;

    const active = getActiveUnit(cs);
    if (!active) return;

    const ls = heroLifeState(active);

    if (ls === "dead") {
      removeDefeatedFromQueue(cs);
      checkVictoryDefeat(cs);
      if (cs.status !== "active") return;
      continue;
    }

    if (ls === "downed") {
      const result = resolveDeathSaveTurn(active, cs, gameState.rng);
      if (result === "dead") {
        removeDefeatedFromQueue(cs);
        checkVictoryDefeat(cs);
        if (cs.status !== "active") return;
        continue;
      }
      if (result === "revived") {
        active.movePointsRemaining = active.stats.move;
        active.hasActed = false;
        processTurnStart(active);
        return;
      }
      // stable or still_downed: skip this unit's turn
      if (result === "stable") {
        checkVictoryDefeat(cs);
        if (cs.status !== "active") return;
      }
      continue;
    }

    if (ls === "stable") {
      checkVictoryDefeat(cs);
      if (cs.status !== "active") return;
      continue;
    }

    // Normal standing hero or enemy.
    active.movePointsRemaining = active.stats.move;
    active.hasActed = false;
    processTurnStart(active);
    return;
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
      // Drive hero turns directly through state — no app.render() or DOM interaction.
      // Rendering the full CombatScreen on every hero turn creates hundreds of DOM nodes
      // per iteration; across a full playthrough this overwhelms the happy-dom worker.
      let acted = false;
      const enemiesExist = cs.units.some((u) => u.team !== unit.team && u.hp > 0);

      if (!unit.hasActed) {
        for (const actionId of getActionIds(unit)) {
          if (isChargeExhausted(actionId, cs)) continue;
          const actionDef = ACTION_REGISTRY[actionId];
          if (!actionDef) continue;
          if (enemiesExist && actionDef.targetType === "self") continue;
          const targets = validTargets(actionDef, unit, cs);
          if (targets.length === 0) continue;
          const target = targets[Math.floor(gameState.rng() * targets.length)];
          resolveAction(actionDef, unit, target, cs, gameState.rng);
          checkVictoryDefeat(cs);
          removeDefeatedFromQueue(cs);
          acted = true;
          break;
        }
      }

      if (!acted && enemiesExist && unit.movePointsRemaining > 0 && !movedThisTurn.has(unit.instanceId)) {
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
            applyHeroMove(unit, bestKey, reachable);
            movedThisTurn.add(unit.instanceId);
            continue;
          }
        }
      }

      if (cs.status !== "active") break;
      advanceTurn(cs);
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
  app.render();
}

export function autoPlayEvent(root: HTMLElement): void {
  // Pick the first *selectable* choice — some events gate choices (e.g. cost gold) and
  // render them disabled (`data-disabled`), so blindly clicking choice 0 can stall.
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-testid^="event-choice-"]'));
  const selectable = cards.filter((c) => c.getAttribute("data-disabled") !== "true");
  const pick = selectable[0] ?? cards[0];
  if (pick) {
    pick.click();
  }
  const heroBtns = root.querySelectorAll<HTMLButtonElement>("button");
  if (heroBtns.length > 0) {
    for (const btn of heroBtns) {
      if (btn.textContent?.trim() === "Continue") {
        btn.click();
        return;
      }
    }
    // Otherwise pick the first enabled non-Cancel button (e.g. an able hero for a check).
    for (const btn of heroBtns) {
      if (btn.textContent?.trim() !== "Cancel" && !btn.disabled) {
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
      const stashBtn = root.querySelector<HTMLButtonElement>('[data-testid="shop-stash-btn"]');
      if (stashBtn && !stashBtn.disabled) {
        stashBtn.click();
        break;
      }
      const buyBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Buy" && !b.disabled);
      if (buyBtn) {
        buyBtn.click();
        const pendingStashBtn = root.querySelector<HTMLButtonElement>('[data-testid="shop-stash-btn"]');
        if (pendingStashBtn && !pendingStashBtn.disabled) pendingStashBtn.click();
        break;
      }
      const leaveBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Leave Shop" && !b.disabled);
      if (leaveBtn) leaveBtn.click();
      break;
    }
    case "camp": {
      const buttons = Array.from(root.querySelectorAll("button"));
      // Pre-confirm preview: confirm the pending choice (e.g. Long Rest).
      const confirmBtn = buttons.find((b) => b.textContent?.trim() === "Confirm");
      if (confirmBtn) { confirmBtn.click(); break; }
      // Menu: take a Long Rest while still available (enabled buttons carry the bare label;
      // once used/gated the label is suffixed with a reason and no longer matches).
      const restBtn = buttons.find((b) => b.textContent?.trim() === "Long Rest");
      if (restBtn) { restBtn.click(); break; }
      // Then leave the camp.
      const leaveBtn = buttons.find((b) => b.textContent?.trim() === "Leave");
      if (leaveBtn) { leaveBtn.click(); }
      break;
    }
    case "event": {
      autoPlayEvent(root);
      break;
    }
    case "levelup": {
      const option = root.querySelector<HTMLElement>('[data-testid^="levelup-option-"]');
      if (option) option.click();
      const confirmBtn = root.querySelector<HTMLButtonElement>('[data-testid="levelup-confirm"]');
      if (confirmBtn && !confirmBtn.disabled) confirmBtn.click();
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
