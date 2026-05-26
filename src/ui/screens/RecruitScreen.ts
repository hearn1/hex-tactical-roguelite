import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import type { PartyMember } from "../../state/RunState.ts";
import { generateRecruitCandidates, addRecruitToParty, createPackMuleModifier } from "../../run/Recruit.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import { ITEM_REGISTRY } from "../../data/items.ts";

const PARTY_CAP = 4;

export class RecruitScreen {
  private app: App;
  private phase: "menu" | "replace" | "result" = "menu";
  private resultText: string = "";
  private pendingRecruit: PartyMember | null = null;

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

    const nodeId = run.mapState.currentNodeId;
    if (!run.recruitOffers[nodeId]) {
      run.recruitOffers[nodeId] = generateRecruitCandidates(gameState.rng, nodeId);
    }
    const candidates = run.recruitOffers[nodeId];

    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:16px;max-width:700px;margin:0 auto;";

    const title = document.createElement("h2");
    title.textContent = "A Traveler Approaches";
    container.appendChild(title);

    const desc = document.createElement("div");
    desc.textContent = "A stranger offers to join your cause. You also spot a pack mule nearby.";
    desc.style.cssText = "color:#aaa;font-size:14px;text-align:center;";
    container.appendChild(desc);

    if (this.phase === "replace" && this.pendingRecruit) {
      const picker = this.renderReplacePicker(candidates, this.pendingRecruit);
      container.appendChild(picker);
      return container;
    }

    if (this.phase === "result") {
      const resultEl = document.createElement("div");
      resultEl.style.cssText = "color:#4f4;font-weight:bold;font-size:16px;margin:12px 0;";
      resultEl.textContent = this.resultText;
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

    const cardRow = document.createElement("div");
    cardRow.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;justify-content:center;";

    for (const cand of candidates) {
      const def = CLASS_REGISTRY[cand.classId];
      const card = document.createElement("div");
      card.style.cssText = "border:2px solid #48c;border-radius:8px;padding:16px;background:#1a2a3a;text-align:center;min-width:160px;";

      const className = document.createElement("div");
      className.style.cssText = "font-weight:bold;font-size:16px;color:#6cf;";
      className.textContent = def?.displayName ?? cand.classId;
      card.appendChild(className);

      const stats = document.createElement("div");
      stats.style.cssText = "font-size:12px;color:#aaa;margin:8px 0;";
      stats.textContent = `HP ${cand.maxHp} | Armor ${def?.baseStats.armor ?? 0} | Lv.${cand.level}`;
      card.appendChild(stats);

      const items = document.createElement("div");
      items.style.cssText = "font-size:11px;color:#888;";
      const itemList = Object.values(cand.equippedItemIds).filter(Boolean).map((id) => {
        const itemDef = ITEM_REGISTRY[id!];
        return itemDef?.displayName ?? id;
      }).join(", ");
      items.textContent = itemList ? `Starts with: ${itemList}` : "No items";
      card.appendChild(items);

      const acceptBtn = document.createElement("button");
      acceptBtn.textContent = "Recruit";
      acceptBtn.style.cssText = "margin-top:10px;padding:8px 16px;";
      acceptBtn.addEventListener("click", () => this.onRecruit(container, cand, candidates));
      card.appendChild(acceptBtn);

      cardRow.appendChild(card);
    }

    const petCard = document.createElement("div");
    petCard.style.cssText = "border:2px solid #8c4;border-radius:8px;padding:16px;background:#1a2a1a;text-align:center;min-width:160px;";
    petCard.innerHTML = `<div style="font-weight:bold;font-size:16px;color:#8c4;">Pack Mule</div><div style="font-size:12px;color:#aaa;margin:8px 0;">+20% gold rewards</div>`;
    const petBtn = document.createElement("button");
    petBtn.textContent = "Accept";
    petBtn.style.cssText = "margin-top:10px;padding:8px 16px;";
    petBtn.addEventListener("click", () => this.onPetAccept());
    petCard.appendChild(petBtn);
    cardRow.appendChild(petCard);

    container.appendChild(cardRow);

    const skipBtn = document.createElement("button");
    skipBtn.textContent = "Skip";
    skipBtn.style.cssText = "padding:10px 32px;font-size:16px;margin-top:12px;";
    skipBtn.addEventListener("click", () => {
      const run = gameState.run;
      if (run) run.mapState.nodesCleared++;
      gameState.screen = "map";
      this.app.render();
    });
    container.appendChild(skipBtn);

    return container;
  }

  private onRecruit(container: HTMLElement, cand: PartyMember, candidates: PartyMember[]): void {
    const run = gameState.run!;
    if (run.party.length < PARTY_CAP) {
      addRecruitToParty(run.party, cand, run.inventory.items);
      this.resultText = `${cand.displayName} joins the party!`;
      this.phase = "result";
      this.app.render();
    } else {
      this.pendingRecruit = cand;
      this.phase = "replace";
      this.app.render();
    }
  }

  private onPetAccept(): void {
    const run = gameState.run!;
    const hasPackMule = run.runModifiers.some((m) => m.kind === "gold_multiplier");
    if (!hasPackMule) {
      run.runModifiers.push(createPackMuleModifier());
    }
    this.resultText = "Pack Mule follows your party! Gold rewards increased by 20%.";
    this.phase = "result";
    this.app.render();
  }

  private renderReplacePicker(candidates: PartyMember[], recruit: PartyMember): HTMLElement {
    const run = gameState.run!;
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;";

    const label = document.createElement("div");
    label.textContent = "Party is full. Replace which hero?";
    label.style.cssText = "font-size:16px;margin-bottom:8px;color:#ff8;";
    wrap.appendChild(label);

    for (let i = 0; i < run.party.length; i++) {
      const pm = run.party[i];
      const classDef = CLASS_REGISTRY[pm.classId];
      const btn = document.createElement("button");
      btn.textContent = `${classDef?.displayName ?? pm.classId} — ${pm.displayName} (Lv.${pm.level})`;
      btn.style.cssText = "padding:8px 16px;font-size:13px;width:300px;";
      btn.addEventListener("click", () => {
        addRecruitToParty(run.party, recruit, run.inventory.items, i);
        this.resultText = `${recruit.displayName} joins! ${pm.displayName} dismissed (items stashed).`;
        this.phase = "result";
        this.pendingRecruit = null;
        this.app.render();
      });
      wrap.appendChild(btn);
    }

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:8px 16px;font-size:13px;margin-top:8px;";
    cancelBtn.addEventListener("click", () => {
      this.phase = "menu";
      this.pendingRecruit = null;
      this.app.render();
    });
    wrap.appendChild(cancelBtn);

    return wrap;
  }
}
