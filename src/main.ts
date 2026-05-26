import "./ui/styles.css";
import { App } from "./ui/App.ts";
import { gameState } from "./state/GameState.ts";
import { loadMetaProgression } from "./meta/SaveLoad.ts";

gameState.meta = loadMetaProgression();

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app element");

const app = new App(root);
app.render();
