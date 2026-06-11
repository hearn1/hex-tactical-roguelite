import type { App } from "../App.ts";
import { gameState, resetGameState } from "../../state/GameState.ts";
import { completeCampaign } from "../../run/ActTransition.ts";
import { generateCampaignSummary } from "../../run/CampaignSummary.ts";

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
      "display:flex;flex-direction:column;align-items:center;padding-top:60px;gap:16px;max-width:540px;margin:0 auto;";

    const banner = document.createElement("h2");
    banner.style.cssText = "color:#fa4;font-size:2rem;";
    banner.textContent = "Campaign Complete!";
    container.appendChild(banner);

    const sub = document.createElement("div");
    sub.style.cssText = "font-size:16px;color:#ccc;";
    sub.textContent = "The Ascending Dark has fallen. The realm is saved.";
    container.appendChild(sub);

    if (campaign) {
      const summary = generateCampaignSummary(campaign);

      const totals = document.createElement("div");
      totals.style.cssText = "font-size:14px;color:#aaa;margin-top:12px;line-height:1.7;text-align:center;";
      totals.innerHTML = [
        `Acts completed: <b>${summary.actsCompleted}</b>`,
        `Battles won: <b>${summary.battlesWon}</b>`,
        `Bosses defeated: <b>${summary.bossEncountersCompleted}</b>`,
        `Gold earned: <b>${summary.goldEarned}</b>`,
        `Items gained: <b>${summary.itemsGained}</b>`,
        `Heroes downed: <b>${summary.heroDownCount}</b>`,
      ].join(" &nbsp;|&nbsp; ");
      container.appendChild(totals);

      if (summary.actBreakdowns.length > 0) {
        const breakdownHeader = document.createElement("div");
        breakdownHeader.style.cssText = "font-size:15px;font-weight:bold;color:#ccf;margin-top:12px;";
        breakdownHeader.textContent = "Per-Act Breakdown";
        container.appendChild(breakdownHeader);

        for (const act of summary.actBreakdowns) {
          const row = document.createElement("div");
          row.style.cssText = "font-size:13px;color:#aaa;";
          row.textContent =
            `Act ${act.actNumber}: ${act.nodesCleared} nodes, ` +
            `${act.elitesDefeated} elites, boss ${act.bossDefeated ? "✓" : "✗"}, ` +
            `${act.goldEarned}g, ${act.itemsGained} items, ${act.heroDownCount} downed`;
          container.appendChild(row);
        }
      }
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
