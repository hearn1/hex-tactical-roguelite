import type { App } from "../App.ts";
import { gameState, routeAfterXp } from "../../state/GameState.ts";
import type { CombatReward, RewardCard } from "../../run/RewardManager.ts";
import { generateReward, applyGoldModifiers, applyXpModifiers, applyEliteRewardMultiplier, applyDifficultyToReward, applyDifficultyToXp } from "../../run/RewardManager.ts";
import { applyXp } from "../../run/Leveling.ts";
import { enqueuePendingLevelUps } from "../../run/LevelUp.ts";
import { ITEM_REGISTRY, describeItem } from "../../data/items.ts";
import { canEquipWithAttunement } from "../../run/Attunement.ts";
import { POTION_REGISTRY } from "../../data/potions.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import type { UnitInstance } from "../../state/types.ts";
import { visitNode } from "../../run/MapGraph.ts";
import { NODE_REGISTRY } from "../../data/nodes.ts";
import { ensureRunRestState, syncHitDiceForPartyMember } from "../../run/Rest.ts";
import { appendAdventureLogOnce } from "../../run/AdventureLog.ts";

let rewardCache: CombatReward | null = null;
let chosenCardIndex: number | null = null;
let equipPhase: boolean = false;
let levelUpTexts: string[] = [];
let equipMessage: string = "";

export function resetRewardScreenState(): void {
  rewardCache = null;
  chosenCardIndex = null;
  equipPhase = false;
  levelUpTexts = [];
  equipMessage = "";
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
        rewardCache.xpPerHero = applyXpModifiers(rewardCache.xpPerHero, run.runModifiers);
        rewardCache.xpPerHero = applyDifficultyToXp(rewardCache.xpPerHero, run.difficulty);
        // Check if we're on an elite node for elite reward multiplier
        const nd = NODE_REGISTRY[run.mapState.currentNodeId];
        if (nd?.type === "elite") {
          rewardCache.gold = applyEliteRewardMultiplier(rewardCache.gold, run.runModifiers);
          rewardCache.xpPerHero = applyEliteRewardMultiplier(rewardCache.xpPerHero, run.runModifiers);
        }
      }
      inv.gold += rewardCache.gold;
      if (run) {
        ensureRunRestState(run);
        run.gold += rewardCache.gold;
        run.campSupplies = (run.campSupplies ?? 0) + rewardCache.campSupplies;
      }

      const survivors = cs.units.filter((u) => u.team === "hero" && u.hp > 0);
      for (const hero of survivors) {
        // applyXp adds the XP itself; enqueue any in-range level-ups for the choice screen.
        const result = applyXp(hero, rewardCache.xpPerHero);
        if (result.leveledUp) {
          const gainStr = Object.entries(result.gains)
            .filter(([, v]) => v !== undefined && v > 0)
            .map(([k, v]) => `+${v} ${k}`)
            .join(", ");
          levelUpTexts.push(`${hero.displayName} reaches Level ${result.newLevel}! (${gainStr})`);
          enqueuePendingLevelUps(gameState.pendingLevelUps, hero.instanceId, hero.defId, result.levelsGained);
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

    if (run) {
      const suppliesLine = document.createElement("div");
      suppliesLine.textContent = `Camp Supplies +${rewardCache.campSupplies} (total: ${run.campSupplies ?? 0})`;
      container.appendChild(suppliesLine);
    }

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
      const desc = itemDef ? describeItem(card.itemId) : "";
      el.innerHTML = `<div style="font-weight:bold;color:#8cf;">Item</div><div style="font-size:13px;margin-top:4px;">${itemDef?.displayName ?? card.itemId}</div><div style="font-size:10px;color:#aaa;margin-top:2px;">${desc}</div>`;
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
    const run = gameState.run;
    const inv = run ? run.inventory : gameState.inventory;

    if (card.kind === "item") {
      equipPhase = true;
      this.renderEquipPhase(card.itemId);
    } else if (card.kind === "potion") {
      inv.potions.push(card.potionId);
      if (run) {
        const def = POTION_REGISTRY[card.potionId];
        appendAdventureLogOnce(run, `loot_gained:reward:${card.potionId}:${index}`, {
          kind: "loot_gained",
          text: `Gained ${def?.displayName ?? card.potionId}.`,
          itemId: card.potionId,
          nodeId: run.mapState.currentNodeId,
        });
      }
      equipPhase = false;
      this.renderContinue();
    } else {
      inv.gold += card.amount;
      if (run) run.gold += card.amount;
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
    const itemDef = ITEM_REGISTRY[itemId];
    const attuneTag = itemDef?.requiresAttunement ? " (Requires Attunement)" : "";
    label.textContent = `Equip ${itemDef?.displayName ?? itemId}${attuneTag} to:`;
    target.appendChild(label);

    if (equipMessage) {
      const msg = document.createElement("div");
      msg.style.cssText = "margin-bottom:8px;font-size:12px;color:#f99;";
      msg.textContent = equipMessage;
      target.appendChild(msg);
    }

    const cs = gameState.combat;
    if (!cs) return;
    const heroes = cs.units.filter((u) => u.team === "hero" && u.hp > 0);
    const buttonsDiv = document.createElement("div");
    buttonsDiv.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;justify-content:center;";

    for (const hero of heroes) {
      const btn = document.createElement("button");
      const classDef = CLASS_REGISTRY[hero.defId];
      btn.textContent = classDef?.displayName ?? hero.displayName;
      const attune = canEquipWithAttunement(hero.equippedItemIds, itemId);
      btn.disabled = !attune.ok;
      btn.title = attune.ok ? "" : attune.reason ?? "";
      btn.addEventListener("click", () => this.onEquipToHero(hero, itemId));
      buttonsDiv.appendChild(btn);
    }

    const stashBtn = document.createElement("button");
    stashBtn.textContent = "Stash";
    stashBtn.setAttribute("data-testid", "stash-btn");
    stashBtn.addEventListener("click", () => {
      const run = gameState.run;
      const inv = run ? run.inventory : gameState.inventory;
      inv.items.push(itemId);
      if (run) {
        const def = ITEM_REGISTRY[itemId];
        appendAdventureLogOnce(run, `loot_gained:reward:${itemId}`, {
          kind: "loot_gained",
          text: `Gained ${def?.displayName ?? itemId}.`,
          itemId,
          nodeId: run.mapState.currentNodeId,
        });
      }
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

    const attune = canEquipWithAttunement(hero.equippedItemIds, newItemId);
    if (!attune.ok) {
      equipMessage = `${hero.displayName}: ${attune.reason ?? "Cannot attune."}`;
      this.renderEquipPhase(newItemId);
      this.app.render();
      return;
    }

    equipMessage = "";
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

    const run = gameState.run;
    if (run) {
      const def = ITEM_REGISTRY[newItemId];
      appendAdventureLogOnce(run, `loot_gained:reward:${newItemId}`, {
        kind: "loot_gained",
        text: `Gained ${def?.displayName ?? newItemId}.`,
        itemId: newItemId,
        nodeId: run.mapState.currentNodeId,
      });
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
            // Persist the reward-time auto level-up stat gains so chosen upgrades stack on top (F29).
            pm.bonusStats = { ...unit.bonusStats };
            syncHitDiceForPartyMember(pm);
          }
        }
        const nd = NODE_REGISTRY[run.mapState.currentNodeId];
        const nodeId = run.mapState.currentNodeId;
        const encounterName = cs.units.find((u) => u.team === "enemy")?.displayName ?? nd?.title ?? "Combat";
        if (nd?.type === "boss") {
          run.mapState.bossDefeated = true;
          run.runStatus = "won";
          appendAdventureLogOnce(run, `boss_defeated:${nodeId}`, {
            kind: "boss_defeated",
            text: `Defeated the boss: ${encounterName}.`,
            nodeId,
          });
          appendAdventureLogOnce(run, "run_end:won", {
            kind: "run_end",
            text: "Run won after defeating the boss.",
            runStatus: "won",
          });
        }
        if (nd?.type === "elite") {
          run.mapState.elitesDefeated++;
          appendAdventureLogOnce(run, `elite_defeated:${nodeId}`, {
            kind: "elite_defeated",
            text: `Defeated elite encounter: ${encounterName}.`,
            nodeId,
          });
        }
        run.mapState.nodesCleared++;
      }

  gameState.combat = null;
  if (run) {
    // Divert through the level-up choice screen first if any are queued (F29).
    routeAfterXp(run.runStatus === "won" ? "run_summary" : "map");
  } else {
    gameState.screen = "main_menu";
  }
      resetRewardScreenState();
      this.app.render();
    });
    target.appendChild(btn);
  }
}
