import "./setup.ts";
import { App } from "../../../src/ui/App.ts";
import { gameState, resetGameState } from "../../../src/state/GameState.ts";
import type { ScreenId } from "../../../src/state/types.ts";

export interface MountedApp {
  app: App;
  root: HTMLElement;
  getScreen(): ScreenId;
  clickButton(text: string): void;
  clickTestId(id: string): void;
}

export function mountApp(): MountedApp {
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  const app = new App(root);
  return {
    app,
    root,
    getScreen: () => gameState.screen,
    clickButton: (text: string) => {
      const buttons = root.querySelectorAll("button");
      for (const btn of buttons) {
        if (btn.textContent?.trim() === text) {
          btn.click();
          return;
        }
      }
      throw new Error(`Button with text "${text}" not found`);
    },
    clickTestId: (id: string) => {
      const el = root.querySelector(`[data-testid="${id}"]`);
      if (!el) throw new Error(`Element with data-testid "${id}" not found`);
      if (typeof (el as HTMLElement).click === "function") {
        (el as HTMLElement).click();
      } else {
        const evt = new MouseEvent("click", { bubbles: true });
        el.dispatchEvent(evt);
      }
    },
  };
}

export function cleanup(): void {
  const appEl = document.getElementById("app");
  if (appEl) appEl.remove();
  resetGameState();
  // Cancel all pending happy-dom async operations (timers, requestAnimationFrame loops,
  // fetch, etc.) between tests. Use cancelAsync (not abort) so the window stays open
  // for subsequent tests in the same file. By the time vitest runs its own environment
  // teardown (win.happyDOM.abort), all pending operations are already gone, so abort()
  // returns immediately instead of hanging on the 3D renderer's infinite rAF loop.
  const win = globalThis.window as (Window & { happyDOM?: { cancelAsync(): void } }) | undefined;
  if (win?.happyDOM?.cancelAsync) {
    win.happyDOM.cancelAsync();
  }
}
