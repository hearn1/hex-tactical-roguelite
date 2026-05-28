import type { App } from "../App.ts";
import { gameState, initCombatState } from "../../state/GameState.ts";
import { syncPartyFromCombat } from "../../state/GameState.ts";
import type { CombatState, UnitInstance, Hex } from "../../state/types.ts";
import { hexKey, parseHexKey, pixelToHex, hexEquals } from "../../core/hex.ts";
import { renderHexOutline, fillHex } from "../HexRenderer.ts";
import { reachableHexes } from "../../combat/Movement.ts";
import { ACTION_REGISTRY } from "../../data/actions.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import { validTargets, resolveAction, checkVictoryDefeat, removeDefeatedFromQueue } from "../../combat/Action.ts";
import { takeEnemyTurn } from "../../combat/EnemyAI.ts";
import { processTurnStart } from "../../combat/Condition.ts";
import { ITEM_REGISTRY } from "../../data/items.ts";
import { ENEMY_REGISTRY } from "../../data/enemies.ts";

const HERO_COLOR = "#4488ff";
const ENEMY_COLOR = "#ff4444";
const GRID_COLOR = "#555";
const HOVER_COLOR = "rgba(255,255,0,0.15)";
const REACHABLE_COLOR = "rgba(0,200,100,0.2)";
const TARGET_COLOR = "rgba(255,50,50,0.35)";
const ACTIVE_GLOW = "#ffcc00";

export class CombatScreen {
  private app: App;
  private container!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private hoveredHex: Hex | null = null;
  private enemyProcessing = false;
  private actionBarEl!: HTMLElement;
  private turnPanelEl!: HTMLElement;
  private logPanelEl!: HTMLElement;
  private endTurnBtn!: HTMLButtonElement;
  private inventoryPanelEl!: HTMLElement;
  private invToggleBtn!: HTMLButtonElement;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    if (!gameState.combat) {
      gameState.combat = initCombatState(gameState.rng);
    }

    this.container = document.createElement("div");
    this.container.className = "combat-container";
    this.container.style.position = "relative";

    const topRow = document.createElement("div");
    topRow.className = "combat-top";

    const canvasWrap = document.createElement("div");
    canvasWrap.className = "combat-canvas-wrap";
    this.canvas = document.createElement("canvas");
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext("2d")!;
    canvasWrap.appendChild(this.canvas);

    this.turnPanelEl = this.buildTurnPanel();
    topRow.appendChild(canvasWrap);
    topRow.appendChild(this.turnPanelEl);

    this.actionBarEl = this.buildActionBar();
    this.logPanelEl = this.buildLogPanel();
    const endTurnBar = this.buildEndTurnBar();
    this.inventoryPanelEl = this.buildInventoryPanel();

    this.container.appendChild(topRow);
    this.container.appendChild(this.actionBarEl);
    this.container.appendChild(this.logPanelEl);
    this.container.appendChild(endTurnBar);
    this.container.appendChild(this.inventoryPanelEl);

    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("click", (e) => this.onCanvasClick(e));
    this.canvas.addEventListener("mouseleave", () => {
      this.hoveredHex = null;
      this.drawCanvas();
    });

    this.drawCanvas();
    this.updatePanels();

    const cs = gameState.combat;
    if (cs && cs.status !== "active") {
      this.showBanner(cs.status === "victory" ? "Victory!" : "Defeat");
    }

    return this.container;
  }

  private buildTurnPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "turn-panel";
    panel.id = "turn-panel";
    const title = document.createElement("h3");
    title.textContent = "Turn Order";
    panel.appendChild(title);
    return panel;
  }

  private buildActionBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "action-bar";
    bar.id = "action-bar";
    return bar;
  }

  private buildLogPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "log-panel";
    panel.id = "log-panel";
    return panel;
  }

  private buildEndTurnBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "end-turn-bar";
    bar.id = "end-turn-bar";
    this.endTurnBtn = document.createElement("button");
    this.endTurnBtn.textContent = "End Turn";
    this.endTurnBtn.id = "end-turn-btn";
    this.endTurnBtn.addEventListener("click", () => this.onEndTurn());
    bar.appendChild(this.endTurnBtn);
    this.invToggleBtn = document.createElement("button");
    this.invToggleBtn.textContent = "Inventory";
    this.invToggleBtn.id = "inventory-toggle-btn";
    this.invToggleBtn.addEventListener("click", () => this.toggleInventory());
    bar.appendChild(this.invToggleBtn);
    return bar;
  }

  private toggleInventory(): void {
    if (this.inventoryPanelEl) {
      this.inventoryPanelEl.style.display = this.inventoryPanelEl.style.display === "none" ? "block" : "none";
    }
  }

  private buildInventoryPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.id = "inventory-panel";
    panel.style.cssText = "display:none;border:1px solid #444;background:#1a1a2e;padding:8px;margin-top:4px;";
    return panel;
  }

  private updateInventoryPanel(): void {
    const panel = this.inventoryPanelEl;
    const cs = gameState.combat;
    if (!cs) return;
    const heroes = cs.units.filter((u) => u.team === "hero" && u.hp > 0);
    const inv = gameState.run ? gameState.run.inventory : gameState.inventory;
    const itemsHtml = heroes.map((h) => {
      const w = h.equippedItemIds.weapon ? ITEM_REGISTRY[h.equippedItemIds.weapon]?.displayName ?? h.equippedItemIds.weapon : "(none)";
      const a = h.equippedItemIds.armor ? ITEM_REGISTRY[h.equippedItemIds.armor]?.displayName ?? h.equippedItemIds.armor : "(none)";
      const t = h.equippedItemIds.trinket ? ITEM_REGISTRY[h.equippedItemIds.trinket]?.displayName ?? h.equippedItemIds.trinket : "(none)";
      return `<div style="margin-bottom:6px;"><b>${h.displayName}</b><br/>Weapon: ${w}<br/>Armor: ${a}<br/>Trinket: ${t}</div>`;
    }).join("");
    const bagHtml = `<div><b>Bag</b><br/>Items: ${inv.items.join(", ") || "(empty)"}<br/>Potions: ${inv.potions.join(", ") || "(empty)"}<br/>Gold: ${inv.gold}</div>`;
    panel.innerHTML = `<h3 style="margin:0 0 6px;font-size:14px;">Inventory</h3>${itemsHtml}<hr style="border-color:#444;">${bagHtml}`;
  }

  private getActiveUnit(): UnitInstance | null {
    const cs = gameState.combat;
    if (!cs) return null;
    const id = cs.turnQueue[cs.activeIndex];
    return cs.units.find((u) => u.instanceId === id) ?? null;
  }

  private drawCanvas(): void {
    const cs = gameState.combat;
    if (!cs) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const activeUnit = this.getActiveUnit();

    const gridHexes = cs.gridKeys.map(parseHexKey);
    for (const hex of gridHexes) {
      renderHexOutline(ctx, hex, GRID_COLOR, 1);
    }

    let reachable: Map<string, number> | null = null;
    if (activeUnit && activeUnit.team === "hero" && activeUnit.movePointsRemaining > 0 && !cs.targetingActionId) {
      const occ = new Set(
        cs.units.filter((u) => u.hp > 0 && u.instanceId !== activeUnit.instanceId).map((u) => hexKey(u.pos)),
      );
      reachable = reachableHexes(activeUnit.pos, activeUnit.movePointsRemaining, occ, new Set(cs.gridKeys));
    }

    if (reachable) {
      for (const [key] of reachable) {
        fillHex(ctx, parseHexKey(key), REACHABLE_COLOR);
      }
    }

    if (cs.targetingActionId && activeUnit) {
      const actionDef = ACTION_REGISTRY[cs.targetingActionId];
      if (actionDef) {
        const targets = validTargets(actionDef, activeUnit, cs);
        for (const t of targets) {
          fillHex(ctx, t.pos, TARGET_COLOR);
        }
      }
    }

    if (this.hoveredHex && cs.gridKeys.includes(hexKey(this.hoveredHex))) {
      fillHex(ctx, this.hoveredHex, HOVER_COLOR);
    }

    for (const unit of cs.units) {
      if (unit.hp <= 0) continue;
      const isActive = activeUnit !== null && activeUnit.instanceId === unit.instanceId;
      this.drawUnitToken(ctx, unit, isActive);
    }
  }

  private drawUnitToken(ctx: CanvasRenderingContext2D, unit: UnitInstance, isActive: boolean): void {
    const px = 280 + 36 * (Math.sqrt(3) * unit.pos.q + (Math.sqrt(3) / 2) * unit.pos.r);
    const py = 220 + 36 * ((3 / 2) * unit.pos.r);
    const color = unit.team === "hero" ? HERO_COLOR : ENEMY_COLOR;

    if (isActive) {
      ctx.beginPath();
      ctx.arc(px, py, 15, 0, Math.PI * 2);
      ctx.strokeStyle = ACTIVE_GLOW;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();

    const initial = unit.displayName.charAt(0);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial, px, py);

    const hpPct = unit.hp / unit.stats.maxHp;
    const barW = 24;
    const barH = 3;
    const barX = px - barW / 2;
    const barY = py + 14;
    ctx.fillStyle = "#333";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hpPct > 0.5 ? "#4a4" : "#a44";
    ctx.fillRect(barX, barY, barW * Math.max(0, hpPct), barH);

    const condLabels: string[] = [];
    for (const c of unit.conditions) {
      if (c.id === "guarded") condLabels.push("G");
      else if (c.id === "weakened") condLabels.push("W");
      else if (c.id === "blessed") condLabels.push("B");
      else if (c.id === "slowed") condLabels.push("S");
    }
    if (condLabels.length > 0) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(condLabels.join(""), px + 13, py + 12);
    }
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hex = pixelToHex(x, y);
    const key = hexKey(hex);
    const cs = gameState.combat;
    if (cs && cs.gridKeys.includes(key)) {
      this.hoveredHex = hex;
    } else {
      this.hoveredHex = null;
    }
    this.drawCanvas();
  }

  private onCanvasClick(_e: MouseEvent): void {
    if (!this.hoveredHex) return;
    const hex = this.hoveredHex;
    const cs = gameState.combat;
    if (!cs || cs.status !== "active") return;

    const activeUnit = this.getActiveUnit();
    if (!activeUnit || activeUnit.team !== "hero") return;

    if (cs.targetingActionId) {
      this.handleTargetClick(hex, cs, activeUnit);
    } else if (activeUnit.movePointsRemaining > 0) {
      this.handleMoveClick(hex, cs, activeUnit);
    }
  }

  private handleTargetClick(hex: Hex, cs: CombatState, attacker: UnitInstance): void {
    const actionDef = ACTION_REGISTRY[cs.targetingActionId!];
    if (!actionDef) return;
    const targets = validTargets(actionDef, attacker, cs);
    const target = targets.find((t) => hexEquals(t.pos, hex));
    if (!target) return;

    resolveAction(actionDef, attacker, target, cs, gameState.rng);
    cs.targetingActionId = null;
    checkVictoryDefeat(cs);

    if (cs.status !== "active") {
      this.showBanner(cs.status === "victory" ? "Victory!" : "Defeat");
    }

    removeDefeatedFromQueue(cs);
    this.drawCanvas();
    this.updatePanels();
  }

  private handleMoveClick(hex: Hex, cs: CombatState, unit: UnitInstance): void {
    const occ = new Set(
      cs.units.filter((u) => u.hp > 0 && u.instanceId !== unit.instanceId).map((u) => hexKey(u.pos)),
    );
    const reachable = reachableHexes(unit.pos, unit.movePointsRemaining, occ, new Set(cs.gridKeys));
    const key = hexKey(hex);
    const cost = reachable.get(key);
    if (cost === undefined) return;

    unit.pos = { q: hex.q, r: hex.r };
    unit.movePointsRemaining -= cost;
    cs.log.push({
      kind: "move",
      text: `[T${cs.round}] ${unit.displayName} moves to (${hex.q}, ${hex.r}). ${unit.movePointsRemaining} move remaining.`,
      round: cs.round,
    });
    this.drawCanvas();
    this.updatePanels();
  }

  private onEndTurn(): void {
    if (this.enemyProcessing) return;
    const cs = gameState.combat;
    if (!cs || cs.status !== "active") return;

    cs.targetingActionId = null;
    this.advanceTurn();
    this.processTurns();
  }

  private advanceTurn(): void {
    const cs = gameState.combat;
    if (!cs) return;
    cs.activeIndex = (cs.activeIndex + 1) % cs.turnQueue.length;
    if (cs.activeIndex === 0) {
      cs.round++;
    }
    const active = this.getActiveUnit();
    if (active) {
      active.movePointsRemaining = active.stats.move;
      active.hasActed = false;
      const expired = processTurnStart(active);
      for (const condId of expired) {
        cs.log.push({
          kind: "turn_start",
          text: `[T${cs.round}] ${active.displayName}'s ${condId} expired.`,
          round: cs.round,
        });
      }
      cs.log.push({
        kind: "turn_start",
        text: `[T${cs.round}] ${active.displayName}'s turn begins.`,
        round: cs.round,
      });
    }
  }

  private async processTurns(): Promise<void> {
    const cs = gameState.combat;
    if (!cs) return;

    while (cs.status === "active") {
      const active = this.getActiveUnit();
      if (!active) break;
      if (active.team === "hero") break;

      this.enemyProcessing = true;
      this.setControlsEnabled(false);

      await this.delay(400);

      const refreshedActive = this.getActiveUnit();
      if (!refreshedActive) break;
      if (refreshedActive.instanceId !== active.instanceId) break;

      takeEnemyTurn(active, cs, gameState.rng);
      active.hasActed = true;

      checkVictoryDefeat(cs);
      if (cs.status !== "active") {
        this.drawCanvas();
        this.updatePanels();
        this.showBanner(cs.status === "victory" ? "Victory!" : "Defeat");
        this.setControlsEnabled(true);
        this.enemyProcessing = false;
        return;
      }

      removeDefeatedFromQueue(cs);
      this.advanceTurn();
      this.drawCanvas();
      this.updatePanels();
    }

    this.setControlsEnabled(true);
    this.enemyProcessing = false;
    this.drawCanvas();
    this.updatePanels();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private setControlsEnabled(enabled: boolean): void {
    if (this.endTurnBtn) this.endTurnBtn.disabled = !enabled;
    const actionBtns = this.container.querySelectorAll(".action-btn");
    for (const btn of actionBtns) {
      (btn as HTMLButtonElement).disabled = !enabled;
    }
  }

  private updatePanels(): void {
    this.updateTurnPanel();
    this.updateActionBar();
    this.updateLogPanel();
    this.updateEndTurnButton();
    this.updateInventoryPanel();
  }

  private updateTurnPanel(): void {
    const panel = this.turnPanelEl;
    if (!panel) return;
    const cs = gameState.combat;
    if (!cs) return;

    const title = panel.querySelector("h3")!;
    panel.innerHTML = "";
    panel.appendChild(title);

    const roundLabel = document.createElement("div");
    roundLabel.style.cssText = "font-size:12px;color:#888;margin-bottom:6px;";
    roundLabel.textContent = `Round ${cs.round}`;
    panel.appendChild(roundLabel);

    for (const id of cs.turnQueue) {
      const unit = cs.units.find((u) => u.instanceId === id);
      if (!unit) continue;
      const entry = document.createElement("div");
      entry.className = `turn-entry ${unit.team}`;
      if (cs.turnQueue[cs.activeIndex] === id && unit.hp > 0) {
        entry.classList.add("active");
      }
      const hpText = unit.hp > 0 ? `${unit.hp}/${unit.stats.maxHp}` : "DEFEATED";
      entry.textContent = `${unit.displayName} (${hpText})`;
      entry.style.textDecoration = unit.hp <= 0 ? "line-through" : "none";
      panel.appendChild(entry);
    }
  }

  private getActionIds(unit: UnitInstance): string[] {
    const enemyDef = unit.team === "enemy" ? null : null;
    const classDef = CLASS_REGISTRY[unit.defId];
    const classActions = classDef ? classDef.actionIds : [];
    const grantedActions: string[] = [];
    for (const slot of ["weapon", "armor", "trinket"] as const) {
      const itemId = unit.equippedItemIds[slot];
      if (!itemId) continue;
      const itemDef = ITEM_REGISTRY[itemId];
      if (itemDef?.grantedActionIds) {
        for (const aid of itemDef.grantedActionIds) {
          if (!grantedActions.includes(aid)) {
            grantedActions.push(aid);
          }
        }
      }
    }
    return [...classActions, ...grantedActions];
  }

  private updateActionBar(): void {
    const bar = this.actionBarEl;
    if (!bar) return;
    bar.innerHTML = "";

    const cs = gameState.combat;
    if (!cs || cs.status !== "active") return;

    const activeUnit = this.getActiveUnit();
    if (!activeUnit || activeUnit.team !== "hero") return;

    const actionIds = this.getActionIds(activeUnit);

    for (const actionId of actionIds) {
      const actionDef = ACTION_REGISTRY[actionId];
      if (!actionDef) continue;
      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.textContent = actionDef.displayName;

      const rangeInfo = actionDef.targetType === "self" ? "Self" : `Range ${actionDef.range}`;
      btn.title = `${actionDef.displayName} — ${rangeInfo}. ${actionDef.description}`;

      if (cs.targetingActionId === actionId) {
        btn.classList.add("targeting");
      }

      if (activeUnit.hasActed) {
        btn.classList.add("disabled");
        btn.title = "Already acted this turn";
      } else if (this.enemyProcessing) {
        btn.disabled = true;
      } else {
        const targets = validTargets(actionDef, activeUnit, cs);
        if (targets.length === 0) {
          btn.classList.add("disabled");
          btn.title = "No valid targets";
        } else {
          btn.addEventListener("click", () => {
            if (cs.targetingActionId === actionId) {
              cs.targetingActionId = null;
            } else {
              cs.targetingActionId = actionId;
            }
            this.updateActionBar();
            this.drawCanvas();
          });
        }
      }

      bar.appendChild(btn);
    }
  }

  private updateLogPanel(): void {
    const panel = this.logPanelEl;
    if (!panel) return;
    const cs = gameState.combat;
    if (!cs) return;
    panel.innerHTML = cs.log.slice(-20).map((e) => `<div>${e.text}</div>`).join("");
    panel.scrollTop = panel.scrollHeight;
  }

  private updateEndTurnButton(): void {
    const btn = this.endTurnBtn;
    if (!btn) return;
    const cs = gameState.combat;
    if (!cs || cs.status !== "active") {
      btn.disabled = true;
      return;
    }
    const active = this.getActiveUnit();
    btn.disabled = !active || active.team !== "hero" || this.enemyProcessing;
  }

  private showBanner(text: string): void {
    if (text === "Victory!") {
      if (gameState.run) {
        syncPartyFromCombat(gameState.combat!, gameState.run);
      }
      gameState.screen = "reward";
      this.app.render();
      return;
    }

    if (text === "Defeat" && gameState.run) {
      gameState.run.runStatus = "lost";
      gameState.screen = "run_summary";
      this.app.render();
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "banner-overlay";

    const banner = document.createElement("div");
    banner.className = "banner defeat";

    const title = document.createElement("h2");
    title.textContent = text;
    banner.appendChild(title);

    const btn = document.createElement("button");
    btn.textContent = "Continue";
    btn.addEventListener("click", () => {
      gameState.combat = null;
      gameState.screen = "main_menu";
      this.app.render();
    });
    banner.appendChild(btn);

    overlay.appendChild(banner);
    this.container.appendChild(overlay);
  }
}
