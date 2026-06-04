import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import type { PartyMember } from "../../state/RunState.ts";
import { EVENT_REGISTRY } from "../../data/events.ts";
import type { EventDef, EventChoice, CheckEffect } from "../../data/events.ts";
import { applyEventChoiceEffects, applyStatBoost, resolveCheckEffect } from "../../run/Events.ts";
import { checkModifierFor, rollNeeded, pickBestHero } from "../../run/AbilityCheck.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";

// Screen state lives at module scope because App rebuilds the EventScreen instance on every
// render; per-instance fields would reset the picker/result phase between clicks. `activeNodeId`
// scopes the state to one event node so a fresh event always starts back at the choice menu.
let phase: "menu" | "picker" | "result" = "menu";
let resultMessages: string[] = [];
let pickedChoice: EventChoice | null = null;
let activeNodeId: string | null = null;

/** Reset the module-level event-screen state. Intended for test isolation. */
export function resetEventScreenState(): void {
  phase = "menu";
  resultMessages = [];
  pickedChoice = null;
  activeNodeId = null;
}

export class EventScreen {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const run = gameState.run;
    if (!run) {
      gameState.screen = "main_menu";
      this.app.render();
      return document.createElement("div");
    }

    const EVENT_POOL = ["event.strange_shrine", "event.rogue_trader", "event.healing_spring", "event.crumbling_bridge"];
    const nodeId = run.mapState.currentNodeId;
    if (!run.eventSelections[nodeId]) {
      const unvisited = EVENT_POOL.filter((eid) => !Object.values(run.eventSelections).includes(eid));
      const pool = unvisited.length > 0 ? unvisited : EVENT_POOL;
      run.eventSelections[nodeId] = pool[Math.floor(gameState.rng() * pool.length)];
    }
    const eventId = run.eventSelections[nodeId];
    const eventDef = EVENT_REGISTRY[eventId];

    if (activeNodeId !== nodeId) {
      phase = "menu";
      resultMessages = [];
      pickedChoice = null;
      activeNodeId = nodeId;
    }

    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:16px;max-width:600px;margin:0 auto;";

    const title = document.createElement("h2");
    title.textContent = eventDef.title;
    container.appendChild(title);

    const desc = document.createElement("div");
    desc.textContent = eventDef.description;
    desc.style.cssText = "color:#ccc;font-size:14px;text-align:center;max-width:400px;";
    container.appendChild(desc);

    if (phase === "result") {
      for (const msg of resultMessages) {
        const el = document.createElement("div");
        el.style.cssText = "color:#4f4;font-weight:bold;font-size:14px;margin:4px 0;";
        el.textContent = msg;
        container.appendChild(el);
      }

      const contBtn = document.createElement("button");
      contBtn.textContent = "Continue";
      contBtn.style.cssText = "padding:10px 32px;font-size:16px;margin-top:12px;";
      contBtn.addEventListener("click", () => {
        const run = gameState.run;
        if (run) run.mapState.nodesCleared++;
        phase = "menu";
        resultMessages = [];
        pickedChoice = null;
        activeNodeId = null;
        gameState.screen = "map";
        this.app.render();
      });
      container.appendChild(contBtn);
      return container;
    }

    if (phase === "picker" && pickedChoice) {
      const checkEffect = pickedChoice.effects.find((e) => e.type === "check") as CheckEffect | undefined;
      const picker = checkEffect
        ? this.renderCheckPicker(checkEffect)
        : this.renderHeroPicker(eventDef, pickedChoice);
      container.appendChild(picker);
      return container;
    }

    for (const choice of eventDef.choices) {
      const card = document.createElement("div");
      card.style.cssText = "border:1px solid #555;border-radius:8px;padding:16px 24px;cursor:pointer;background:#2a2a4a;text-align:center;min-width:280px;";
      card.setAttribute("data-testid", `event-choice-${choice.label.replace(/\s+/g, "-").toLowerCase()}`);
      card.innerHTML = `<div style="font-weight:bold;font-size:15px;">${choice.label}</div><div style="font-size:12px;color:#aaa;margin-top:4px;">${choice.description}</div>`;
      card.addEventListener("click", () => this.onChoiceClick(eventDef, choice));
      card.addEventListener("mouseenter", () => { card.style.background = "#3a3a5a"; });
      card.addEventListener("mouseleave", () => { card.style.background = "#2a2a4a"; });
      container.appendChild(card);
    }

    return container;
  }

  private onChoiceClick(eventDef: EventDef, choice: EventChoice): void {
    const run = gameState.run!;
    const checkEffect = choice.effects.find((e) => e.type === "check") as CheckEffect | undefined;
    if (checkEffect) {
      // Flavor checks can auto-pick the best living hero; otherwise prompt the player.
      if (checkEffect.check.autoPickBestStat) {
        const best = pickBestHero(run.party, checkEffect.check.stat);
        if (best) {
          this.resolveCheck(checkEffect, best);
          return;
        }
      }
      phase = "picker";
      pickedChoice = choice;
      this.app.render();
      return;
    }

    const needsPicker = choice.effects.some((e) => e.type === "stat_boost");
    if (needsPicker) {
      phase = "picker";
      pickedChoice = choice;
      this.app.render();
      return;
    }

    const messages = applyEventChoiceEffects(choice, run, gameState.rng);
    resultMessages = messages;
    phase = "result";
    this.app.render();
  }

  private resolveCheck(checkEffect: CheckEffect, pm: PartyMember): void {
    const run = gameState.run!;
    const { messages } = resolveCheckEffect(checkEffect, pm, run, gameState.rng);
    resultMessages = messages;
    phase = "result";
    pickedChoice = null;
    this.app.render();
  }

  private renderCheckPicker(checkEffect: CheckEffect): HTMLElement {
    const run = gameState.run!;
    const check = checkEffect.check;
    const statName = check.stat.charAt(0).toUpperCase() + check.stat.slice(1);

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;";

    const label = document.createElement("div");
    label.textContent = `${statName} check — DC ${check.dc}`;
    label.style.cssText = "font-size:16px;font-weight:bold;margin-bottom:2px;";
    wrap.appendChild(label);

    const hint = document.createElement("div");
    hint.textContent = check.partialWithin
      ? `Choose a hero to attempt. A miss within ${check.partialWithin} still partially succeeds.`
      : "Choose a hero to attempt.";
    hint.style.cssText = "font-size:12px;color:#aaa;margin-bottom:6px;text-align:center;max-width:320px;";
    wrap.appendChild(hint);

    for (const pm of run.party) {
      const classDef = CLASS_REGISTRY[pm.classId];
      const mod = checkModifierFor(pm, check.stat);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
      const need = rollNeeded(mod, check.dc);
      const needStr = need <= 1 ? "auto" : need > 20 ? "impossible" : `need ${need}+`;
      const down = pm.hp <= 0;

      const btn = document.createElement("button");
      btn.textContent = `${classDef?.displayName ?? pm.classId} — ${pm.displayName}  (${statName} ${modStr} · ${down ? "down" : needStr})`;
      btn.style.cssText = "padding:8px 16px;font-size:13px;width:320px;";
      btn.setAttribute("data-testid", `check-hero-${pm.instanceId}`);
      if (down) {
        btn.disabled = true;
        btn.title = `${pm.displayName} is down and cannot attempt the check.`;
      } else {
        btn.addEventListener("click", () => this.resolveCheck(checkEffect, pm));
      }
      wrap.appendChild(btn);
    }

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:8px 16px;font-size:13px;margin-top:8px;";
    cancelBtn.addEventListener("click", () => {
      phase = "menu";
      pickedChoice = null;
      this.app.render();
    });
    wrap.appendChild(cancelBtn);

    return wrap;
  }

  private renderHeroPicker(eventDef: EventDef, choice: EventChoice): HTMLElement {
    const run = gameState.run!;
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;";

    const label = document.createElement("div");
    label.textContent = "Choose a hero:";
    label.style.cssText = "font-size:16px;margin-bottom:8px;";
    wrap.appendChild(label);

    for (const pm of run.party) {
      const btn = document.createElement("button");
      const classDef = CLASS_REGISTRY[pm.classId];
      btn.textContent = `${classDef?.displayName ?? pm.classId} — ${pm.displayName}`;
      btn.style.cssText = "padding:8px 16px;font-size:13px;width:280px;";
      btn.addEventListener("click", () => {
        const statEffect = choice.effects.find((e) => e.type === "stat_boost");
        if (statEffect && statEffect.type === "stat_boost") {
          const msg = applyStatBoost(pm, statEffect.stat, statEffect.amount);
          resultMessages = [msg];
        }
        phase = "result";
        pickedChoice = null;
        this.app.render();
      });
      wrap.appendChild(btn);
    }

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:8px 16px;font-size:13px;margin-top:8px;";
    cancelBtn.addEventListener("click", () => {
      phase = "menu";
      pickedChoice = null;
      this.app.render();
    });
    wrap.appendChild(cancelBtn);

    return wrap;
  }
}
