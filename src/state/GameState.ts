import { createRng } from "../core/rng.ts";
import type { ScreenId } from "./types.ts";

export interface GameState {
  screen: ScreenId;
  rng: () => number;
  rngSeed: number;
}

function createGameState(): GameState {
  const seed = Date.now();
  return {
    screen: "main_menu",
    rng: createRng(seed),
    rngSeed: seed,
  };
}

export const gameState: GameState = createGameState();
