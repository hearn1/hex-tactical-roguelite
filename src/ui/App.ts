import { gameState } from "../state/GameState.ts";
import type { ScreenId } from "../state/types.ts";
import { MainMenu } from "./screens/MainMenu.ts";
import { CombatScreen } from "./screens/CombatScreen.ts";
import { RewardScreen } from "./screens/RewardScreen.ts";
import { MapScreen } from "./screens/MapScreen.ts";
import { RunSummary } from "./screens/RunSummary.ts";
import { ShopScreen } from "./screens/ShopScreen.ts";
import { CampScreen } from "./screens/CampScreen.ts";
import { EventScreen } from "./screens/EventScreen.ts";
import { RecruitScreen } from "./screens/RecruitScreen.ts";
import { PetScreen } from "./screens/PetScreen.ts";

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
    this.root.innerHTML = "";
    switch (screenId) {
      case "main_menu":
        return new MainMenu(this).render();
      case "map":
        return new MapScreen(this).render();
      case "combat":
        return new CombatScreen(this).render();
      case "reward":
        return new RewardScreen(this).render();
      case "shop":
        return new ShopScreen(this).render();
      case "camp":
        return new CampScreen(this).render();
      case "event":
        return new EventScreen(this).render();
      case "recruit":
        return new RecruitScreen(this).render();
      case "pet":
        return new PetScreen(this).render();
      case "run_summary":
        return new RunSummary(this).render();
      default:
        return new MainMenu(this).render();
    }
  }
}
