import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import type { Difficulty } from "../../state/RunState.ts";
import { buildParty, createRunState, defaultPartySpecs } from "../../run/PartySetup.ts";
import { applyMetaUpgradesToFreshRun } from "../../meta/Upgrades.ts";
import { applyBackgrounds } from "../../run/Backgrounds.ts";
import { resetSetupScreenState } from "./SetupScreen.ts";

export class MainMenu {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding-top:80px;gap:16px;";

    const title = document.createElement("h1");
    title.textContent = "DnRogueLite — Prototype";
    container.appendChild(title);

    const diffRow = document.createElement("div");
    diffRow.style.cssText = "display:flex;gap:8px;align-items:center;";
    const diffLabel = document.createElement("span");
    diffLabel.style.cssText = "font-size:14px;";
    diffLabel.textContent = "Difficulty:";
    diffRow.appendChild(diffLabel);

    let currentDiff: Difficulty = "normal";
    const diffBtn = document.createElement("button");
    diffBtn.textContent = "Normal";
    diffBtn.style.cssText = "padding:4px 12px;font-size:13px;min-width:80px;";
    diffBtn.addEventListener("click", () => {
      currentDiff = currentDiff === "normal" ? "hard" : "normal";
      diffBtn.textContent = currentDiff.charAt(0).toUpperCase() + currentDiff.slice(1);
      diffBtn.style.color = currentDiff === "hard" ? "#f44" : "#fff";
    });
    diffRow.appendChild(diffBtn);
    container.appendChild(diffRow);

    const quickStartBtn = document.createElement("button");
    quickStartBtn.textContent = "Quick Start";
    quickStartBtn.style.cssText = "padding:10px 24px;font-size:16px;";
    quickStartBtn.addEventListener("click", () => {
      const run = createRunState(buildParty(defaultPartySpecs()), currentDiff);
      applyBackgrounds(run);
      applyMetaUpgradesToFreshRun(run, gameState.meta);
      gameState.run = run;
      gameState.combat = null;
      gameState.screen = "map";
      this.app.render();
    });
    container.appendChild(quickStartBtn);

    const customBtn = document.createElement("button");
    customBtn.textContent = "Custom Party";
    customBtn.style.cssText = "padding:10px 24px;font-size:16px;";
    customBtn.addEventListener("click", () => {
      resetSetupScreenState(currentDiff);
      gameState.screen = "setup";
      this.app.render();
    });
    container.appendChild(customBtn);

    const metaBtn = document.createElement("button");
    metaBtn.textContent = "Meta Upgrades";
    metaBtn.style.cssText = "padding:10px 24px;font-size:16px;";
    metaBtn.addEventListener("click", () => {
      gameState.screen = "meta_upgrades";
      this.app.render();
    });
    container.appendChild(metaBtn);

    const devLink = document.createElement("a");
    devLink.textContent = "Dev: Combat Sandbox";
    devLink.style.cssText = "font-size:12px;color:#666;cursor:pointer;margin-top:4px;text-decoration:underline;";
    devLink.addEventListener("click", () => {
      gameState.run = null;
      gameState.combat = null;
      gameState.screen = "combat";
      this.app.render();
    });
    container.appendChild(devLink);

    return container;
  }
}
