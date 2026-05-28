import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import type { RunState } from "../../state/RunState.ts";
import { rollShopInventory, ITEM_PRICE, POTION_PRICE, HEAL_SERVICE_PRICE, buyShopItem, buyShopPotion, useHealService, equipShopItem, stashShopItem } from "../../run/Shop.ts";
import { ITEM_REGISTRY } from "../../data/items.ts";
import { POTION_REGISTRY } from "../../data/potions.ts";

let pendingPurchasedItemId: string | null = null;
let shopMessage: string = "";

export function resetShopScreenState(): void {
  pendingPurchasedItemId = null;
  shopMessage = "";
}

const STAT_LABELS: Record<string, string> = {
  maxHp: "Max HP",
  armor: "Armor",
  move: "Move",
  might: "Might",
  agility: "Agility",
  spirit: "Spirit",
};

function describeItem(id: string): string {
  const def = ITEM_REGISTRY[id];
  if (!def) return "Unknown item";
  const parts: string[] = [def.rarity, def.slot];
  if (def.statBonuses) {
    for (const [k, v] of Object.entries(def.statBonuses)) {
      if (v) parts.push(`${STAT_LABELS[k] ?? k} +${v}`);
    }
  }
  if (def.grantedActionIds?.length) {
    parts.push(`Grants ${def.grantedActionIds.length} action(s)`);
  }
  return parts.join(" | ");
}

export class ShopScreen {
  private app: App;

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
    if (!run.shopStates[nodeId]) {
      run.shopStates[nodeId] = rollShopInventory(gameState.rng);
    }
    const shop = run.shopStates[nodeId];

    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:20px;gap:16px;max-width:800px;margin:0 auto;";

    const title = document.createElement("h2");
    title.textContent = "Traveling Merchant";
    container.appendChild(title);

    const goldLine = document.createElement("div");
    goldLine.style.cssText = "font-size:16px;color:#ff8;";
    goldLine.textContent = `Gold: ${run.gold}`;
    container.appendChild(goldLine);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;width:100%;";

    const itemsPanel = this.renderItems(shop, run);
    const potionsPanel = this.renderPotions(shop, run);
    const servicesPanel = this.renderServices(shop, run);

    grid.appendChild(itemsPanel);
    grid.appendChild(potionsPanel);
    grid.appendChild(servicesPanel);
    container.appendChild(grid);

    if (pendingPurchasedItemId) {
      container.appendChild(this.renderEquipOrStash(run, pendingPurchasedItemId));
    }

    if (shopMessage) {
      const msg = document.createElement("div");
      msg.style.cssText = "color:#4f4;font-weight:bold;margin-top:8px;";
      msg.textContent = shopMessage;
      container.appendChild(msg);
    }

    const leaveBtn = document.createElement("button");
    leaveBtn.textContent = "Leave Shop";
    leaveBtn.disabled = pendingPurchasedItemId !== null;
    leaveBtn.title = pendingPurchasedItemId ? "Equip or stash the purchased item first." : "";
    leaveBtn.style.cssText = "padding:10px 32px;font-size:16px;margin-top:12px;";
    leaveBtn.addEventListener("click", () => {
      if (pendingPurchasedItemId) return;
      const run = gameState.run;
      if (run) run.mapState.nodesCleared++;
      gameState.screen = "map";
      this.app.render();
    });
    container.appendChild(leaveBtn);

    return container;
  }

  private renderItems(shop: ReturnType<typeof rollShopInventory>, run: NonNullable<RunState>): HTMLElement {
    const panel = document.createElement("div");
    panel.style.cssText = "border:1px solid #555;border-radius:8px;padding:12px;background:#1a1a3a;";

    const heading = document.createElement("h3");
    heading.textContent = "Items";
    heading.style.cssText = "margin-bottom:8px;";
    panel.appendChild(heading);

    for (let i = 0; i < shop.items.length; i++) {
      const entry = shop.items[i];
      const def = ITEM_REGISTRY[entry.itemId];
      const price = ITEM_PRICE[def?.rarity ?? "common"] ?? 8;
      const mustResolvePurchase = pendingPurchasedItemId !== null;
      const canAfford = run.gold >= price && !entry.sold && !mustResolvePurchase;

      const card = document.createElement("div");
      card.style.cssText = `border:1px solid ${entry.sold ? "#333" : "#555"};border-radius:6px;padding:8px;margin-bottom:8px;background:#2a2a4a;${entry.sold ? "opacity:0.5;" : ""}`;

      const name = document.createElement("div");
      name.style.cssText = "font-weight:bold;font-size:14px;";
      name.textContent = def?.displayName ?? entry.itemId;
      card.appendChild(name);

      const desc = document.createElement("div");
      desc.style.cssText = "font-size:11px;color:#aaa;margin:4px 0;";
      desc.textContent = describeItem(entry.itemId);
      card.appendChild(desc);

      const priceEl = document.createElement("div");
      priceEl.style.cssText = "font-size:13px;color:#ff8;";
      priceEl.textContent = entry.sold ? "Sold" : `${price} gold`;
      card.appendChild(priceEl);

      if (!entry.sold) {
        const buyBtn = document.createElement("button");
        buyBtn.setAttribute("data-testid", `shop-buy-item-${i}`);
        buyBtn.textContent = mustResolvePurchase ? "Resolve item first" : canAfford ? "Buy" : "Not enough gold";
        buyBtn.disabled = !canAfford;
        buyBtn.title = mustResolvePurchase ? "Equip or stash the purchased item first." : canAfford ? "" : "Not enough gold";
        buyBtn.style.cssText = "margin-top:4px;";
        buyBtn.addEventListener("click", () => {
          if (!canAfford || pendingPurchasedItemId) return;
          if (buyShopItem(shop, i)) {
            run.gold -= price;
            run.inventory.gold = run.gold;
            const livingParty = run.party.filter((pm) => pm.hp > 0);
            if (livingParty.length === 0) {
              stashShopItem(run.inventory, entry.itemId);
              shopMessage = `Bought ${def?.displayName ?? entry.itemId} and stashed it.`;
            } else {
              pendingPurchasedItemId = entry.itemId;
              shopMessage = `Bought ${def?.displayName ?? entry.itemId}. Choose a hero to equip it or stash it.`;
            }
            this.app.render();
          }
        });
        card.appendChild(buyBtn);
      }

      panel.appendChild(card);
    }

    return panel;
  }

  private renderPotions(shop: ReturnType<typeof rollShopInventory>, run: NonNullable<RunState>): HTMLElement {
    const panel = document.createElement("div");
    panel.style.cssText = "border:1px solid #555;border-radius:8px;padding:12px;background:#1a1a3a;";

    const heading = document.createElement("h3");
    heading.textContent = "Potions";
    heading.style.cssText = "margin-bottom:8px;";
    panel.appendChild(heading);

    for (let i = 0; i < shop.potions.length; i++) {
      const entry = shop.potions[i];
      const def = POTION_REGISTRY[entry.potionId];
      const price = POTION_PRICE[entry.potionId] ?? 10;
      const mustResolvePurchase = pendingPurchasedItemId !== null;
      const canAfford = run.gold >= price && !entry.sold && !mustResolvePurchase;

      const card = document.createElement("div");
      card.style.cssText = `border:1px solid ${entry.sold ? "#333" : "#555"};border-radius:6px;padding:8px;margin-bottom:8px;background:#2a2a4a;${entry.sold ? "opacity:0.5;" : ""}`;

      const name = document.createElement("div");
      name.style.cssText = "font-weight:bold;font-size:14px;";
      name.textContent = def?.displayName ?? entry.potionId;
      card.appendChild(name);

      const desc = document.createElement("div");
      desc.style.cssText = "font-size:11px;color:#aaa;margin:4px 0;";
      desc.textContent = def?.description ?? "";
      card.appendChild(desc);

      const priceEl = document.createElement("div");
      priceEl.style.cssText = "font-size:13px;color:#ff8;";
      priceEl.textContent = entry.sold ? "Sold" : `${price} gold`;
      card.appendChild(priceEl);

      if (!entry.sold) {
        const buyBtn = document.createElement("button");
        buyBtn.setAttribute("data-testid", `shop-buy-potion-${i}`);
        buyBtn.textContent = mustResolvePurchase ? "Resolve item first" : canAfford ? "Buy" : "Not enough gold";
        buyBtn.disabled = !canAfford;
        buyBtn.title = mustResolvePurchase ? "Equip or stash the purchased item first." : canAfford ? "" : "Not enough gold";
        buyBtn.style.cssText = "margin-top:4px;";
        buyBtn.addEventListener("click", () => {
          if (!canAfford || pendingPurchasedItemId) return;
          if (buyShopPotion(shop, i)) {
            run.gold -= price;
            run.inventory.gold = run.gold;
            run.inventory.potions.push(entry.potionId);
            shopMessage = `Bought ${def?.displayName ?? entry.potionId}.`;
            this.app.render();
          }
        });
        card.appendChild(buyBtn);
      }

      panel.appendChild(card);
    }

    return panel;
  }

  private renderServices(shop: ReturnType<typeof rollShopInventory>, run: NonNullable<RunState>): HTMLElement {
    const panel = document.createElement("div");
    panel.style.cssText = "border:1px solid #555;border-radius:8px;padding:12px;background:#1a1a3a;";

    const heading = document.createElement("h3");
    heading.textContent = "Services";
    heading.style.cssText = "margin-bottom:8px;";
    panel.appendChild(heading);

    const card = document.createElement("div");
    card.style.cssText = `border:1px solid ${shop.healServiceUsed ? "#333" : "#555"};border-radius:6px;padding:8px;background:#2a2a4a;${shop.healServiceUsed ? "opacity:0.5;" : ""}`;

    const name = document.createElement("div");
    name.style.cssText = "font-weight:bold;font-size:14px;";
    name.textContent = "Heal Party";
    card.appendChild(name);

    const desc = document.createElement("div");
    desc.style.cssText = "font-size:11px;color:#aaa;margin:4px 0;";
    desc.textContent = "Restore 8 HP to each living hero.";
    card.appendChild(desc);

    const priceEl = document.createElement("div");
    priceEl.style.cssText = "font-size:13px;color:#ff8;";
    priceEl.textContent = shop.healServiceUsed ? "Already used" : `${HEAL_SERVICE_PRICE} gold`;
    card.appendChild(priceEl);

    if (!shop.healServiceUsed) {
      const mustResolvePurchase = pendingPurchasedItemId !== null;
      const canAfford = run.gold >= HEAL_SERVICE_PRICE && !mustResolvePurchase;
      const buyBtn = document.createElement("button");
      buyBtn.setAttribute("data-testid", "shop-buy-heal-service");
      buyBtn.textContent = mustResolvePurchase ? "Resolve item first" : canAfford ? "Buy" : "Not enough gold";
      buyBtn.disabled = !canAfford;
      buyBtn.title = mustResolvePurchase ? "Equip or stash the purchased item first." : canAfford ? "" : "Not enough gold";
      buyBtn.style.cssText = "margin-top:4px;";
      buyBtn.addEventListener("click", () => {
        if (!canAfford || pendingPurchasedItemId) return;
        if (useHealService(shop, run.party)) {
          run.gold -= HEAL_SERVICE_PRICE;
          run.inventory.gold = run.gold;
          shopMessage = "Party healed for 8 HP each!";
          this.app.render();
        }
      });
      card.appendChild(buyBtn);
    }

    panel.appendChild(card);

    const partyHeading = document.createElement("h3");
    partyHeading.textContent = "Party";
    partyHeading.style.cssText = "margin-top:16px;margin-bottom:8px;";
    panel.appendChild(partyHeading);

    for (const pm of run.party) {
      const pEl = document.createElement("div");
      pEl.style.cssText = "font-size:12px;color:#ccc;margin:2px 0;";
      pEl.textContent = `${pm.displayName} (${pm.classId.slice(6)}) HP: ${pm.hp}/${pm.maxHp}`;
      panel.appendChild(pEl);
    }

    return panel;
  }

  private renderEquipOrStash(run: NonNullable<RunState>, itemId: string): HTMLElement {
    const itemDef = ITEM_REGISTRY[itemId];
    const panel = document.createElement("div");
    panel.setAttribute("data-testid", "shop-equip-panel");
    panel.style.cssText = "border:2px solid #fa0;border-radius:8px;padding:12px;background:#2a2a4a;width:100%;text-align:center;";

    const title = document.createElement("div");
    title.style.cssText = "font-weight:bold;margin-bottom:6px;";
    title.textContent = `Equip or stash ${itemDef?.displayName ?? itemId}`;
    panel.appendChild(title);

    const desc = document.createElement("div");
    desc.style.cssText = "font-size:12px;color:#ccc;margin-bottom:10px;";
    desc.textContent = itemDef ? `${itemDef.rarity} ${itemDef.slot}` : "Unknown item";
    panel.appendChild(desc);

    const choices = document.createElement("div");
    choices.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;justify-content:center;";

    for (const pm of run.party.filter((member) => member.hp > 0)) {
      const btn = document.createElement("button");
      btn.setAttribute("data-testid", `shop-equip-${pm.instanceId}`);
      const replacedItemId = itemDef ? pm.equippedItemIds[itemDef.slot] : null;
      const replacementText = replacedItemId ? `replace ${ITEM_REGISTRY[replacedItemId]?.displayName ?? replacedItemId}` : `${itemDef?.slot ?? "slot"} empty`;
      btn.textContent = `${pm.displayName} (${replacementText})`;
      btn.addEventListener("click", () => {
        const replaced = equipShopItem(pm, itemId, run.inventory);
        pendingPurchasedItemId = null;
        const itemName = itemDef?.displayName ?? itemId;
        if (replaced) {
          const replacedName = ITEM_REGISTRY[replaced]?.displayName ?? replaced;
          shopMessage = `Equipped ${itemName} to ${pm.displayName}. ${replacedName} was stashed.`;
        } else {
          shopMessage = `Equipped ${itemName} to ${pm.displayName}.`;
        }
        this.app.render();
      });
      choices.appendChild(btn);
    }

    const stashBtn = document.createElement("button");
    stashBtn.textContent = "Stash";
    stashBtn.setAttribute("data-testid", "shop-stash-btn");
    stashBtn.addEventListener("click", () => {
      stashShopItem(run.inventory, itemId);
      pendingPurchasedItemId = null;
      shopMessage = `Stashed ${itemDef?.displayName ?? itemId}.`;
      this.app.render();
    });
    choices.appendChild(stashBtn);

    panel.appendChild(choices);
    return panel;
  }
}
