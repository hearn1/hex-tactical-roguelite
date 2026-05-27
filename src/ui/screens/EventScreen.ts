import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import type { PartyMember } from "../../state/RunState.ts";
import { EVENT_REGISTRY } from "../../data/events.ts";
import type { EventDef, EventChoice } from "../../data/events.ts";
import { applyEventChoiceEffects, applyStatBoost } from "../../run/Events.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";

export class EventScreen {
  private app: App;
  private phase: "menu" | "picker" | "result" = "menu";
  private resultMessages: string[] = [];
  private pickedChoice: EventChoice | null = null;

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

    const EVENT_POOL = ["event.strange_shrine", "event.rogue_trader", "event.healing_spring"];
    const nodeId = run.mapState.currentNodeId;
    if (!run.eventSelections[nodeId]) {
      const unvisited = EVENT_POOL.filter((eid) => !Object.values(run.eventSelections).includes(eid));
      const pool = unvisited.length > 0 ? unvisited : EVENT_POOL;
      run.eventSelections[nodeId] = pool[Math.floor(gameState.rng() * pool.length)];
    }
    const eventId = run.eventSelections[nodeId];
    const eventDef = EVENT_REGISTRY[eventId];

    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:16px;max-width:600px;margin:0 auto;";

    const title = document.createElement("h2");
    title.textContent = eventDef.title;
    container.appendChild(title);

    const desc = document.createElement("div");
    desc.textContent = eventDef.description;
    desc.style.cssText = "color:#ccc;font-size:14px;text-align:center;max-width:400px;";
    container.appendChild(desc);

    if (this.phase === "result") {
      for (const msg of this.resultMessages) {
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
        gameState.screen = "map";
        this.app.render();
      });
      container.appendChild(contBtn);
      return container;
    }

    if (this.phase === "picker" && this.pickedChoice) {
      const picker = this.renderHeroPicker(eventDef, this.pickedChoice);
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
    const needsPicker = choice.effects.some((e) => e.type === "stat_boost");
    if (needsPicker) {
      this.phase = "picker";
      this.pickedChoice = choice;
      this.app.render();
      return;
    }

    const run = gameState.run!;
    const messages = applyEventChoiceEffects(choice, run, gameState.rng);
    this.resultMessages = messages;
    this.phase = "result";
    this.app.render();
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
          this.resultMessages = [msg];
        }
        this.phase = "result";
        this.pickedChoice = null;
        this.app.render();
      });
      wrap.appendChild(btn);
    }

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:8px 16px;font-size:13px;margin-top:8px;";
    cancelBtn.addEventListener("click", () => {
      this.phase = "menu";
      this.pickedChoice = null;
      this.app.render();
    });
    wrap.appendChild(cancelBtn);

    return wrap;
  }
}
