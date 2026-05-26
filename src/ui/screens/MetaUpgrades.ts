import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import { ALL_UPGRADES } from "../../data/upgrades.ts";
import { canPurchase, purchase } from "../../meta/Upgrades.ts";
import { saveMetaProgression, resetMeta } from "../../meta/SaveLoad.ts";
import { createDefaultMetaProgression } from "../../meta/MetaProgression.ts";

export class MetaUpgrades {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:20px 40px;gap:12px;max-width:600px;margin:0 auto;";

    const title = document.createElement("h2");
    title.textContent = "Meta Upgrades";
    container.appendChild(title);

    const renownLabel = document.createElement("div");
    renownLabel.style.cssText = "font-size:16px;color:#ff8;margin-bottom:8px;";
    renownLabel.textContent = `Renown: ${gameState.meta.renown}`;
    renownLabel.id = "renown-label";
    container.appendChild(renownLabel);

    const upgradesList = document.createElement("div");
    upgradesList.style.cssText = "display:flex;flex-direction:column;gap:10px;width:100%;";

    for (const upgrade of ALL_UPGRADES) {
      const currentRank = gameState.meta.upgradeRanks[upgrade.id] ?? 0;
      const atMax = currentRank >= upgrade.maxRank;
      const nextRank = currentRank + 1;
      const cost = atMax ? 0 : upgrade.costRenownPerRank[currentRank];

      const card = document.createElement("div");
      card.style.cssText = "border:1px solid #555;border-radius:6px;padding:12px;background:#2a2a3a;display:flex;flex-direction:column;gap:6px;";

      const nameRow = document.createElement("div");
      nameRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;";

      const nameLabel = document.createElement("span");
      nameLabel.style.cssText = "font-weight:bold;font-size:15px;";
      nameLabel.textContent = upgrade.displayName;
      nameRow.appendChild(nameLabel);

      const rankLabel = document.createElement("span");
      rankLabel.style.cssText = "font-size:13px;color:#aaa;";
      rankLabel.textContent = atMax ? `Rank ${currentRank}/${upgrade.maxRank} (MAX)` : `Rank ${currentRank}/${upgrade.maxRank}`;
      nameRow.appendChild(rankLabel);

      card.appendChild(nameRow);

      const desc = document.createElement("div");
      desc.style.cssText = "font-size:13px;color:#bbb;";
      desc.textContent = upgrade.description;
      card.appendChild(desc);

      if (!atMax) {
        const costLabel = document.createElement("div");
        costLabel.style.cssText = "font-size:13px;color:#fa0;";
        costLabel.textContent = `Next rank cost: ${cost} Renown`;
        card.appendChild(costLabel);

        const buyBtn = document.createElement("button");
        buyBtn.textContent = "Purchase";
        buyBtn.style.cssText = "padding:6px 18px;font-size:14px;align-self:flex-end;";

        const check = canPurchase(upgrade.id, gameState.meta);
        if (!check.ok) {
          buyBtn.disabled = true;
          buyBtn.title = check.reason;
        }

        buyBtn.addEventListener("click", () => {
          purchase(upgrade.id, gameState.meta);
          saveMetaProgression(gameState.meta);
          this.app.render();
        });

        card.appendChild(buyBtn);
      }

      upgradesList.appendChild(card);
    }

    container.appendChild(upgradesList);

    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display:flex;gap:12px;margin-top:16px;";

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back to Main Menu";
    backBtn.style.cssText = "padding:8px 20px;font-size:14px;";
    backBtn.addEventListener("click", () => {
      gameState.screen = "main_menu";
      this.app.render();
    });
    buttonRow.appendChild(backBtn);

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset All Progress";
    resetBtn.style.cssText = "padding:8px 20px;font-size:14px;color:#c44;";
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset all meta progression? This cannot be undone.")) {
        resetMeta();
        gameState.meta = createDefaultMetaProgression();
        this.app.render();
      }
    });
    buttonRow.appendChild(resetBtn);

    container.appendChild(buttonRow);

    return container;
  }
}
