import { App } from "./ui/App.ts";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app element");

const app = new App(root);
app.render();
