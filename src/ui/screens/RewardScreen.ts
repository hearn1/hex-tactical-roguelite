import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import type { CombatReward, RewardCard } from "../../run/RewardManager.ts";
import { generateReward, applyGoldModifiers, applyDifficultyToReward, applyDifficultyToXp } from "../../run/RewardManager.ts";
import { applyXp } from "../../run/Leveling.ts";
import { ITEM_REGISTRY } from "../../data/items.ts";
import { POTION_REGISTRY } from "../../data/potions.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import type { UnitInstance } from "../../state/types.ts";
import { visitNode } from "../../run/MapGraph.ts";
import { NODE_REGISTRY } from "../../data/nodes.ts";

let rewardCache: CombatReward | null = null;
let chosenCardIndex: number | null = null;
let equipPhase: boolean = false;
let levelUpTexts: string[] = [];

export function resetRewardScreenState(): void {
  rewardCache = null;
  chosenCardIndex = null;
  equipPhase = false;
  levelUpTexts = [];
}

export class RewardScreen {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const cs = gameState.combat;
    if (!cs) {
      gameState.screen = "main_menu";
      this.app.render();
      return document.createElement("div");
    }

    const run = gameState.run;
    const inv = run ? run.inventory : gameState.inventory;

    if (!rewardCache) {
      const numEnemies = cs.units.filter((u) => u.team === "enemy").length;
      const encounterPlaceholder = {
        id: "encounter._reward",
        displayName: "Combat",
        enemyGroups: cs.units.filter((u) => u.team === "enemy").map((u) => ({
          enemyId: u.defId,
          count: 1,
        })),
      };

      rewardCache = generateReward(encounterPlaceholder, gameState.rng);
      if (run) {
        rewardCache.gold = applyGoldModifiers(rewardCache.gold, run.runModifiers);
        rewardCache.gold = applyDifficultyToReward(rewardCache.gold, run.difficulty);
        rewardCache.xpPerHero = applyDifficultyToXp(rewardCache.xpPerHero, run.difficulty);
      }
      inv.gold += rewardCache.gold;
      if (run) run.gold += rewardCache.gold;

      const survivors = cs.units.filter((u) => u.team === "hero" && u.hp > 0);
      for (const hero of survivors) {
        hero.xp += rewardCache.xpPerHero;
        const result = applyXp(hero, rewardCache.xpPerHero);
        if (result.leveledUp) {
          const gainStr = Object.entries(result.gains)
            .filter(([, v]) => v !== undefined && v > 0)
            .map(([k, v]) => `+${v} ${k}`)
            .join(", ");
          levelUpTexts.push(`${hero.displayName} reaches Level ${result.newLevel}! (${gainStr})`);
        }
      }
    }

    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:16px;max-width:600px;margin:0 auto;";

    const title = document.createElement("h2");
    title.textContent = "Victory!";
    container.appendChild(title);

    const xpLine = document.createElement("div");
    xpLine.textContent = `XP +${rewardCache.xpPerHero} per surviving hero`;
    container.appendChild(xpLine);

    for (const ltxt of levelUpTexts) {
      const lEl = document.createElement("div");
      lEl.style.cssText = "color:#4f4;font-weight:bold;";
      lEl.textContent = ltxt;
      container.appendChild(lEl);
    }

    const goldLine = document.createElement("div");
    goldLine.textContent = `Gold +${rewardCache.gold} (total: ${inv.gold})`;
    container.appendChild(goldLine);

    if (chosenCardIndex === null) {
      const cardLabel = document.createElement("div");
      cardLabel.style.cssText = "font-size:14px;color:#aaa;margin-top:12px;";
      cardLabel.textContent = "Choose one reward:";
      container.appendChild(cardLabel);

      const cardsRow = document.createElement("div");
      cardsRow.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;justify-content:center;";

      for (let i = 0; i < rewardCache.cards.length; i++) {
        const card = rewardCache.cards[i];
        const cardEl = this.buildCard(card, i);
        cardsRow.appendChild(cardEl);
      }
      container.appendChild(cardsRow);
    }

    const equipArea = document.createElement("div");
    equipArea.id = "equip-area";
    equipArea.style.cssText = "min-height:40px;";
    container.appendChild(equipArea);

    const continueArea = document.createElement("div");
    continueArea.id = "continue-area";
    continueArea.style.cssText = "min-height:40px;";
    container.appendChild(continueArea);

    if (chosenCardIndex !== null) {
      if (equipPhase) {
        const chosenCard = rewardCache.cards[chosenCardIndex];
        if (chosenCard && chosenCard.kind === "item") {
          this.renderEquipPhase(chosenCard.itemId, equipArea);
        }
      } else {
        this.renderContinue(continueArea);
      }
    }

    return container;
  }

  private buildCard(card: RewardCard, index: number): HTMLElement {
    const el = document.createElement("div");
    el.setAttribute("data-testid", `reward-card-${index}`);
    el.style.cssText = "border:2px solid #555;border-radius:8px;padding:16px 24px;cursor:pointer;background:#2a2a4a;text-align:center;min-width:140px;";

    if (card.kind === "item") {
      const itemDef = ITEM_REGISTRY[card.itemId];
      el.innerHTML = `<div style="font-weight:bold;color:#8cf;">Item</div><div style="font-size:13px;margin-top:4px;">${itemDef?.displayName ?? card.itemId}</div>`;
    } else if (card.kind === "potion") {
      const potionDef = POTION_REGISTRY[card.potionId];
      el.innerHTML = `<div style="font-weight:bold;color:#8f8;">Potion</div><div style="font-size:13px;margin-top:4px;">${potionDef?.displayName ?? card.potionId}</div>`;
    } else {
      el.innerHTML = `<div style="font-weight:bold;color:#ff8;">Gold</div><div style="font-size:13px;margin-top:4px;">+${card.amount}</div>`;
    }

    if (chosenCardIndex !== null && chosenCardIndex !== index) {
      el.style.opacity = "0.4";
      el.style.cursor = "default";
    } else if (chosenCardIndex === index) {
      el.style.borderColor = "#fa0";
      el.style.background = "#3a3a5a";
    } else {
      el.addEventListener("click", () => this.onCardClick(card, index));
    }

    return el;
  }

  private onCardClick(card: RewardCard, index: number): void {
    chosenCardIndex = index;
    const inv = gameState.run ? gameState.run.inventory : gameState.inventory;

    if (card.kind === "item") {
      equipPhase = true;
      this.renderEquipPhase(card.itemId);
    } else if (card.kind === "potion") {
      inv.potions.push(card.potionId);
      equipPhase = false;
      this.renderContinue();
    } else {
      inv.gold += card.amount;
      if (gameState.run) gameState.run.gold += card.amount;
      equipPhase = false;
      this.renderContinue();
    }

    this.app.render();
  }

  private renderEquipPhase(itemId: string, area?: HTMLElement): void {
    const target = area ?? document.getElementById("equip-area");
    if (!target) return;
    target.innerHTML = "";

    const label = document.createElement("div");
    label.style.cssText = "margin-bottom:8px;font-size:14px;";
    label.textContent = `Equip ${ITEM_REGISTRY[itemId]?.displayName ?? itemId} to:`;
    target.appendChild(label);

    const cs = gameState.combat;
    if (!cs) return;
    const heroes = cs.units.filter((u) => u.team === "hero" && u.hp > 0);
    const buttonsDiv = document.createElement("div");
    buttonsDiv.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;justify-content:center;";

    for (const hero of heroes) {
      const btn = document.createElement("button");
      const classDef = CLASS_REGISTRY[hero.defId];
      btn.textContent = classDef?.displayName ?? hero.displayName;
      btn.addEventListener("click", () => this.onEquipToHero(hero, itemId));
      buttonsDiv.appendChild(btn);
    }

    const stashBtn = document.createElement("button");
    stashBtn.textContent = "Stash";
    stashBtn.setAttribute("data-testid", "stash-btn");
    stashBtn.addEventListener("click", () => {
      const inv = gameState.run ? gameState.run.inventory : gameState.inventory;
      inv.items.push(itemId);
      equipPhase = false;
      this.renderContinue();
      this.app.render();
    });
    buttonsDiv.appendChild(stashBtn);

    target.appendChild(buttonsDiv);
  }

  private onEquipToHero(hero: UnitInstance, newItemId: string): void {
    const itemDef = ITEM_REGISTRY[newItemId];
    if (!itemDef) return;
    const slot = itemDef.slot;
    const prevItemId = hero.equippedItemIds[slot];
    hero.equippedItemIds[slot] = newItemId;
    if (prevItemId) {
      const inv = gameState.run ? gameState.run.inventory : gameState.inventory;
      inv.items.push(prevItemId);
    }

    const cs = gameState.combat;
    if (cs) {
      const updated = cs.units.find((u) => u.instanceId === hero.instanceId);
      if (updated) {
        updated.equippedItemIds = { ...hero.equippedItemIds };
      }
    }

    equipPhase = false;
    this.renderContinue();
    this.app.render();
  }

  private renderContinue(area?: HTMLElement): void {
    const target = area ?? document.getElementById("continue-area");
    if (!target) return;
    target.innerHTML = "";

    const btn = document.createElement("button");
    btn.textContent = "Continue";
    btn.style.cssText = "padding:10px 32px;font-size:16px;";
    btn.addEventListener("click", () => {
      const run = gameState.run;
      const cs = gameState.combat;

      if (run && cs) {
        for (const pm of run.party) {
          const unit = cs.units.find((u) => u.instanceId === pm.instanceId);
          if (unit) {
            pm.hp = unit.hp > 0 ? unit.hp : 1;
            pm.xp = unit.xp;
            pm.level = unit.level;
          }
        }
        const nd = NODE_REGISTRY[run.mapState.currentNodeId];
        if (nd?.type === "boss") {
          run.mapState.bossDefeated = true;
          run.runStatus = "won";
        }
        if (nd?.type === "elite") {
          run.mapState.elitesDefeated++;
        }
        run.mapState.nodesCleared++;
      }

  gameState.combat = null;
  if (run) {
    if (run.runStatus === "won") {
      gameState.screen = "run_summary";
    } else {
      gameState.screen = "map";
    }
  } else {
    gameState.screen = "main_menu";
  }
      resetRewardScreenState();
      this.app.render();
    });
    target.appendChild(btn);
  }
}
