import type { App } from "../App.ts";
import { gameState, resetGameState } from "../../state/GameState.ts";
import { completeCampaign } from "../../run/ActTransition.ts";

export class CampaignVictoryScreen {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const campaign = gameState.campaign;
    const run = gameState.run;

    if (campaign && run) {
      completeCampaign(campaign, run);
    }

    const container = document.createElement("div");
    container.style.cssText =
      "display:flex;flex-direction:column;align-items:center;padding-top:60px;gap:16px;";

    const banner = document.createElement("h2");
    banner.style.cssText = "color:#fa4;font-size:2rem;";
    banner.textContent = "Campaign Complete!";
    container.appendChild(banner);

    const sub = document.createElement("div");
    sub.style.cssText = "font-size:16px;color:#ccc;";
    sub.textContent = "The Ascending Dark has fallen. The realm is saved.";
    container.appendChild(sub);

    if (run) {
      const statsEl = document.createElement("div");
      statsEl.style.cssText = "font-size:14px;color:#aaa;margin-top:12px;";
      const totalActs = campaign?.completedActs.length ?? 0;
      statsEl.textContent = `Acts completed: ${totalActs} | Final gold: ${run.gold}`;
      container.appendChild(statsEl);
    }

    const btn = document.createElement("button");
    btn.textContent = "Return to Main Menu";
    btn.style.cssText = "padding:10px 24px;font-size:16px;margin-top:24px;";
    btn.addEventListener("click", () => {
      resetGameState();
      this.app.render();
    });
    container.appendChild(btn);

    return container;
  }
}
