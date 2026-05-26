import type { App } from "../App.ts";

export class MainMenu {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const container = document.createElement("div");

    const title = document.createElement("h1");
    title.textContent = "DnRogueLite — Prototype";
    container.appendChild(title);

    const startBtn = document.createElement("button");
    startBtn.textContent = "Start Combat Sandbox";
    startBtn.addEventListener("click", () => {
      console.log("TODO: start combat");
    });
    container.appendChild(startBtn);

    return container;
  }
}
