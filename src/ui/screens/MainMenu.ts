import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import { initCombatState } from "../../state/GameState.ts";
import type { RunState, PartyMember } from "../../state/RunState.ts";
import { createInventory } from "../../run/Inventory.ts";
import { CLASS_REGISTRY, HERO_DEFAULT_NAMES } from "../../data/classes.ts";
import { ITEM_REGISTRY } from "../../data/items.ts";
import { computeStats } from "../../combat/Stats.ts";

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

function initNewRun(): RunState {
  const party = createStartingParty();
  return {
    seed: Date.now(),
    gold: 0,
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

    const newRunBtn = document.createElement("button");
    newRunBtn.textContent = "New Run";
    newRunBtn.style.cssText = "padding:10px 24px;font-size:16px;";
    newRunBtn.addEventListener("click", () => {
      gameState.run = initNewRun();
      gameState.combat = null;
      gameState.screen = "map";
      this.app.render();
    });
    container.appendChild(newRunBtn);

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
