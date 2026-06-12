import type { App } from "../App.ts";
import { gameState, routeAfterXp } from "../../state/GameState.ts";
import type { PartyMember } from "../../state/RunState.ts";
import { EVENT_REGISTRY } from "../../data/events.ts";
import type { EventChoice, CheckEffect } from "../../data/events.ts";
import {
  evaluateRequirements,
  resolveEventChoice,
  resolveEventChoiceWithHero,
  selectEventForNode,
  eventDcBonus,
} from "../../run/Events.ts";
import { checkModifierFor, rollNeeded, pickBestHero } from "../../run/AbilityCheck.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import { ABILITY_FULL_LABELS } from "../../data/abilities.ts";
import { appendAdventureLogOnce } from "../../run/AdventureLog.ts";

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

    const nodeId = run.mapState.currentNodeId;
    const eventId = selectEventForNode(run, nodeId, gameState.rng);
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
        // Divert through the level-up screen first if the event's XP queued any choices (F29).
        routeAfterXp("map");
        this.app.render();
      });
      container.appendChild(contBtn);
      return container;
    }

    if (phase === "picker" && pickedChoice) {
      const checkEffect = pickedChoice.effects.find((e) => e.type === "check") as CheckEffect | undefined;
      const picker = checkEffect
        ? this.renderCheckPicker(pickedChoice, checkEffect)
        : this.renderHeroPicker(pickedChoice);
      container.appendChild(picker);
      return container;
    }

    for (const choice of eventDef.choices) {
      const req = evaluateRequirements(choice, run);
      const card = document.createElement("div");
      card.setAttribute("data-testid", `event-choice-${choice.label.replace(/\s+/g, "-").toLowerCase()}`);

      if (req.ok) {
        card.style.cssText = "border:1px solid #555;border-radius:8px;padding:16px 24px;cursor:pointer;background:#2a2a4a;text-align:center;min-width:280px;";
        card.innerHTML = `<div style="font-weight:bold;font-size:15px;">${choice.label}</div><div style="font-size:12px;color:#aaa;margin-top:4px;">${choice.description}</div>`;
        card.addEventListener("click", () => this.onChoiceClick(choice));
        card.addEventListener("mouseenter", () => { card.style.background = "#3a3a5a"; });
        card.addEventListener("mouseleave", () => { card.style.background = "#2a2a4a"; });
      } else {
        // UI Rule: unmet choices are shown disabled with the reason, never hidden.
        card.style.cssText = "border:1px solid #444;border-radius:8px;padding:16px 24px;cursor:not-allowed;background:#222;text-align:center;min-width:280px;opacity:0.55;";
        card.setAttribute("data-disabled", "true");
        card.innerHTML = `<div style="font-weight:bold;font-size:15px;color:#888;">${choice.label}</div><div style="font-size:12px;color:#aaa;margin-top:4px;">${choice.description}</div><div style="font-size:11px;color:#e88;margin-top:6px;">${req.reason}</div>`;
      }
      container.appendChild(card);
    }

    return container;
  }

  private logEventChoice(run: typeof gameState.run & object, nodeId: string, eventId: string, choice: EventChoice, messages: string[]): void {
    const first = messages[0] ?? "";
    let outcome: "success" | "partial" | "failure" | "none" = "none";
    if (/success/i.test(first) && !/partial/i.test(first)) outcome = "success";
    else if (/partial/i.test(first)) outcome = "partial";
    else if (/failure/i.test(first)) outcome = "failure";
    appendAdventureLogOnce(run, `event_choice:${nodeId}:${choice.id}`, {
      kind: "event_choice",
      text: `Event: ${eventId} — chose ${choice.label}. Outcome: ${outcome}.`,
      nodeId,
      eventId,
      choiceId: choice.id,
      outcome,
    });
  }

  private onChoiceClick(choice: EventChoice): void {
    const run = gameState.run!;
    // Defense in depth: disabled choices can't be clicked, but never resolve an unmet one.
    if (!evaluateRequirements(choice, run).ok) return;

    // Flavor checks can auto-pick the best living hero; otherwise the resolver asks for a pick.
    const checkEffect = choice.effects.find((e) => e.type === "check") as CheckEffect | undefined;
    if (checkEffect?.check.autoPickBestStat) {
      const best = pickBestHero(run.party, checkEffect.check.stat);
      if (best) {
        this.resolveWithHero(choice, best);
        return;
      }
    }

    const { messages, needsHeroPick } = resolveEventChoice(choice, run, gameState.rng, gameState.pendingLevelUps, gameState.campaign ?? undefined);
    if (needsHeroPick) {
      phase = "picker";
      pickedChoice = choice;
      this.app.render();
      return;
    }

    const nodeId = run.mapState.currentNodeId;
    const eventId = activeNodeId ?? nodeId;
    this.logEventChoice(run, nodeId, eventId, choice, messages);

    resultMessages = messages;
    phase = "result";
    this.app.render();
  }

  private resolveWithHero(choice: EventChoice, pm: PartyMember): void {
    const run = gameState.run!;
    const { messages } = resolveEventChoiceWithHero(choice, pm, run, gameState.rng, gameState.pendingLevelUps, gameState.campaign ?? undefined);

    const nodeId = run.mapState.currentNodeId;
    const eventId = activeNodeId ?? nodeId;
    this.logEventChoice(run, nodeId, eventId, choice, messages);

    resultMessages = messages;
    phase = "result";
    pickedChoice = null;
    this.app.render();
  }

  private renderCheckPicker(choice: EventChoice, checkEffect: CheckEffect): HTMLElement {
    const run = gameState.run!;
    const check = checkEffect.check;
    const statName = ABILITY_FULL_LABELS[check.stat];
    const adjustedDc = check.dc + eventDcBonus(run);
    const bestHero = pickBestHero(run.party, check.stat);

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;";

    const label = document.createElement("div");
    label.textContent = `${statName} check — DC ${adjustedDc}`;
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
      const need = rollNeeded(mod, adjustedDc);
      const needStr = need <= 1 ? "auto" : need > 20 ? "impossible" : `need ${need}+`;
      const down = pm.hp <= 0;
      const isRecommended = !down && pm.instanceId === bestHero?.instanceId;

      const btn = document.createElement("button");
      const recommendedTag = isRecommended ? " ★ Recommended ·" : "";
      btn.textContent = `${classDef?.displayName ?? pm.classId} — ${pm.displayName}  (${statName} ${modStr} ·${recommendedTag} ${down ? "down" : needStr})`;
      btn.style.cssText = "padding:8px 16px;font-size:13px;width:320px;";
      btn.setAttribute("data-testid", `check-hero-${pm.instanceId}`);
      if (down) {
        btn.disabled = true;
        btn.title = `${pm.displayName} is down and cannot attempt the check.`;
      } else {
        btn.addEventListener("click", () => this.resolveWithHero(choice, pm));
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

  private renderHeroPicker(choice: EventChoice): HTMLElement {
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
      btn.setAttribute("data-testid", `event-hero-${pm.instanceId}`);
      btn.addEventListener("click", () => this.resolveWithHero(choice, pm));
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
