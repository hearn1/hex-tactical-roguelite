import { gameState } from "../state/GameState.ts";
import type { ScreenId } from "../state/types.ts";
import { MainMenu } from "./screens/MainMenu.ts";
import { CombatScreen } from "./screens/CombatScreen.ts";
import { RewardScreen } from "./screens/RewardScreen.ts";

type AnyScreen = MainMenu | CombatScreen | RewardScreen;

export class App {
  private root: HTMLElement;
  private screenCache: Map<string, AnyScreen> = new Map();

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
    if (screenId === "reward") {
      this.screenCache.clear();
      const screen = new RewardScreen(this);
      this.screenCache.set("reward", screen);
      return screen.render();
    }
    this.screenCache.clear();
    const screen = new MainMenu(this);
    this.screenCache.set("main_menu", screen);
    return screen.render();
  }
}
