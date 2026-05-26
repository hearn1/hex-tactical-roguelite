import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import { initCombatState } from "../../state/GameState.ts";
import type { RunState, PartyMember, Difficulty } from "../../state/RunState.ts";
import { createInventory } from "../../run/Inventory.ts";
import { CLASS_REGISTRY, HERO_DEFAULT_NAMES } from "../../data/classes.ts";
import { ITEM_REGISTRY } from "../../data/items.ts";
import { computeStats } from "../../combat/Stats.ts";
import { applyMetaUpgradesToFreshRun } from "../../meta/Upgrades.ts";
import { DIFFICULTY_CONFIG } from "../../data/difficulty.ts";

function createStartingParty(): PartyMember[] {
  const classIds = ["class.guardian", "class.acolyte", "class.arcanist"];
  return classIds.map((classId, i) => {
    const def = CLASS_REGISTRY[classId];
    const displayName = HERO_DEFAULT_NAMES[classId] ?? `Hero ${i + 1}`;
    const equippedItemIds: { weapon: string | null; armor: string | null; trinket: string | null } = {
      weapon: null, armor: null, trinket: null,
    };
    for (const itemId of def.startingItems ?? []) {
      const itemDef = ITEM_REGISTRY[itemId];
      if (!itemDef) continue;
      const slot = itemDef.slot;
      if (!equippedItemIds[slot]) {
        equippedItemIds[slot] = itemId;
      }
    }
    return {
      instanceId: `hero_00${i + 1}`,
      classId,
      displayName,
      level: 1,
      xp: 0,
      hp: def.baseStats.maxHp,
      maxHp: def.baseStats.maxHp,
      bonusStats: {},
      equippedItemIds,
    };
  });
}

function initNewRun(difficulty: Difficulty = "normal"): RunState {
  const party = createStartingParty();
  const diffConfig = DIFFICULTY_CONFIG[difficulty];
  const startingGold = Math.floor(30 * diffConfig.startingGoldMultiplier);
  return {
    seed: Date.now(),
    gold: startingGold,
    party,
    inventory: createInventory(),
    mapState: {
      currentNodeId: "node.start",
      visitedNodeIds: ["node.start"],
      nodesCleared: 0,
      elitesDefeated: 0,
      bossDefeated: false,
    },
    runStatus: "active",
    shopStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty,
    eventSelections: {},
  };
}

export class MainMenu {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding-top:80px;gap:16px;";

    const title = document.createElement("h1");
    title.textContent = "DnRogueLite — Prototype";
    container.appendChild(title);

    const diffRow = document.createElement("div");
    diffRow.style.cssText = "display:flex;gap:8px;align-items:center;";
    const diffLabel = document.createElement("span");
    diffLabel.style.cssText = "font-size:14px;";
    diffLabel.textContent = "Difficulty:";
    diffRow.appendChild(diffLabel);

    let currentDiff: Difficulty = "normal";
    const diffBtn = document.createElement("button");
    diffBtn.textContent = "Normal";
    diffBtn.style.cssText = "padding:4px 12px;font-size:13px;min-width:80px;";
    diffBtn.addEventListener("click", () => {
      currentDiff = currentDiff === "normal" ? "hard" : "normal";
      diffBtn.textContent = currentDiff.charAt(0).toUpperCase() + currentDiff.slice(1);
      diffBtn.style.color = currentDiff === "hard" ? "#f44" : "#fff";
    });
    diffRow.appendChild(diffBtn);
    container.appendChild(diffRow);

    const newRunBtn = document.createElement("button");
    newRunBtn.textContent = "New Run";
    newRunBtn.style.cssText = "padding:10px 24px;font-size:16px;";
    newRunBtn.addEventListener("click", () => {
      const run = initNewRun(currentDiff);
      applyMetaUpgradesToFreshRun(run, gameState.meta);
      gameState.run = run;
      gameState.combat = null;
      gameState.screen = "map";
      this.app.render();
    });
    container.appendChild(newRunBtn);

    const metaBtn = document.createElement("button");
    metaBtn.textContent = "Meta Upgrades";
    metaBtn.style.cssText = "padding:10px 24px;font-size:16px;";
    metaBtn.addEventListener("click", () => {
      gameState.screen = "meta_upgrades";
      this.app.render();
    });
    container.appendChild(metaBtn);

    const devLink = document.createElement("a");
    devLink.textContent = "Dev: Combat Sandbox";
    devLink.style.cssText = "font-size:12px;color:#666;cursor:pointer;margin-top:4px;text-decoration:underline;";
    devLink.addEventListener("click", () => {
      gameState.run = null;
      gameState.combat = null;
      gameState.screen = "combat";
      this.app.render();
    });
    container.appendChild(devLink);

    return container;
  }
}
