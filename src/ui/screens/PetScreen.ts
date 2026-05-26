import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import type { RunModifier } from "../../state/types.ts";

const PET_OPTIONS: { id: string; name: string; desc: string; createModifier: () => RunModifier }[] = [
  {
    id: "pet.battle_hound",
    name: "Battle Hound",
    desc: "First enemy hit each combat takes +1 damage.",
    createModifier: () => ({ kind: "first_hit_bonus_damage", amount: 1 }),
  },
  {
    id: "pet.owl_familiar",
    name: "Owl Familiar",
    desc: "First spell each combat gains +2 to hit.",
    createModifier: () => ({ kind: "global_stat", stat: "spirit", value: 2 }),
  },
  {
    id: "pet.pack_mule",
    name: "Pack Mule",
    desc: "+20% gold rewards.",
    createModifier: () => ({ kind: "gold_multiplier", value: 1.2 }),
  },
];

export class PetScreen {
  private app: App;
  private chosen: boolean = false;
  private resultText: string = "";

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const run = gameState.run;
    if (!run) {
      gameState.screen = "main_menu";
      this.app.render();
      return document.createElement("div");
    }

    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:16px;max-width:600px;margin:0 auto;";

    const title = document.createElement("h2");
    title.textContent = "Animal Companion";
    container.appendChild(title);

    const desc = document.createElement("div");
    desc.textContent = "A friendly creature offers to travel with your party.";
    desc.style.cssText = "color:#aaa;font-size:14px;";
    container.appendChild(desc);

    if (this.chosen) {
      const resultEl = document.createElement("div");
      resultEl.style.cssText = "color:#4f4;font-weight:bold;font-size:16px;margin:12px 0;";
      resultEl.textContent = this.resultText;
      container.appendChild(resultEl);

      const contBtn = document.createElement("button");
      contBtn.textContent = "Continue";
      contBtn.style.cssText = "padding:10px 32px;font-size:16px;";
      contBtn.addEventListener("click", () => {
        gameState.screen = "map";
        this.app.render();
      });
      container.appendChild(contBtn);
      return container;
    }

    const cardRow = document.createElement("div");
    cardRow.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;justify-content:center;";

    for (const pet of PET_OPTIONS) {
      const hasPet = run.runModifiers.some((m) => {
        if (pet.id === "pet.battle_hound") return m.kind === "first_hit_bonus_damage";
        if (pet.id === "pet.owl_familiar") return m.kind === "global_stat" && m.stat === "spirit";
        if (pet.id === "pet.pack_mule") return m.kind === "gold_multiplier";
        return false;
      });

      const card = document.createElement("div");
      card.style.cssText = `border:2px solid #8c4;border-radius:8px;padding:16px;background:#1a2a1a;text-align:center;min-width:160px;${hasPet ? "opacity:0.5;" : ""}`;

      card.innerHTML = `<div style="font-weight:bold;font-size:16px;color:#8c4;">${pet.name}</div><div style="font-size:12px;color:#aaa;margin:8px 0;">${pet.desc}</div>`;

      if (!hasPet) {
        const btn = document.createElement("button");
        btn.textContent = "Accept";
        btn.style.cssText = "margin-top:8px;padding:8px 16px;";
        btn.addEventListener("click", () => {
          run.runModifiers.push(pet.createModifier());
          this.resultText = `${pet.name} joins the party! ${pet.desc}`;
          this.chosen = true;
          this.app.render();
        });
        card.appendChild(btn);
      }

      cardRow.appendChild(card);
    }

    container.appendChild(cardRow);

    const skipBtn = document.createElement("button");
    skipBtn.textContent = "Leave";
    skipBtn.style.cssText = "padding:10px 32px;font-size:16px;margin-top:12px;";
    skipBtn.addEventListener("click", () => {
      gameState.screen = "map";
      this.app.render();
    });
    container.appendChild(skipBtn);

    return container;
  }
}
