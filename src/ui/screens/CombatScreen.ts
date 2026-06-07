import * as THREE from "three";
import type { App } from "../App.ts";
import { gameState, initCombatState } from "../../state/GameState.ts";
import { syncPartyFromCombat } from "../../state/GameState.ts";
import type { BossTelegraph, CombatState, UnitInstance, Hex, ActionElement } from "../../state/types.ts";
import { distance, hexKey, parseHexKey, pixelToHex, hexEquals } from "../../core/hex.ts";
import { renderHexOutline, fillHex } from "../HexRenderer.ts";
import { reachableHexes } from "../../combat/Movement.ts";
import { ACTION_REGISTRY } from "../../data/actions.ts";
import type { ActionDef } from "../../data/actions.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import { validTargets, resolveAction, checkVictoryDefeat, removeDefeatedFromQueue } from "../../combat/Action.ts";
import { heroLifeState, resolveDeathSaveTurn } from "../../combat/DeathSaves.ts";
import { takeEnemyTurn } from "../../combat/EnemyAI.ts";
import { processTurnStart } from "../../combat/Condition.ts";
import { resolveOncePerCombatBonus } from "../../combat/ItemHooks.ts";
import { ITEM_REGISTRY, describeItem } from "../../data/items.ts";
import { BACKGROUND_REGISTRY, describeBackgroundEffect } from "../../data/backgrounds.ts";
import { ENEMY_REGISTRY } from "../../data/enemies.ts";
import { LEVELUP_OPTION_BY_ID } from "../../data/levelups.ts";
import { ARCHETYPE_REGISTRY } from "../../data/archetypes.ts";
import { getEnvironmentTheme, type EnvironmentThemeDef } from "../../data/environmentThemes.ts";
import { buildInspectPanelHtml } from "../CombatInspectPanel.ts";
import { CombatThreeRenderer, type Combat3DHighlights } from "../../render/combat3d/CombatThreeRenderer.ts";
import type { CombatAnimationStep } from "../../render/combat3d/animationQueue.ts";
import { axialToWorld } from "../../render/combat3d/hexWorld.ts";

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
  private inspectPanelEl!: HTMLElement;

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

    this.inspectPanelEl = this.buildInspectPanel();

    this.container.appendChild(this.telegraphBannerEl);
    this.container.appendChild(topRow);
    this.container.appendChild(this.inspectPanelEl);
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
          this.updateInspectPanel();
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
      this.updateInspectPanel();
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

  private buildInspectPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.id = "inspect-panel";
    panel.className = "inspect-panel";
    panel.style.display = "none";
    return panel;
  }

  private updateInspectPanel(): void {
    const panel = this.inspectPanelEl;
    if (!panel) return;
    const cs = gameState.combat;
    const hex = this.hoveredHex;
    const unit = hex && cs ? cs.units.find((u) => u.hp > 0 && hexEquals(u.pos, hex)) : null;
    if (!cs || !unit || unit.team !== "enemy") {
      panel.style.display = "none";
      return;
    }
    panel.innerHTML = buildInspectPanelHtml(unit, this.getInspectIntent(cs, unit));
    panel.style.display = "block";
  }

  private getInspectIntent(cs: CombatState, unit: UnitInstance): string | null {
    const telegraph = this.getLiveBossTelegraph(cs);
    if (telegraph && telegraph.sourceId === unit.instanceId) {
      const actionDef = ACTION_REGISTRY[telegraph.actionId];
      const name = actionDef?.displayName ?? "a heavy attack";
      return `Winding up ${name} — will strike the highlighted hexes next turn.`;
    }
    return null;
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
      const arch = h.archetypeId ? ARCHETYPE_REGISTRY[h.archetypeId] : undefined;
      const archHtml = arch ? `<br/>Archetype: ${arch.displayName}` : "";
      // Chosen level-up upgrades (F29) read from the persistent party member, shown per hero.
      const pm = gameState.run?.party.find((p) => p.instanceId === h.instanceId);
      const upgradeNames = (pm?.levelUpChoiceIds ?? [])
        .map((id) => LEVELUP_OPTION_BY_ID[id]?.name)
        .filter((n): n is string => !!n);
      const upgradesHtml = upgradeNames.length > 0 ? `<br/>Upgrades: ${upgradeNames.join(", ")}` : "";
      return `<div style="margin-bottom:6px;"><b>${h.displayName}</b>${bgHtml}${archHtml}${upgradesHtml}<br/>Weapon: ${w}${wDesc}<br/>Armor: ${a}${aDesc}<br/>Trinket: ${t}${tDesc}</div>`;
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
    this.drawFallbackEnvironment(ctx, w, h, getEnvironmentTheme(cs.theme));

    const gridHexes = cs.gridKeys.map(parseHexKey);
    const theme = getEnvironmentTheme(cs.theme);
    for (const hex of gridHexes) {
      fillHex(ctx, hex, theme.ground.fallbackFill);
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
      if (unit.team === "enemy" && unit.hp <= 0) continue;
      if (unit.team === "hero" && heroLifeState(unit) === "dead") continue;
      const isActive = activeUnit !== null && activeUnit.instanceId === unit.instanceId;
      this.drawUnitToken(ctx, unit, isActive);
    }
  }

  private drawFallbackEnvironment(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: EnvironmentThemeDef,
  ): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, theme.sky.topColor);
    gradient.addColorStop(0.58, theme.sky.horizonColor);
    gradient.addColorStop(1, theme.ground.baseColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.ground.lineColor;
    ctx.globalAlpha = 0.22;
    for (let x = -60; x < width; x += 90) {
      ctx.fillRect(x, height * 0.68, 70, height * 0.32);
    }
    ctx.globalAlpha = 1;
  }

  private getRenderHighlights(cs: CombatState, activeUnit: UnitInstance | null): Combat3DHighlights {
    const reachableKeys = new Set<string>();
    const targetKeys = new Set<string>();
    const telegraphKeys = new Set<string>();

    if (activeUnit && activeUnit.team === "hero" && activeUnit.movePointsRemaining > 0 && !cs.targetingActionId) {
      const occ = new Set(
        cs.units.filter((u) => {
          if (u.instanceId === activeUnit.instanceId) return false;
          if (u.hp > 0) return true;
          return u.team === "hero" && (u.heroLifeState === "downed" || u.heroLifeState === "stable");
        }).map((u) => hexKey(u.pos)),
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
    this.updateInspectPanel();
  }

  private onCanvasClick(): void {
    if (!this.hoveredHex) return;
    this.onHexClick(this.hoveredHex);
  }

  private onHexClick(hex: Hex): void {
    const cs = gameState.combat;
    if (!cs || cs.status !== "active") return;

    // Inspect works on any click — including during enemy turns or animations.
    this.hoveredHex = hex;
    this.updateInspectPanel();

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
    const result = resolveAction(actionDef, attacker, target, cs, gameState.rng);
    cs.targetingActionId = null;
    checkVictoryDefeat(cs);

    this.spawnActionVfx(actionDef, attacker, target, result);

    const deaths = defeatedUnitIds(before, cs);
    if (deaths.length > 0) {
      for (const deadId of deaths) {
        const dead = cs.units.find((u) => u.instanceId === deadId);
        if (dead) {
          const world = axialToWorld(dead.pos);
          const vfxPos = new THREE.Vector3(world.x, 0, world.z);
          this.combatRenderer?.vfxManager.spawnDeathBurst(vfxPos);
        }
      }
    }

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
      cs.units.filter((u) => {
        if (u.instanceId === unit.instanceId) return false;
        if (u.hp > 0) return true;
        return u.team === "hero" && (u.heroLifeState === "downed" || u.heroLifeState === "stable");
      }).map((u) => hexKey(u.pos)),
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

    const maxSkips = cs.turnQueue.length + 2;
    for (let i = 0; i < maxSkips; i++) {
      if (cs.turnQueue.length === 0) return;

      cs.activeIndex = (cs.activeIndex + 1) % cs.turnQueue.length;
      if (cs.activeIndex === 0) cs.round++;

      const active = this.getActiveUnit();
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
        if (result === "stable") {
          checkVictoryDefeat(cs);
          if (cs.status !== "active") return;
          continue;
        }
        if (result === "revived") {
          this.setupNormalTurnStart(active, cs);
          return;
        }
        // still_downed: skip
        continue;
      }

      if (ls === "stable") {
        cs.log.push({
          kind: "turn_start",
          text: `[T${cs.round}] ${active.displayName} is stable and cannot act this combat.`,
          round: cs.round,
        });
        checkVictoryDefeat(cs);
        if (cs.status !== "active") return;
        continue;
      }

      // Normal turn (standing hero or enemy).
      this.setupNormalTurnStart(active, cs);
      return;
    }
  }

  private setupNormalTurnStart(active: UnitInstance, cs: CombatState): void {
    active.movePointsRemaining = active.stats.move;
    active.hasActed = false;
    active.reactionUsedThisTurn = false;
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

  private async processTurns(): Promise<void> {
    const cs = gameState.combat;
    if (!cs) return;

    // Combat may have ended (e.g., from death saves) before the first enemy turn.
    if (cs.status !== "active") {
      this.drawCanvas();
      this.updatePanels();
      this.showBanner(cs.status === "victory" ? "Victory!" : "Defeat", cs);
      return;
    }

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

      this.spawnEnemyTurnVfx(active, before, cs);

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

    // Show banner if combat ended (e.g., all heroes died from death saves during advanceTurn).
    if (cs.status !== "active") {
      this.showBanner(cs.status === "victory" ? "Victory!" : "Defeat", cs);
    }
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

  private spawnActionVfx(
    action: ActionDef,
    attacker: UnitInstance,
    target: UnitInstance,
    result: { amount: number; isCrit: boolean; kind: "damage" | "heal" | "miss"; actionElement?: ActionElement },
  ): void {
    const renderer = this.combatRenderer;
    if (!renderer) return;

    const attackerWorld = axialToWorld(attacker.pos);
    const targetWorld = axialToWorld(target.pos);
    const atkPos = new THREE.Vector3(attackerWorld.x, 0, attackerWorld.z);
    const tgtPos = new THREE.Vector3(targetWorld.x, 0, targetWorld.z);

    const el = result.actionElement ?? actionElementForId(action.id);

    if (result.kind === "miss") {
      renderer.vfxManager.spawnFloatingNumber(tgtPos, 0, "miss", false);
      return;
    }

    if (result.kind === "heal") {
      renderer.vfxManager.spawnSparkle(tgtPos, 4);
      renderer.vfxManager.spawnFloatingNumber(tgtPos, result.amount, "heal", false);
      return;
    }

    const isMelee = action.range <= 1;
    if (!isMelee) {
      renderer.vfxManager.spawnProjectile(atkPos, tgtPos, el);
    }
    renderer.vfxManager.spawnBurst(tgtPos, el);
    renderer.vfxManager.spawnFloatingNumber(tgtPos, result.amount, "damage", result.isCrit);

    if (result.isCrit) {
      renderer.vfxManager.startCameraShake();
    }

    if (action.effect.type === "applyCondition" || (action.effect.type === "damage" && action.effect.applyCondition)) {
      renderer.vfxManager.spawnShieldFlash(tgtPos);
    }
  }

  private spawnEnemyTurnVfx(
    active: UnitInstance,
    before: CombatSnapshot,
    cs: CombatState,
  ): void {
    const renderer = this.combatRenderer;
    if (!renderer) return;

    const changed = changedUnitIds(before, cs).filter((id) => id !== active.instanceId);
    const damaged = changed.filter((unitId) => hpDelta(before, cs, unitId) < 0);
    const healed = changed.filter((unitId) => hpDelta(before, cs, unitId) > 0);
    const deaths = defeatedUnitIds(before, cs);
    const newLogs = cs.log.slice(before.logLength);
    const actionLogged = newLogs.some((entry) => entry.kind === "action" && entry.text.includes(active.displayName));
    const el = actionElementForId(actionLogged ? guessActionIdFromLogs(newLogs) : "");

    for (const unitId of damaged) {
      const unit = cs.units.find((u) => u.instanceId === unitId);
      if (!unit) continue;
      const world = axialToWorld(unit.pos);
      const pos = new THREE.Vector3(world.x, 0, world.z);
      const activeWorld = axialToWorld(active.pos);
      const atkPos = new THREE.Vector3(activeWorld.x, 0, activeWorld.z);
      renderer.vfxManager.spawnProjectile(atkPos, pos, el);
      renderer.vfxManager.spawnBurst(pos, el);
      const delta = Math.abs(hpDelta(before, cs, unitId));
      renderer.vfxManager.spawnFloatingNumber(pos, delta, "damage", false);
    }

    for (const unitId of healed) {
      const unit = cs.units.find((u) => u.instanceId === unitId);
      if (!unit) continue;
      const world = axialToWorld(unit.pos);
      const pos = new THREE.Vector3(world.x, 0, world.z);
      renderer.vfxManager.spawnSparkle(pos, 3);
      const delta = hpDelta(before, cs, unitId);
      renderer.vfxManager.spawnFloatingNumber(pos, delta, "heal", false);
    }

    for (const deadId of deaths) {
      const dead = cs.units.find((u) => u.instanceId === deadId);
      if (dead) {
        const world = axialToWorld(dead.pos);
        const pos = new THREE.Vector3(world.x, 0, world.z);
        renderer.vfxManager.spawnDeathBurst(pos);
      }
    }
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
      const hpText = heroTurnPanelLabel(unit);
      let label = `${unit.displayName} (${hpText})`;
      if (unit.archetypeId) {
        const archDef = ARCHETYPE_REGISTRY[unit.archetypeId];
        if (archDef) label = `${unit.displayName} [${archDef.displayName}] (${hpText})`;
      }
      entry.textContent = label;
      entry.style.textDecoration = (unit.team === "enemy" ? unit.hp <= 0 : heroLifeState(unit) === "dead") ? "line-through" : "none";
      panel.appendChild(entry);
    }
  }

  private getActionIds(unit: UnitInstance): string[] {
    if (unit.team !== "hero") {
      const enemyDef = ENEMY_REGISTRY[unit.defId];
      return enemyDef ? [...enemyDef.actionIds] : [];
    }
    const classDef = CLASS_REGISTRY[unit.defId];
    const cantrips = classDef
      ? classDef.actionIds.filter((aid) => {
          const a = ACTION_REGISTRY[aid];
          return a?.isCantrip || a?.resourceType === "spell_slot";
        })
      : [];
    const prepared = unit.preparedActionIds ?? [];
    const grantedActions: string[] = [];
    // Archetype action.
    if (unit.archetypeId) {
      const archDef = ARCHETYPE_REGISTRY[unit.archetypeId];
      if (archDef?.grantedActionId && !grantedActions.includes(archDef.grantedActionId)) {
        grantedActions.push(archDef.grantedActionId);
      }
    }
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
    const seen = new Set<string>();
    const result: string[] = [];
    for (const aid of [...cantrips, ...prepared, ...grantedActions]) {
      if (!seen.has(aid)) {
        seen.add(aid);
        result.push(aid);
      }
    }
    return result;
  }

  private updateActionBar(): void {
    const bar = this.actionBarEl;
    if (!bar) return;
    bar.innerHTML = "";

    const cs = gameState.combat;
    if (!cs || cs.status !== "active") return;

    const activeUnit = this.getActiveUnit();
    if (!activeUnit || activeUnit.team !== "hero") return;

    // Downed/stable heroes cannot act — show status text instead of buttons.
    const ls = heroLifeState(activeUnit);
    if (ls === "downed" || ls === "stable") {
      const msg = document.createElement("div");
      msg.style.cssText = "padding:6px;color:#aaa;font-style:italic;";
      msg.textContent = ls === "downed" ? "Rolling death save…" : "Stable — cannot act this combat.";
      bar.appendChild(msg);
      return;
    }

    const actionIds = this.getActionIds(activeUnit);

    for (const actionId of actionIds) {
      const actionDef = ACTION_REGISTRY[actionId];
      if (!actionDef) continue;
      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.textContent = actionDef.displayName;

      const rangeInfo = actionDef.targetType === "self" ? "Self" : `Range ${actionDef.range}`;
      btn.title = `${actionDef.displayName} — ${rangeInfo}. ${actionDef.description}`;

      const isSpellSlot = actionDef.resourceType === "spell_slot";
      const slotCost = actionDef.slotCost ?? 1;
      const slotsLeft = activeUnit.spellSlotsRemaining ?? 0;
      const noSlots = isSpellSlot && slotsLeft < slotCost;
      if (isSpellSlot) {
        btn.textContent = `${actionDef.displayName} (${slotsLeft})`;
      }

      if (cs.targetingActionId === actionId) {
        btn.classList.add("targeting");
      }

      const chargesLeft = (cs.perEncounterUses as Record<string, number>)[actionId] ?? -1;
      const noCharges = actionDef.charges !== undefined && chargesLeft <= 0;

      if (this.animationBlocking || this.enemyProcessing) {
        btn.disabled = true;
        btn.title = "Animation playing";
      } else if (activeUnit.hasActed) {
        btn.classList.add("disabled");
        btn.disabled = true;
        btn.title = "Already acted this turn";
      } else if (noCharges) {
        btn.classList.add("disabled");
        btn.disabled = true;
        btn.title = "No charges remaining this encounter";
      } else if (noSlots) {
        btn.classList.add("disabled");
        btn.disabled = true;
        btn.title = "No spell slots remaining — Long Rest to recover.";
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

function heroTurnPanelLabel(unit: UnitInstance): string {
  if (unit.team === "enemy") {
    return unit.hp > 0 ? `${unit.hp}/${unit.stats.maxHp}` : "DEFEATED";
  }
  const ls = heroLifeState(unit);
  if (ls === "downed") {
    const s = unit.deathSaves?.successes ?? 0;
    const f = unit.deathSaves?.failures ?? 0;
    return `DOWNED ${s}S/${f}F`;
  }
  if (ls === "stable") return "STABLE";
  if (ls === "dead") return "DEAD";
  return unit.hp > 0 ? `${unit.hp}/${unit.stats.maxHp}` : `${unit.hp}/${unit.stats.maxHp}`;
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
      if (!prev || prev.hp <= 0 || unit.hp > 0) return false;
      if (unit.team === "hero") {
        // Heroes that just became downed are NOT defeated — only confirmed dead.
        return heroLifeState(unit) === "dead";
      }
      return true;
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

function guessActionIdFromLogs(logs: { text: string }[]): string {
  for (const entry of logs) {
    const match = entry.text.match(/(action\.\w+)/);
    if (match) return match[1];
  }
  return "";
}

function actionElementForId(actionId: string): ActionElement {
  if (actionId.includes("fire")) return "fire";
  if (actionId.includes("frost") || actionId.includes("ice")) return "frost";
  if (actionId.includes("arcane") || actionId.includes("bless") || actionId.includes("ward")) return "arcane";
  if (actionId.includes("heal") || actionId.includes("mend")) return "heal";
  if (actionId.includes("dark") || actionId.includes("roar")) return "dark";
  return "physical";
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

  if (action.effect.type === "heal" && action.effect.targetMode === "aoe_around_caster") {
    return cs.units
      .filter((unit) => unit.team === attacker.team && distance(attacker.pos, unit.pos) <= action.range)
      .map((unit) => hexKey(unit.pos));
  }

  return [];
}
