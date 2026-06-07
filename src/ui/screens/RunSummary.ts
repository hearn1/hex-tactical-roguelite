import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import { computeRenown } from "../../meta/Renown.ts";
import { saveMetaProgression } from "../../meta/SaveLoad.ts";
import { ADVENTURE_MODIFIER_REGISTRY } from "../../data/adventureModifiers.ts";
import { buildRunEpilogue } from "../../run/AdventureLog.ts";

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

    const gold = run?.gold ?? 0;

    const breakdown = run ? computeRenown(run) : null;

    const modDef = run?.adventureModifierId ? ADVENTURE_MODIFIER_REGISTRY[run.adventureModifierId] : undefined;

    const lines = [
      `Gold Accumulated: ${gold}`,
      `Seed: ${run?.seed ?? "N/A"}`,
    ];

    if (modDef) {
      lines.push(`Adventure Modifier: ${modDef.displayName} — ${modDef.bonusDescription} / ${modDef.drawbackDescription}`);
    }

    if (breakdown) {
      lines.push("");
      lines.push(`Renown Earned: ${breakdown.total}`);
      lines.push(`  Nodes cleared (×2): ${breakdown.nodes}`);
      lines.push(`  Elites (×5): ${breakdown.elites}`);
      lines.push(`  Boss (×15): ${breakdown.boss}`);
      lines.push(`  Characters leveled (×1): ${breakdown.characters}`);
      if (breakdown.minimumApplied) {
        lines.push("  (Minimum failed-run reward applied)");
      }

      if (run && !run.summaryApplied) {
        gameState.meta.renown += breakdown.total;
        gameState.meta.completedRuns++;
        if (won) gameState.meta.bossWins++;
        saveMetaProgression(gameState.meta);
        run.summaryApplied = true;
      }
    }

    for (const line of lines) {
      const el = document.createElement("div");
      el.style.cssText = "font-size:15px;color:#ccc;";
      el.textContent = line;
      container.appendChild(el);
    }

    if (run) {
      const epilogue = buildRunEpilogue(run);
      if (epilogue.length > 0) {
        const epHeading = document.createElement("div");
        epHeading.style.cssText = "font-size:16px;font-weight:bold;color:#ccf;margin-top:16px;";
        epHeading.textContent = "Epilogue";
        container.appendChild(epHeading);
        for (const line of epilogue) {
          const el = document.createElement("div");
          el.style.cssText = "font-size:13px;color:#aaa;";
          el.textContent = line;
          container.appendChild(el);
        }
      }
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
