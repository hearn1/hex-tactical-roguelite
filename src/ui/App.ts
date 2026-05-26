import { gameState } from "../state/GameState.ts";
import type { ScreenId } from "../state/types.ts";
import { MainMenu } from "./screens/MainMenu.ts";

export class App {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  render(): void {
    this.root.innerHTML = "";
    const screen = this.renderScreen(gameState.screen);
    this.root.appendChild(screen);
  }

  private renderScreen(screenId: ScreenId): HTMLElement {
    if (screenId === "main_menu") {
      return new MainMenu(this).render();
    }
    return new MainMenu(this).render();
  }
}
