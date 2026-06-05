import type { App } from "../App.ts";
import { ITEM_REGISTRY, describeItemShort } from "../../data/items.ts";
import { POTION_REGISTRY } from "../../data/potions.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import { gameState } from "../../state/GameState.ts";
import type { PartyMember } from "../../state/RunState.ts";
import {
  EQUIPMENT_SLOTS,
  STAT_KEYS,
  computePartyMemberStats,
  equipBagItemToPartyMember,
  previewEquipItem,
  type EquipmentSlot,
} from "../../run/Equipment.ts";

let selectedBagIndex: number | null = null;
let inventoryMessage = "";

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: "Weapon",
  armor: "Armor",
  trinket: "Trinket",
};

const STAT_LABELS: Record<(typeof STAT_KEYS)[number], string> = {
  maxHp: "Max HP",
  armor: "Armor",
  move: "Move",
  might: "Might",
  agility: "Agility",
  spirit: "Spirit",
};

export function resetInventoryScreenState(): void {
  selectedBagIndex = null;
  inventoryMessage = "";
}

export class InventoryScreen {
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

    if (selectedBagIndex !== null && !run.inventory.items[selectedBagIndex]) {
      selectedBagIndex = null;
    }

    const container = document.createElement("div");
    container.style.cssText =
      "display:flex;flex-direction:column;gap:16px;padding:20px;max-width:1000px;margin:0 auto;";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;";

    const titleGroup = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = "Inventory";
    titleGroup.appendChild(title);

    const goldLine = document.createElement("div");
    goldLine.style.cssText = "font-size:13px;color:#ff8;margin-top:4px;";
    goldLine.textContent = `Gold: ${run.gold}`;
    titleGroup.appendChild(goldLine);
    header.appendChild(titleGroup);

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.setAttribute("data-testid", "inventory-back-btn");
    backBtn.style.cssText = "padding:10px 28px;font-size:15px;";
    backBtn.addEventListener("click", () => {
      resetInventoryScreenState();
      gameState.screen = "map";
      this.app.render();
    });
    header.appendChild(backBtn);
    container.appendChild(header);

    if (inventoryMessage) {
      const message = document.createElement("div");
      message.style.cssText = "border:1px solid #4a8;border-radius:6px;padding:8px 10px;background:#163624;color:#9f9;";
      message.textContent = inventoryMessage;
      container.appendChild(message);
    }

    const layout = document.createElement("div");
    layout.style.cssText = "display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:16px;align-items:start;";
    layout.appendChild(this.renderParty(run.party));
    layout.appendChild(this.renderBag());
    container.appendChild(layout);

    return container;
  }

  private renderParty(party: PartyMember[]): HTMLElement {
    const panel = document.createElement("section");
    panel.style.cssText = "display:flex;flex-direction:column;gap:10px;";

    const heading = document.createElement("h3");
    heading.textContent = "Heroes";
    panel.appendChild(heading);

    for (const hero of party) {
      panel.appendChild(this.renderHero(hero));
    }

    return panel;
  }

  private renderHero(hero: PartyMember): HTMLElement {
    const classDef = CLASS_REGISTRY[hero.classId];
    const selectedItemId = selectedBagIndex !== null ? gameState.run?.inventory.items[selectedBagIndex] : null;
    const selectedItemDef = selectedItemId ? ITEM_REGISTRY[selectedItemId] : undefined;
    const stats = computePartyMemberStats(hero);

    const card = document.createElement("article");
    card.setAttribute("data-testid", `inventory-hero-${hero.instanceId}`);
    card.style.cssText = "border:1px solid #555;border-radius:8px;padding:12px;background:#1a1a3a;";

    const top = document.createElement("div");
    top.style.cssText = "display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;";

    const identity = document.createElement("div");
    const name = document.createElement("div");
    name.style.cssText = "font-weight:bold;font-size:16px;color:#e8e8ff;";
    name.textContent = hero.displayName;
    identity.appendChild(name);

    const meta = document.createElement("div");
    meta.style.cssText = "font-size:12px;color:#aaa;margin-top:2px;";
    meta.textContent = `${classDef?.displayName ?? hero.classId} | HP ${hero.hp}/${stats.maxHp} | Level ${hero.level}`;
    identity.appendChild(meta);
    top.appendChild(identity);

    if (selectedItemDef) {
      const equipBtn = document.createElement("button");
      equipBtn.setAttribute("data-testid", `inventory-equip-${hero.instanceId}`);
      equipBtn.textContent = `Equip ${SLOT_LABELS[selectedItemDef.slot]}`;
      equipBtn.addEventListener("click", () => this.onEquipSelected(hero, selectedItemDef.slot));
      top.appendChild(equipBtn);
    }

    card.appendChild(top);

    const slots = document.createElement("div");
    slots.style.cssText = "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px;";
    for (const slot of EQUIPMENT_SLOTS) {
      slots.appendChild(this.renderSlot(hero, slot, selectedItemDef?.slot === slot));
    }
    card.appendChild(slots);

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;";
    for (const key of STAT_KEYS) {
      const chip = document.createElement("span");
      chip.style.cssText = "font-size:11px;border:1px solid #444;border-radius:999px;padding:3px 7px;background:#202044;color:#ddd;";
      chip.textContent = `${STAT_LABELS[key]} ${stats[key]}`;
      statRow.appendChild(chip);
    }
    card.appendChild(statRow);

    if (selectedItemId) {
      card.appendChild(this.renderPreview(hero, selectedItemId));
    }

    return card;
  }

  private renderSlot(hero: PartyMember, slot: EquipmentSlot, highlighted: boolean): HTMLElement {
    const itemId = hero.equippedItemIds[slot];
    const itemDef = itemId ? ITEM_REGISTRY[itemId] : undefined;
    const slotEl = document.createElement("div");
    slotEl.style.cssText =
      `border:1px solid ${highlighted ? "#fa0" : "#444"};border-radius:6px;padding:8px;min-height:74px;background:${highlighted ? "#342b18" : "#202044"};`;

    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;color:#8cf;text-transform:uppercase;letter-spacing:0;";
    label.textContent = SLOT_LABELS[slot];
    slotEl.appendChild(label);

    const itemName = document.createElement("div");
    itemName.style.cssText = "font-weight:bold;font-size:13px;margin-top:4px;";
    itemName.textContent = itemDef?.displayName ?? "Empty";
    slotEl.appendChild(itemName);

    const detail = document.createElement("div");
    detail.style.cssText = "font-size:11px;color:#aaa;margin-top:3px;";
    detail.textContent = itemId ? describeItemShort(itemId) : "No item equipped";
    slotEl.appendChild(detail);

    return slotEl;
  }

  private renderPreview(hero: PartyMember, itemId: string): HTMLElement {
    const preview = previewEquipItem(hero, itemId);
    const box = document.createElement("div");
    box.style.cssText = "border-top:1px solid #444;margin-top:10px;padding-top:8px;font-size:12px;";

    if (!preview) {
      box.style.color = "#f99";
      box.textContent = "Unknown item cannot be equipped.";
      return box;
    }

    const replacedName = preview.replacedItemId
      ? ITEM_REGISTRY[preview.replacedItemId]?.displayName ?? preview.replacedItemId
      : "empty slot";
    const title = document.createElement("div");
    title.style.cssText = "color:#ddd;margin-bottom:6px;";
    title.textContent = `${SLOT_LABELS[preview.slot]} preview (${replacedName})`;
    box.appendChild(title);

    const row = document.createElement("div");
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
    for (const key of STAT_KEYS) {
      const diff = preview.diff[key];
      if (diff === 0) continue;
      const chip = document.createElement("span");
      chip.style.cssText = `border:1px solid ${diff > 0 ? "#4a8" : "#c66"};border-radius:999px;padding:3px 7px;color:${diff > 0 ? "#9f9" : "#f99"};background:#14142a;`;
      chip.textContent = `${STAT_LABELS[key]} ${preview.current[key]} -> ${preview.next[key]} (${diff > 0 ? "+" : ""}${diff})`;
      row.appendChild(chip);
    }
    if (row.childNodes.length === 0) {
      const neutral = document.createElement("span");
      neutral.style.cssText = "color:#aaa;";
      neutral.textContent = "No direct stat change";
      row.appendChild(neutral);
    }
    box.appendChild(row);
    return box;
  }

  private renderBag(): HTMLElement {
    const run = gameState.run!;
    const panel = document.createElement("aside");
    panel.style.cssText = "border:1px solid #555;border-radius:8px;padding:12px;background:#151532;";

    const heading = document.createElement("h3");
    heading.textContent = "Shared Bag";
    panel.appendChild(heading);

    const itemHeading = document.createElement("div");
    itemHeading.style.cssText = "font-size:12px;color:#8cf;margin:12px 0 6px;";
    itemHeading.textContent = "Equipment";
    panel.appendChild(itemHeading);

    if (run.inventory.items.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:12px;color:#888;border:1px dashed #444;border-radius:6px;padding:10px;";
      empty.textContent = "No equipment in bag";
      panel.appendChild(empty);
    } else {
      for (let i = 0; i < run.inventory.items.length; i++) {
        panel.appendChild(this.renderBagItem(run.inventory.items[i], i));
      }
    }

    const potionHeading = document.createElement("div");
    potionHeading.style.cssText = "font-size:12px;color:#8f8;margin:14px 0 6px;";
    potionHeading.textContent = "Potions";
    panel.appendChild(potionHeading);

    if (run.inventory.potions.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:12px;color:#888;border:1px dashed #444;border-radius:6px;padding:10px;";
      empty.textContent = "No potions in bag";
      panel.appendChild(empty);
    } else {
      for (const potionId of run.inventory.potions) {
        const potion = POTION_REGISTRY[potionId];
        const card = document.createElement("div");
        card.style.cssText = "border:1px solid #355;border-radius:6px;padding:8px;margin-bottom:8px;background:#1c2f2a;";
        const name = document.createElement("div");
        name.style.cssText = "font-weight:bold;font-size:13px;";
        name.textContent = potion?.displayName ?? potionId;
        card.appendChild(name);
        const desc = document.createElement("div");
        desc.style.cssText = "font-size:11px;color:#aaa;margin-top:3px;";
        desc.textContent = potion?.description ?? "";
        card.appendChild(desc);
        panel.appendChild(card);
      }
    }

    return panel;
  }

  private renderBagItem(itemId: string, index: number): HTMLElement {
    const itemDef = ITEM_REGISTRY[itemId];
    const selected = selectedBagIndex === index;
    const card = document.createElement("button");
    card.setAttribute("data-testid", `inventory-bag-item-${index}`);
    card.style.cssText =
      `display:block;width:100%;text-align:left;border:1px solid ${selected ? "#fa0" : "#555"};border-radius:6px;padding:8px;margin-bottom:8px;background:${selected ? "#3a311d" : "#2a2a4a"};`;
    card.disabled = !itemDef;
    card.title = itemDef ? "" : "Unknown item cannot be equipped.";
    card.addEventListener("click", () => {
      selectedBagIndex = selected ? null : index;
      inventoryMessage = selected ? "" : `Selected ${itemDef?.displayName ?? itemId}.`;
      this.app.render();
    });

    const name = document.createElement("div");
    name.style.cssText = "font-weight:bold;font-size:13px;";
    name.textContent = itemDef?.displayName ?? itemId;
    card.appendChild(name);

    const desc = document.createElement("div");
    desc.style.cssText = "font-size:11px;color:#aaa;margin-top:3px;";
    desc.textContent = itemDef ? describeItemShort(itemId) : "Unknown item";
    card.appendChild(desc);

    return card;
  }

  private onEquipSelected(hero: PartyMember, targetSlot: EquipmentSlot): void {
    const run = gameState.run;
    if (!run || selectedBagIndex === null) return;

    const result = equipBagItemToPartyMember(hero, run.inventory, selectedBagIndex, targetSlot);
    if (!result.ok) {
      inventoryMessage = result.reason ?? "Could not equip item.";
      this.app.render();
      return;
    }

    const itemName = result.itemId ? ITEM_REGISTRY[result.itemId]?.displayName ?? result.itemId : "Item";
    if (result.replacedItemId) {
      const replacedName = ITEM_REGISTRY[result.replacedItemId]?.displayName ?? result.replacedItemId;
      inventoryMessage = `Equipped ${itemName} to ${hero.displayName}. ${replacedName} returned to the bag.`;
    } else {
      inventoryMessage = `Equipped ${itemName} to ${hero.displayName}.`;
    }
    selectedBagIndex = null;
    this.app.render();
  }
}
