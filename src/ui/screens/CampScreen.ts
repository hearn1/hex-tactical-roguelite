import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import type { PartyMember } from "../../state/RunState.ts";
import { restParty, trainPartyMember } from "../../run/Events.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";

// Module-level state persists across CampScreen instances created by App.render()
let phase: "menu" | "result" = "menu";
let resultText: string = "";
let pickingHero: boolean = false;
let actionType: "rest" | "train" | null = null;
let lastNodeId: string | null = null;
let lastNodesCleared: number = 0;

function resetState(): void {
  phase = "menu";
  resultText = "";
  pickingHero = false;
  actionType = null;
  lastNodeId = null;
  lastNodesCleared = 0;
}

export function resetCampScreenState(): void {
  resetState();
}

export class CampScreen {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  private checkFreshVisit(): void {
    const run = gameState.run;
    if (!run) { resetState(); return; }
    const nd = run.mapState.currentNodeId;
    const nc = run.mapState.nodesCleared;
    if (nd !== lastNodeId || nc !== lastNodesCleared) {
      resetState();
      lastNodeId = nd;
      lastNodesCleared = nc;
    }
  }

  render(): HTMLElement {
    this.checkFreshVisit();

    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:20px;max-width:600px;margin:0 auto;";

    const title = document.createElement("h2");
    title.textContent = "Safe Clearing — Camp";
    container.appendChild(title);

    const desc = document.createElement("div");
    desc.textContent = "A sheltered spot to rest and recover.";
    desc.style.cssText = "color:#aaa;font-size:14px;";
    container.appendChild(desc);

    if (pickingHero && actionType === "train") {
      const picker = this.renderHeroPicker();
      container.appendChild(picker);
      return container;
    }

    if (phase === "result") {
      const resultEl = document.createElement("div");
      resultEl.style.cssText = "font-size:16px;color:#4f4;font-weight:bold;margin:12px 0;";
      resultEl.textContent = resultText;
      container.appendChild(resultEl);

      const contBtn = document.createElement("button");
      contBtn.textContent = "Continue";
      contBtn.style.cssText = "padding:10px 32px;font-size:16px;";
      contBtn.addEventListener("click", () => {
        const run = gameState.run;
        if (run) run.mapState.nodesCleared++;
        gameState.screen = "map";
        this.app.render();
      });
      container.appendChild(contBtn);
      return container;
    }

    const restBtn = document.createElement("button");
    restBtn.textContent = "Rest (Heal 40% max HP)";
    restBtn.style.cssText = "padding:10px 24px;font-size:14px;width:250px;";
    restBtn.addEventListener("click", () => {
      const run = gameState.run!;
      const before = run.party.map((p) => p.hp);
      restParty(run.party);
      const messages = run.party.map((p, i) => `${p.displayName}: ${before[i]} → ${p.hp} HP`);
      resultText = `Party rested! ${messages.join(", ")}`;
      phase = "result";
      this.app.render();
    });
    container.appendChild(restBtn);

    const trainBtn = document.createElement("button");
    trainBtn.textContent = "Train (+5 XP to a hero)";
    trainBtn.style.cssText = "padding:10px 24px;font-size:14px;width:250px;";
    trainBtn.addEventListener("click", () => {
      pickingHero = true;
      actionType = "train";
      this.app.render();
    });
    container.appendChild(trainBtn);

    const leaveBtn = document.createElement("button");
    leaveBtn.textContent = "Leave";
    leaveBtn.style.cssText = "padding:10px 24px;font-size:14px;width:250px;";
    leaveBtn.addEventListener("click", () => {
      const run = gameState.run;
      if (run) run.mapState.nodesCleared++;
      gameState.screen = "map";
      this.app.render();
    });
    container.appendChild(leaveBtn);

    return container;
  }

  private renderHeroPicker(): HTMLElement {
    const run = gameState.run!;
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;";

    const label = document.createElement("div");
    label.textContent = "Choose a hero to train:";
    label.style.cssText = "font-size:16px;margin-bottom:8px;";
    wrap.appendChild(label);

    for (const pm of run.party) {
      const btn = document.createElement("button");
      const classDef = CLASS_REGISTRY[pm.classId];
      btn.textContent = `${classDef?.displayName ?? pm.classId} — ${pm.displayName} (Lv.${pm.level} ${pm.xp} XP)`;
      btn.style.cssText = "padding:8px 16px;font-size:13px;width:300px;";
      btn.addEventListener("click", () => {
        const result = trainPartyMember(pm, 5);
        let msg = `${pm.displayName} gains 5 XP (now ${pm.xp} XP).`;
        if (result.leveledUp) {
          msg += ` Reaches Level ${result.newLevel}!`;
        }
        resultText = msg;
        phase = "result";
        pickingHero = false;
        actionType = null;
        this.app.render();
      });
      wrap.appendChild(btn);
    }

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:8px 16px;font-size:13px;margin-top:8px;";
    cancelBtn.addEventListener("click", () => {
      pickingHero = false;
      actionType = null;
      this.app.render();
    });
    wrap.appendChild(cancelBtn);

    return wrap;
  }
}
