import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import { advanceToNextAct } from "../../run/ActTransition.ts";
import { reseedRngFromRun } from "../../state/GameState.ts";

export class ActTransitionScreen {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText =
      "display:flex;flex-direction:column;align-items:center;padding-top:60px;gap:16px;";

    const campaign = gameState.campaign;
    const run = gameState.run;

    const completedActNum = campaign?.currentActNumber ?? 1;
    const nextActNum = completedActNum + 1;

    const banner = document.createElement("h2");
    banner.style.cssText = "color:#4a8;";
    banner.textContent = `Act ${completedActNum} Complete!`;
    container.appendChild(banner);

    const sub = document.createElement("div");
    sub.style.cssText = "font-size:15px;color:#ccc;";
    sub.textContent = `The party prepares for Act ${nextActNum}…`;
    container.appendChild(sub);

    if (run) {
      const statsEl = document.createElement("div");
      statsEl.style.cssText = "font-size:14px;color:#aaa;margin-top:8px;";
      statsEl.textContent = `Nodes cleared: ${run.mapState.nodesCleared} | Elites: ${run.mapState.elitesDefeated} | Gold: ${run.gold}`;
      container.appendChild(statsEl);
    }

    const restNotice = document.createElement("div");
    restNotice.style.cssText = "font-size:14px;color:#7bf;margin-top:8px;";
    restNotice.textContent = "The party takes a long rest. HP, hit dice, and spell slots are fully restored.";
    container.appendChild(restNotice);

    if (run?.party) {
      const partyEl = document.createElement("div");
      partyEl.style.cssText = "margin-top:8px;display:flex;flex-direction:column;gap:4px;align-items:center;";
      for (const pm of run.party) {
        const line = document.createElement("div");
        line.style.cssText = "font-size:13px;color:#9d9;";
        const status = pm.deadForRun ? "(will be revived)" : `HP restored to ${pm.maxHp}`;
        line.textContent = `${pm.displayName}: ${status}`;
        partyEl.appendChild(line);
      }
      container.appendChild(partyEl);
    }

    const btn = document.createElement("button");
    btn.textContent = `Continue to Act ${nextActNum}`;
    btn.style.cssText = "padding:10px 32px;font-size:16px;margin-top:24px;";
    btn.addEventListener("click", () => {
      if (!campaign || !run) {
        gameState.screen = "main_menu";
        this.app.render();
        return;
      }
      const nextRun = advanceToNextAct(campaign, run);
      reseedRngFromRun(nextRun.seed);
      gameState.run = nextRun;
      gameState.combat = null;
      gameState.screen = "map";
      this.app.render();
    });
    container.appendChild(btn);

    return container;
  }
}
