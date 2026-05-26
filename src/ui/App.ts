import { gameState } from "../state/GameState.ts";
import type { ScreenId } from "../state/types.ts";
import { MainMenu } from "./screens/MainMenu.ts";
import { CombatScreen } from "./screens/CombatScreen.ts";

export class App {
  private root: HTMLElement;
  private screenCache: Map<string, MainMenu | CombatScreen> = new Map();

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
      this.screenCache.clear();
      const screen = new MainMenu(this);
      this.screenCache.set("main_menu", screen);
      return screen.render();
    }
    if (screenId === "combat") {
      let screen = this.screenCache.get("combat") as CombatScreen | undefined;
      if (!screen) {
        screen = new CombatScreen(this);
        this.screenCache.set("combat", screen);
      }
      return screen.render();
    }
    const screen = new MainMenu(this);
    this.screenCache.set("main_menu", screen);
    return screen.render();
  }
}
