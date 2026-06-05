import type { App } from "../App.ts";
import { gameState, initCombatState } from "../../state/GameState.ts";
import { syncPartyFromCombat } from "../../state/GameState.ts";
import type { BossTelegraph, CombatState, UnitInstance, Hex } from "../../state/types.ts";
import { distance, hexKey, parseHexKey, pixelToHex, hexEquals } from "../../core/hex.ts";
import { renderHexOutline, fillHex } from "../HexRenderer.ts";
import { reachableHexes } from "../../combat/Movement.ts";
import { ACTION_REGISTRY } from "../../data/actions.ts";
import type { ActionDef } from "../../data/actions.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import { validTargets, resolveAction, checkVictoryDefeat, removeDefeatedFromQueue } from "../../combat/Action.ts";
import { takeEnemyTurn } from "../../combat/EnemyAI.ts";
import { processTurnStart } from "../../combat/Condition.ts";
import { resolveOncePerCombatBonus } from "../../combat/ItemHooks.ts";
import { ITEM_REGISTRY, describeItem } from "../../data/items.ts";
import { BACKGROUND_REGISTRY, describeBackgroundEffect } from "../../data/backgrounds.ts";
import { ENEMY_REGISTRY } from "../../data/enemies.ts";
import { LEVELUP_OPTION_BY_ID } from "../../data/levelups.ts";
import { CombatThreeRenderer, type Combat3DHighlights } from "../../render/combat3d/CombatThreeRenderer.ts";
import type { CombatAnimationStep } from "../../render/combat3d/animationQueue.ts";

const HERO_COLOR = "#4488ff";
const ENEMY_COLOR = "#ff4444";
const GRID_COLOR = "#555";
const HOVER_COLOR = "rgba(255,255,0,0.15)";
const REACHABLE_COLOR = "rgba(0,200,100,0.2)";
const TARGET_COLOR = "rgba(255,50,50,0.35)";
const TELEGRAPH_COLOR = "rgba(255,140,0,0.45)";
const ACTIVE_GLOW = "#ffcc00";

interface UnitSnapshot {
  hp: number;
  pos: Hex;
  conditions: string;
}

interface CombatSnapshot {
  units: Map<string, UnitSnapshot>;
  logLength: number;
}

export class CombatScreen {
  private app: App;
  private container!: HTMLElement;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private combatRenderer: CombatThreeRenderer | null = null;
  private hoveredHex: Hex | null = null;
  private enemyProcessing = false;
  private animationBlocking = false;
  private animationSpeed = 1;
  private actionBarEl!: HTMLElement;
  private turnPanelEl!: HTMLElement;
  private logPanelEl!: HTMLElement;
  private endTurnBtn!: HTMLButtonElement;
  private animSpeedBtn!: HTMLButtonElement;
  private skipAnimBtn!: HTMLButtonElement;
  private inventoryPanelEl!: HTMLElement;
  private invToggleBtn!: HTMLButtonElement;
  private telegraphBannerEl!: HTMLElement;

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
    this.mountCombatView(canvasWrap);

    this.turnPanelEl = this.buildTurnPanel();
    topRow.appendChild(canvasWrap);
    topRow.appendChild(this.turnPanelEl);

    this.actionBarEl = this.buildActionBar();
    this.logPanelEl = this.buildLogPanel();
    const endTurnBar = this.buildEndTurnBar();
    this.inventoryPanelEl = this.buildInventoryPanel();

    this.telegraphBannerEl = document.createElement("div");
    this.telegraphBannerEl.className = "telegraph-banner";
    this.telegraphBannerEl.style.cssText =
      "display:none;background:rgba(255,140,0,0.9);color:#1a1a1a;font-weight:bold;text-align:center;padding:6px;border-radius:4px;margin:4px 0;";

    this.container.appendChild(this.telegraphBannerEl);
    this.container.appendChild(topRow);
    this.container.appendChild(this.actionBarEl);
    this.container.appendChild(this.logPanelEl);
    this.container.appendChild(endTurnBar);
    this.container.appendChild(this.inventoryPanelEl);

    this.drawCanvas();
    this.updatePanels();

    const cs = gameState.combat;
    if (cs && cs.status !== "active") {
      this.showBanner(cs.status === "victory" ? "Victory!" : "Defeat");
    }

    if (this.getActiveUnit()?.team === "enemy") {
      this.processTurns();
    }

    return this.container;
  }

  private mountCombatView(canvasWrap: HTMLElement): void {
    try {
      this.combatRenderer = new CombatThreeRenderer(canvasWrap, {
        onPickHex: (hex) => this.onHexClick(hex),
        onHoverHex: (hex) => {
          this.hoveredHex = hex;
          this.drawCanvas();
        },
        onAnimationStateChange: (animating) => {
          this.animationBlocking = animating;
          this.setControlsEnabled(!animating && !this.enemyProcessing);
          this.updateEndTurnButton();
          this.updateActionBar();
        },
      });
      this.combatRenderer.setAnimationSpeed(this.animationSpeed);
      return;
    } catch (err) {
      this.combatRenderer = null;
      canvasWrap.setAttribute("data-renderer-fallback", "canvas");
      canvasWrap.title = `Using canvas fallback: ${err instanceof Error ? err.message : "WebGL initialization failed"}`;
    }

    this.canvas = document.createElement("canvas");
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext("2d");
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
    canvasWrap.appendChild(this.canvas);

    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("click", () => this.onCanvasClick());
    this.canvas.addEventListener("mouseleave", () => {
      this.hoveredHex = null;
      this.drawCanvas();
    });
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
    this.animSpeedBtn = document.createElement("button");
    this.animSpeedBtn.textContent = "Anim 1x";
    this.animSpeedBtn.title = "Animation speed";
    this.animSpeedBtn.addEventListener("click", () => this.cycleAnimationSpeed());
    bar.appendChild(this.animSpeedBtn);
    this.skipAnimBtn = document.createElement("button");
    this.skipAnimBtn.textContent = "Skip Anim";
    this.skipAnimBtn.title = "Skip current combat animations";
    this.skipAnimBtn.addEventListener("click", () => this.skipAnimations());
    bar.appendChild(this.skipAnimBtn);
    return bar;
  }

  private cycleAnimationSpeed(): void {
    const speeds = [1, 1.5, 2, 4];
    const idx = speeds.indexOf(this.animationSpeed);
    this.animationSpeed = speeds[(idx + 1) % speeds.length] ?? 1;
    if (this.combatRenderer) {
      this.combatRenderer.setAnimationSpeed(this.animationSpeed);
    }
    if (this.animSpeedBtn) {
      this.animSpeedBtn.textContent = `Anim ${this.animationSpeed}x`;
    }
  }

  private skipAnimations(): void {
    this.combatRenderer?.skipAnimations();
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
      const wItem = h.equippedItemIds.weapon ? ITEM_REGISTRY[h.equippedItemIds.weapon] : null;
      const aItem = h.equippedItemIds.armor ? ITEM_REGISTRY[h.equippedItemIds.armor] : null;
      const tItem = h.equippedItemIds.trinket ? ITEM_REGISTRY[h.equippedItemIds.trinket] : null;
      const w = wItem?.displayName ?? h.equippedItemIds.weapon ?? "(none)";
      const a = aItem?.displayName ?? h.equippedItemIds.armor ?? "(none)";
      const t = tItem?.displayName ?? h.equippedItemIds.trinket ?? "(none)";
      const wDesc = wItem?.flavorText ? `<br/><span style="font-size:10px;color:#999;">${wItem.flavorText}</span>` : "";
      const aDesc = aItem?.flavorText ? `<br/><span style="font-size:10px;color:#999;">${aItem.flavorText}</span>` : "";
      const tDesc = tItem?.flavorText ? `<br/><span style="font-size:10px;color:#999;">${tItem.flavorText}</span>` : "";
      const bg = h.backgroundId ? BACKGROUND_REGISTRY[h.backgroundId] : undefined;
      const bgHtml = bg ? `<br/>Background: ${bg.displayName} (${describeBackgroundEffect(bg)})` : "";
      // Chosen level-up upgrades (F29) read from the persistent party member, shown per hero.
      const pm = gameState.run?.party.find((p) => p.instanceId === h.instanceId);
      const upgradeNames = (pm?.levelUpChoiceIds ?? [])
        .map((id) => LEVELUP_OPTION_BY_ID[id]?.name)
        .filter((n): n is string => !!n);
      const upgradesHtml = upgradeNames.length > 0 ? `<br/>Upgrades: ${upgradeNames.join(", ")}` : "";
      return `<div style="margin-bottom:6px;"><b>${h.displayName}</b>${bgHtml}${upgradesHtml}<br/>Weapon: ${w}${wDesc}<br/>Armor: ${a}${aDesc}<br/>Trinket: ${t}${tDesc}</div>`;
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
    const activeUnit = this.getActiveUnit();
    const highlights = this.getRenderHighlights(cs, activeUnit);

    if (this.combatRenderer) {
      this.combatRenderer.update(cs, highlights);
      return;
    }

    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const gridHexes = cs.gridKeys.map(parseHexKey);
    for (const hex of gridHexes) {
      renderHexOutline(ctx, hex, GRID_COLOR, 1);
    }

    for (const key of highlights.reachableKeys) {
      fillHex(ctx, parseHexKey(key), REACHABLE_COLOR);
    }

    for (const key of highlights.targetKeys) {
      fillHex(ctx, parseHexKey(key), TARGET_COLOR);
    }

    for (const key of highlights.telegraphKeys) {
      fillHex(ctx, parseHexKey(key), TELEGRAPH_COLOR);
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

  private getRenderHighlights(cs: CombatState, activeUnit: UnitInstance | null): Combat3DHighlights {
    const reachableKeys = new Set<string>();
    const targetKeys = new Set<string>();
    const telegraphKeys = new Set<string>();

    if (activeUnit && activeUnit.team === "hero" && activeUnit.movePointsRemaining > 0 && !cs.targetingActionId) {
      const occ = new Set(
        cs.units.filter((u) => u.hp > 0 && u.instanceId !== activeUnit.instanceId).map((u) => hexKey(u.pos)),
      );
      for (const [key] of reachableHexes(activeUnit.pos, activeUnit.movePointsRemaining, occ, new Set(cs.gridKeys))) {
        reachableKeys.add(key);
      }
    }

    if (cs.targetingActionId && activeUnit) {
      const actionDef = ACTION_REGISTRY[cs.targetingActionId];
      if (actionDef) {
        for (const target of validTargets(actionDef, activeUnit, cs)) {
          targetKeys.add(hexKey(target.pos));
        }
      }
    }

    const bossTelegraph = this.getLiveBossTelegraph(cs);
    if (bossTelegraph) {
      for (const key of bossTelegraph.targetHexes) {
        telegraphKeys.add(key);
      }
    }

    return {
      hoveredHex: this.hoveredHex,
      reachableKeys,
      targetKeys,
      telegraphKeys,
    };
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
      else if (c.id === "rallied") condLabels.push("R");
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
    if (!this.canvas) return;
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

  private onCanvasClick(): void {
    if (!this.hoveredHex) return;
    this.onHexClick(this.hoveredHex);
  }

  private onHexClick(hex: Hex): void {
    const cs = gameState.combat;
    if (!cs || cs.status !== "active") return;
    if (this.animationBlocking || this.enemyProcessing) return;

    const activeUnit = this.getActiveUnit();
    if (!activeUnit || activeUnit.team !== "hero") return;

    if (cs.targetingActionId) {
      this.handleTargetClick(hex, cs, activeUnit);
    } else if (activeUnit.movePointsRemaining > 0) {
      this.handleMoveClick(hex, cs, activeUnit);
    }
  }

  private async handleTargetClick(hex: Hex, cs: CombatState, attacker: UnitInstance): Promise<void> {
    const actionDef = ACTION_REGISTRY[cs.targetingActionId!];
    if (!actionDef) return;
    const targets = validTargets(actionDef, attacker, cs);
    const target = targets.find((t) => hexEquals(t.pos, hex));
    if (!target) return;

    const before = snapshotCombat(cs);
    resolveAction(actionDef, attacker, target, cs, gameState.rng);
    cs.targetingActionId = null;
    checkVictoryDefeat(cs);

    removeDefeatedFromQueue(cs);
    this.drawCanvas();
    this.updatePanels();
    const animation = this.playAnimationSteps(this.buildActionAnimationSteps(actionDef, attacker, target, before, cs));
    if (animation) await animation;

    if (cs.status !== "active" && gameState.combat === cs) {
      this.showBanner(cs.status === "victory" ? "Victory!" : "Defeat", cs);
    }
  }

  private async handleMoveClick(hex: Hex, cs: CombatState, unit: UnitInstance): Promise<void> {
    const occ = new Set(
      cs.units.filter((u) => u.hp > 0 && u.instanceId !== unit.instanceId).map((u) => hexKey(u.pos)),
    );
    const reachable = reachableHexes(unit.pos, unit.movePointsRemaining, occ, new Set(cs.gridKeys));
    const key = hexKey(hex);
    const cost = reachable.get(key);
    if (cost === undefined) return;

    const from = { ...unit.pos };
    unit.pos = { q: hex.q, r: hex.r };
    unit.movePointsRemaining -= cost;
    cs.log.push({
      kind: "move",
      text: `[T${cs.round}] ${unit.displayName} moves to (${hex.q}, ${hex.r}). ${unit.movePointsRemaining} move remaining.`,
      round: cs.round,
    });
    this.drawCanvas();
    this.updatePanels();
    const animation = this.playAnimationSteps({ kind: "move", unitId: unit.instanceId, from, to: { ...unit.pos } });
    if (animation) await animation;
  }

  private onEndTurn(): void {
    if (this.enemyProcessing || this.animationBlocking) return;
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
      // Item hook: first-turn bonus on round 1 (e.g. Quickstep Buckle).
      if (cs.round === 1 && active.team === "hero") {
        const turnResult = resolveOncePerCombatBonus(active, "firstTurn", cs);
        if (turnResult.moveBonus) {
          active.movePointsRemaining += turnResult.moveBonus;
        }
      }
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

      const before = snapshotCombat(cs);
      const pendingTelegraphHexes = cs.bossTelegraph?.targetHexes ? [...cs.bossTelegraph.targetHexes] : [];
      takeEnemyTurn(active, cs, gameState.rng);
      active.hasActed = true;

      checkVictoryDefeat(cs);
      this.drawCanvas();
      this.updatePanels();
      const animation = this.playAnimationSteps(this.buildEnemyAnimationSteps(active, before, cs, pendingTelegraphHexes));
      if (animation) await animation;

      if (cs.status !== "active") {
        this.drawCanvas();
        this.updatePanels();
        this.showBanner(cs.status === "victory" ? "Victory!" : "Defeat", cs);
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

  private playAnimationSteps(steps: CombatAnimationStep | CombatAnimationStep[]): Promise<void> | null {
    const list = (Array.isArray(steps) ? steps : [steps]).filter((step) => {
      if (step.kind === "wait") return step.durationMs > 0;
      if ("unitIds" in step) return step.unitIds.length > 0;
      if (step.kind === "attack") return step.targetIds.length > 0;
      if (step.kind === "aoeFlash") return step.hexKeys.length > 0;
      return true;
    });
    if (!this.combatRenderer || list.length === 0) return null;
    return this.combatRenderer.enqueueAnimations(list);
  }

  private buildActionAnimationSteps(
    action: ActionDef,
    attacker: UnitInstance,
    target: UnitInstance,
    before: CombatSnapshot,
    cs: CombatState,
  ): CombatAnimationStep[] {
    const steps: CombatAnimationStep[] = [];
    const changed = changedUnitIds(before, cs);
    const damaged = changed.filter((unitId) => hpDelta(before, cs, unitId) < 0);
    const healed = changed.filter((unitId) => hpDelta(before, cs, unitId) > 0);
    const conditioned = changed.filter((unitId) => conditionsChanged(before, cs, unitId));
    const deaths = defeatedUnitIds(before, cs);
    const targetIds = uniqueIds([target.instanceId, ...changed.filter((id) => id !== attacker.instanceId)]);
    const frame = action.effect.type === "heal" || action.effect.type === "applyCondition" ? "cast" : "attack";
    const aoeHexes = aoeHexKeysForAction(action, attacker, target, before, cs);

    if (aoeHexes.length > 0) {
      steps.push({ kind: "aoeFlash", hexKeys: aoeHexes });
    }
    steps.push({ kind: "attack", attackerId: attacker.instanceId, targetIds, frame });

    if (action.effect.type === "heal") {
      steps.push({ kind: "heal", unitIds: healed.length > 0 ? healed : [target.instanceId] });
    } else if (action.effect.type === "applyCondition") {
      steps.push({ kind: "heal", unitIds: conditioned.length > 0 ? conditioned : targetIds });
    } else if (damaged.length > 0) {
      steps.push({ kind: "hit", unitIds: damaged });
    } else {
      steps.push({ kind: "miss", unitIds: [target.instanceId] });
    }

    if (deaths.length > 0) {
      steps.push({ kind: "death", unitIds: deaths });
    }
    return steps;
  }

  private buildEnemyAnimationSteps(
    active: UnitInstance,
    before: CombatSnapshot,
    cs: CombatState,
    pendingTelegraphHexes: string[],
  ): CombatAnimationStep[] {
    const steps: CombatAnimationStep[] = [];
    const activeBefore = before.units.get(active.instanceId);
    if (activeBefore && !hexEquals(activeBefore.pos, active.pos)) {
      steps.push({ kind: "move", unitId: active.instanceId, from: activeBefore.pos, to: { ...active.pos } });
    }

    const changed = changedUnitIds(before, cs).filter((id) => id !== active.instanceId);
    const damaged = changed.filter((unitId) => hpDelta(before, cs, unitId) < 0);
    const healed = changed.filter((unitId) => hpDelta(before, cs, unitId) > 0);
    const conditioned = changed.filter((unitId) => conditionsChanged(before, cs, unitId));
    const deaths = defeatedUnitIds(before, cs);
    const newLogs = cs.log.slice(before.logLength);
    const actionLogged = newLogs.some((entry) => entry.kind === "action" && entry.text.includes(active.displayName));
    const targetIds = uniqueIds(changed.length > 0 ? changed : nearestOpposingTargetIds(active, cs));

    if (pendingTelegraphHexes.length > 0 && (damaged.length > 0 || conditioned.length > 0 || actionLogged)) {
      steps.push({ kind: "aoeFlash", hexKeys: pendingTelegraphHexes });
    }
    if (targetIds.length > 0 && actionLogged) {
      steps.push({ kind: "attack", attackerId: active.instanceId, targetIds, frame: healed.length > 0 || conditioned.length > 0 ? "cast" : "attack" });
    }
    if (healed.length > 0) {
      steps.push({ kind: "heal", unitIds: healed });
    }
    if (conditioned.length > 0 && healed.length === 0) {
      steps.push({ kind: "heal", unitIds: conditioned });
    }
    if (damaged.length > 0) {
      steps.push({ kind: "hit", unitIds: damaged });
    } else if (actionLogged && targetIds.length > 0 && newLogs.some((entry) => entry.text.toLowerCase().includes("miss"))) {
      steps.push({ kind: "miss", unitIds: targetIds });
    }
    if (deaths.length > 0) {
      steps.push({ kind: "death", unitIds: deaths });
    }
    return steps;
  }

  private setControlsEnabled(enabled: boolean): void {
    const controlsEnabled = enabled && !this.animationBlocking;
    if (this.endTurnBtn) this.endTurnBtn.disabled = !controlsEnabled;
    const actionBtns = this.container.querySelectorAll(".action-btn");
    for (const btn of actionBtns) {
      (btn as HTMLButtonElement).disabled = !controlsEnabled;
    }
  }

  private updatePanels(): void {
    this.updateTurnPanel();
    this.updateActionBar();
    this.updateLogPanel();
    this.updateEndTurnButton();
    this.updateInventoryPanel();
    this.updateTelegraphBanner();
  }

  private updateTelegraphBanner(): void {
    const banner = this.telegraphBannerEl;
    if (!banner) return;
    const cs = gameState.combat;
    if (cs && this.getLiveBossTelegraph(cs)) {
      banner.textContent = "⚠ Ground Slam incoming — clear the highlighted hexes!";
      banner.style.display = "block";
    } else {
      banner.style.display = "none";
    }
  }

  private getLiveBossTelegraph(cs: CombatState): BossTelegraph | null {
    const telegraph = cs.bossTelegraph;
    if (!telegraph) return null;
    return cs.units.some((u) => u.instanceId === telegraph.sourceId && u.hp > 0) ? telegraph : null;
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

      if (this.animationBlocking || this.enemyProcessing) {
        btn.disabled = true;
        btn.title = "Animation playing";
      } else if (activeUnit.hasActed) {
        btn.classList.add("disabled");
        btn.disabled = true;
        btn.title = "Already acted this turn";
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
    btn.disabled = !active || active.team !== "hero" || this.enemyProcessing || this.animationBlocking;
  }

  private showBanner(text: string, combatForSync: CombatState | null = gameState.combat): void {
    if (text === "Victory!") {
      if (gameState.run && combatForSync) {
        syncPartyFromCombat(combatForSync, gameState.run);
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

function snapshotCombat(cs: CombatState): CombatSnapshot {
  return {
    units: new Map(
      cs.units.map((unit) => [
        unit.instanceId,
        {
          hp: unit.hp,
          pos: { ...unit.pos },
          conditions: conditionSignature(unit),
        },
      ]),
    ),
    logLength: cs.log.length,
  };
}

function changedUnitIds(before: CombatSnapshot, cs: CombatState): string[] {
  return cs.units
    .filter((unit) => {
      const prev = before.units.get(unit.instanceId);
      if (!prev) return false;
      return prev.hp !== unit.hp || prev.conditions !== conditionSignature(unit);
    })
    .map((unit) => unit.instanceId);
}

function hpDelta(before: CombatSnapshot, cs: CombatState, unitId: string): number {
  const prev = before.units.get(unitId);
  const unit = cs.units.find((u) => u.instanceId === unitId);
  if (!prev || !unit) return 0;
  return unit.hp - prev.hp;
}

function conditionsChanged(before: CombatSnapshot, cs: CombatState, unitId: string): boolean {
  const prev = before.units.get(unitId);
  const unit = cs.units.find((u) => u.instanceId === unitId);
  if (!prev || !unit) return false;
  return prev.conditions !== conditionSignature(unit);
}

function defeatedUnitIds(before: CombatSnapshot, cs: CombatState): string[] {
  return cs.units
    .filter((unit) => {
      const prev = before.units.get(unit.instanceId);
      return prev !== undefined && prev.hp > 0 && unit.hp <= 0;
    })
    .map((unit) => unit.instanceId);
}

function conditionSignature(unit: UnitInstance): string {
  return unit.conditions
    .map((condition) => `${condition.id}:${condition.remainingTurns}`)
    .sort()
    .join("|");
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function nearestOpposingTargetIds(active: UnitInstance, cs: CombatState): string[] {
  const target = cs.units
    .filter((unit) => unit.hp > 0 && unit.team !== active.team)
    .sort((a, b) => {
      const dist = distance(active.pos, a.pos) - distance(active.pos, b.pos);
      return dist !== 0 ? dist : a.instanceId.localeCompare(b.instanceId);
    })[0];
  return target ? [target.instanceId] : [];
}

function aoeHexKeysForAction(
  action: ActionDef,
  attacker: UnitInstance,
  target: UnitInstance,
  before: CombatSnapshot,
  cs: CombatState,
): string[] {
  if (action.effect.type === "damage" && action.effect.targetMode === "primary_plus_adjacent") {
    const damaged = changedUnitIds(before, cs)
      .filter((unitId) => hpDelta(before, cs, unitId) < 0)
      .map((unitId) => cs.units.find((unit) => unit.instanceId === unitId))
      .filter((unit): unit is UnitInstance => !!unit)
      .map((unit) => hexKey(unit.pos));
    return uniqueIds([hexKey(target.pos), ...damaged]);
  }

  if (action.effect.type === "applyCondition" && action.effect.targetMode === "aoe_around_caster") {
    return cs.units
      .filter((unit) => unit.team !== attacker.team && distance(attacker.pos, unit.pos) <= action.range)
      .map((unit) => hexKey(unit.pos));
  }

  return [];
}
