import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";

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

    const startBtn = document.createElement("button");
    startBtn.textContent = "Start Combat Sandbox";
    startBtn.style.cssText = "padding:10px 24px;font-size:16px;";
    startBtn.addEventListener("click", () => {
      gameState.combat = null;
      gameState.screen = "combat";
      this.app.render();
    });
    container.appendChild(startBtn);

    return container;
  }
}
