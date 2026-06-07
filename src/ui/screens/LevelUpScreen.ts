import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import { getLevelUpOptions, applyLevelUpChoice, findLevelUpOption } from "../../run/LevelUp.ts";
import { appendAdventureLogOnce } from "../../run/AdventureLog.ts";

// Module-level so App.render() rebuilding the screen between clicks doesn't reset the picked
// option. Scoped by the head-of-queue entry: a fresh level-up always starts unselected.
let selectedOptionId: string | null = null;
let activeKey: string | null = null;

export function resetLevelUpScreenState(): void {
  selectedOptionId = null;
  activeKey = null;
}

export class LevelUpScreen {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const run = gameState.run;
    const queue = gameState.pendingLevelUps;

    // No run or empty queue: nothing to resolve — return to wherever we were headed.
    if (!run || queue.length === 0) {
      gameState.screen = run ? gameState.levelUpReturnScreen : "main_menu";
      this.app.render();
      return document.createElement("div");
    }

    const pending = queue[0];
    const pm = run.party.find((p) => p.instanceId === pending.instanceId);

    // Defensive: a queued hero that no longer exists is dropped so the queue still drains.
    if (!pm) {
      queue.shift();
      return this.render();
    }

    const key = `${pending.instanceId}:${pending.newLevel}`;
    if (activeKey !== key) {
      selectedOptionId = null;
      activeKey = key;
    }

    const options = getLevelUpOptions(pending.classId, pending.newLevel);
    // Should not happen (only in-range levels enqueue), but never strand the queue.
    if (options.length === 0) {
      queue.shift();
      resetLevelUpScreenState();
      return this.render();
    }

    const classDef = CLASS_REGISTRY[pm.classId];
    const container = document.createElement("div");
    container.setAttribute("data-testid", "levelup-screen");
    container.style.cssText =
      "display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:16px;max-width:640px;margin:0 auto;";

    const title = document.createElement("h2");
    title.textContent = `Level Up! ${pm.displayName} reaches Level ${pending.newLevel}`;
    container.appendChild(title);

    const sub = document.createElement("div");
    sub.style.cssText = "color:#aaa;font-size:14px;";
    sub.textContent = `${classDef?.displayName ?? pm.classId} — choose an upgrade (added on top of your level gain):`;
    container.appendChild(sub);

    if (queue.length > 1) {
      const remaining = document.createElement("div");
      remaining.style.cssText = "color:#888;font-size:12px;";
      remaining.textContent = `${queue.length - 1} more level-up${queue.length - 1 === 1 ? "" : "s"} to resolve after this.`;
      container.appendChild(remaining);
    }

    const cardsRow = document.createElement("div");
    cardsRow.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px;";
    for (const option of options) {
      const card = document.createElement("div");
      card.setAttribute("data-testid", `levelup-option-${option.id}`);
      const selected = selectedOptionId === option.id;
      card.style.cssText = `border:2px solid ${selected ? "#fa0" : "#555"};border-radius:8px;padding:16px 20px;cursor:pointer;background:${selected ? "#3a3a5a" : "#2a2a4a"};text-align:center;min-width:200px;max-width:240px;`;
      card.innerHTML = `<div style="font-weight:bold;color:#8cf;font-size:15px;">${option.name}</div><div style="font-size:13px;margin-top:6px;color:#ddd;">${option.description}</div>`;
      card.addEventListener("click", () => {
        selectedOptionId = option.id;
        this.app.render();
      });
      cardsRow.appendChild(card);
    }
    container.appendChild(cardsRow);

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Confirm";
    confirmBtn.setAttribute("data-testid", "levelup-confirm");
    confirmBtn.style.cssText = "padding:10px 32px;font-size:16px;margin-top:8px;";
    confirmBtn.disabled = selectedOptionId === null;
    confirmBtn.addEventListener("click", () => this.onConfirm());
    container.appendChild(confirmBtn);

    if (selectedOptionId === null) {
      const hint = document.createElement("div");
      hint.style.cssText = "color:#888;font-size:12px;";
      hint.textContent = "Select an upgrade to confirm.";
      container.appendChild(hint);
    }

    return container;
  }

  private onConfirm(): void {
    const run = gameState.run;
    const queue = gameState.pendingLevelUps;
    if (!run || queue.length === 0 || selectedOptionId === null) return;

    const pending = queue[0];
    const pm = run.party.find((p) => p.instanceId === pending.instanceId);
    const option = findLevelUpOption(pending.classId, pending.newLevel, selectedOptionId);
    if (pm && option) {
      applyLevelUpChoice(pm, option);
      appendAdventureLogOnce(run, `level_up:${pm.instanceId}:${pending.newLevel}`, {
        kind: "level_up",
        text: `${pm.displayName} reached level ${pending.newLevel} and chose ${option.name}.`,
        heroInstanceId: pm.instanceId,
        heroName: pm.displayName,
      });
    }

    queue.shift();
    resetLevelUpScreenState();

    if (queue.length === 0) {
      gameState.screen = gameState.levelUpReturnScreen;
    }
    this.app.render();
  }
}
