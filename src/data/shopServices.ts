import type { RunState, PartyMember } from "../state/RunState.ts";
import type { ShopInventory, RunModifier } from "../state/types.ts";
import { NODE_REGISTRY } from "./nodes.ts";

export interface ShopServiceDef {
  id: string;
  displayName: string;
  description: string;
  price: number;
  oncePerShop: boolean;
  apply: (run: RunState, shop: ShopInventory) => string;
  isAvailable: (run: RunState, shop: ShopInventory) => { available: boolean; reason: string };
}

export const HEAL_SERVICE_ID = "service.heal_party";
export const REMOVE_DRAWBACK_SERVICE_ID = "service.remove_drawback";
export const BUY_RUMOR_SERVICE_ID = "service.buy_rumor";

export const HEAL_PRICE = 15;
export const REMOVE_DRAWBACK_PRICE = 10;
export const RUMOR_PRICE = 8;

export const HEAL_AMOUNT = 8;

function healPartyApply(run: RunState, _shop: ShopInventory): string {
  for (const pm of run.party) {
    if (pm.hp > 0) {
      pm.hp = Math.min(pm.maxHp, pm.hp + HEAL_AMOUNT);
    }
  }
  return "Party healed for 8 HP each!";
}

function healPartyAvailable(run: RunState, shop: ShopInventory): { available: boolean; reason: string } {
  if (shop.servicesUsed[HEAL_SERVICE_ID]) return { available: false, reason: "Already used" };
  if (run.gold < HEAL_PRICE) return { available: false, reason: `Requires ${HEAL_PRICE} gold` };
  return { available: true, reason: "" };
}

function findDrawback(runModifiers: RunModifier[]): RunModifier | undefined {
  return runModifiers.find((m) => {
    if (m.kind === "gold_multiplier" && m.value < 1) return true;
    return false;
  });
}

function removeDrawbackApply(run: RunState, _shop: ShopInventory): string {
  const idx = run.runModifiers.findIndex((m) => {
    if (m.kind === "gold_multiplier" && m.value < 1) return true;
    return false;
  });
  if (idx === -1) return "No drawbacks to remove.";
  const removed = run.runModifiers.splice(idx, 1)[0];
  return `Removed drawback: ${describeRunModifier(removed)}.`;
}

function removeDrawbackAvailable(run: RunState, shop: ShopInventory): { available: boolean; reason: string } {
  if (shop.servicesUsed[REMOVE_DRAWBACK_SERVICE_ID]) return { available: false, reason: "Already used" };
  if (run.gold < REMOVE_DRAWBACK_PRICE) return { available: false, reason: `Requires ${REMOVE_DRAWBACK_PRICE} gold` };
  if (!findDrawback(run.runModifiers)) return { available: false, reason: "No drawbacks to remove" };
  return { available: true, reason: "" };
}

function describeRunModifier(mod: RunModifier): string {
  if (mod.kind === "gold_multiplier") {
    return `Gold multiplier ${mod.value}x`;
  }
  return `Unknown modifier (${mod.kind})`;
}

function buyRumorApply(run: RunState, _shop: ShopInventory): string {
  const nodeId = run.mapState.currentNodeId;
  const nodeDef = NODE_REGISTRY[nodeId];
  if (!nodeDef || nodeDef.nextNodeIds.length === 0) return "No upcoming nodes to reveal.";

  if (!run.revealedForecasts) run.revealedForecasts = {};

  const unvisited = nodeDef.nextNodeIds.filter((id) => !run.mapState.visitedNodeIds.includes(id));
  if (unvisited.length === 0) return "No upcoming nodes to reveal.";

  const targetId = unvisited[0];
  run.revealedForecasts[targetId] = true;
  const target = NODE_REGISTRY[targetId];
  if (target) {
    return `Rumor reveals: "${target.title}" (${target.type}).`;
  }
  return `Rumor reveals a path ahead.`;
}

function buyRumorAvailable(run: RunState, shop: ShopInventory): { available: boolean; reason: string } {
  if (shop.servicesUsed[BUY_RUMOR_SERVICE_ID]) return { available: false, reason: "Already used" };
  if (run.gold < RUMOR_PRICE) return { available: false, reason: `Requires ${RUMOR_PRICE} gold` };
  const nodeDef = NODE_REGISTRY[run.mapState.currentNodeId];
  if (!nodeDef || nodeDef.nextNodeIds.length === 0) return { available: false, reason: "No upcoming nodes to reveal" };
  const unvisited = nodeDef.nextNodeIds.filter((id) => !run.mapState.visitedNodeIds.includes(id));
  if (unvisited.length === 0) return { available: false, reason: "No upcoming nodes to reveal" };
  return { available: true, reason: "" };
}

export const SHOP_SERVICE_REGISTRY: ShopServiceDef[] = [
  {
    id: HEAL_SERVICE_ID,
    displayName: "Heal Party",
    description: `Restore ${HEAL_AMOUNT} HP to each living hero.`,
    price: HEAL_PRICE,
    oncePerShop: true,
    apply: healPartyApply,
    isAvailable: healPartyAvailable,
  },
  {
    id: REMOVE_DRAWBACK_SERVICE_ID,
    displayName: "Remove Drawback",
    description: "Remove one temporary negative run modifier.",
    price: REMOVE_DRAWBACK_PRICE,
    oncePerShop: true,
    apply: removeDrawbackApply,
    isAvailable: removeDrawbackAvailable,
  },
  {
    id: BUY_RUMOR_SERVICE_ID,
    displayName: "Buy Rumor",
    description: "Reveal the type and title of one upcoming connected node.",
    price: RUMOR_PRICE,
    oncePerShop: true,
    apply: buyRumorApply,
    isAvailable: buyRumorAvailable,
  },
];
