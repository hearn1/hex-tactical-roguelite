import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import { computeRenown } from "../../meta/Renown.ts";
import { saveMetaProgression } from "../../meta/SaveLoad.ts";
import { ADVENTURE_MODIFIER_REGISTRY } from "../../data/adventureModifiers.ts";
import { buildRunEpilogue } from "../../run/AdventureLog.ts";
import { generateCampaignSummary } from "../../run/CampaignSummary.ts";

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

    // Campaign loss summary section.
    const campaign = gameState.campaign;
    if (campaign && lost) {
      const summary = generateCampaignSummary(campaign, run ?? undefined);

      const campHeader = document.createElement("div");
      campHeader.style.cssText = "font-size:16px;font-weight:bold;color:#f88;margin-top:20px;";
      campHeader.textContent = "Campaign Ended";
      container.appendChild(campHeader);

      const lossLine = document.createElement("div");
      lossLine.style.cssText = "font-size:14px;color:#ccc;";
      const actLabel = `Act ${summary.lossActNumber ?? campaign.currentActNumber}`;
      const nodeLabel = summary.lossNodeId ? ` — node ${summary.lossNodeId}` : "";
      lossLine.textContent = `Fell in ${actLabel}${nodeLabel}`;
      container.appendChild(lossLine);

      const totalsEl = document.createElement("div");
      totalsEl.style.cssText = "font-size:13px;color:#aaa;margin-top:6px;line-height:1.7;";
      const lines2 = [
        `Acts completed: ${summary.actsCompleted}`,
        `Battles won: ${summary.battlesWon}`,
        `Bosses defeated: ${summary.bossEncountersCompleted}`,
        `Gold: ${summary.goldEarned}`,
        `Items gained: ${summary.itemsGained}`,
        `Heroes downed: ${summary.heroDownCount}`,
      ];
      for (const l of lines2) {
        const d = document.createElement("div");
        d.textContent = l;
        totalsEl.appendChild(d);
      }
      container.appendChild(totalsEl);

      if (summary.actBreakdowns.length > 1) {
        const bkHeader = document.createElement("div");
        bkHeader.style.cssText = "font-size:14px;font-weight:bold;color:#ccf;margin-top:10px;";
        bkHeader.textContent = "Per-Act Breakdown";
        container.appendChild(bkHeader);

        for (const act of summary.actBreakdowns) {
          const row = document.createElement("div");
          row.style.cssText = "font-size:12px;color:#aaa;";
          row.textContent =
            `Act ${act.actNumber}: ${act.nodesCleared} nodes, ` +
            `${act.elitesDefeated} elites, boss ${act.bossDefeated ? "✓" : "✗"}, ` +
            `${act.goldEarned}g`;
          container.appendChild(row);
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
