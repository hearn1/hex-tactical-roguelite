import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";

export class RunSummary {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding-top:60px;gap:12px;";

    const run = gameState.run;
    const won = run?.runStatus === "won";
    const lost = run?.runStatus === "lost";

    const banner = document.createElement("h2");
    banner.style.cssText = won ? "color:#4a8;" : "color:#c44;";
    banner.textContent = won ? "Victory!" : "Defeat";
    container.appendChild(banner);

    const nodesCleared = run?.mapState.nodesCleared ?? 0;
    const elitesDefeated = run?.mapState.elitesDefeated ?? 0;
    const bossDefeated = run?.mapState.bossDefeated ?? false;
    const gold = run?.gold ?? 0;

    const heroesLeveled = run?.party.filter((p) => p.level >= 2).length ?? 0;
    const renown = nodesCleared * 2 + elitesDefeated * 5 + (bossDefeated ? 15 : 0);

    const lines = [
      `Nodes Cleared: ${nodesCleared}`,
      `Elites Defeated: ${elitesDefeated}`,
      `Boss Defeated: ${bossDefeated ? "Yes" : "No"}`,
      `Heroes Leveled: ${heroesLeveled}`,
      `Gold Accumulated: ${gold}`,
      `Renown Earned: ${renown}`,
    ];

    for (const line of lines) {
      const el = document.createElement("div");
      el.style.cssText = "font-size:15px;color:#ccc;";
      el.textContent = line;
      container.appendChild(el);
    }

    const btn = document.createElement("button");
    btn.textContent = "Return to Main Menu";
    btn.style.cssText = "padding:10px 24px;font-size:16px;margin-top:20px;";
    btn.addEventListener("click", () => {
      gameState.run = null;
      gameState.combat = null;
      gameState.screen = "main_menu";
      this.app.render();
    });
    container.appendChild(btn);

    return container;
  }
}
