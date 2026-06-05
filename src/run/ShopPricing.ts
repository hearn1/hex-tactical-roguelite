import type { RunModifier } from "../state/types.ts";

export function applyShopDiscount(price: number, modifiers: RunModifier[]): number {
  let multiplier = 1;
  for (const mod of modifiers) {
    if (mod.kind === "shop_discount") {
      multiplier *= 1 - Math.max(0, Math.min(1, mod.value));
    }
  }
  return Math.max(0, Math.floor(price * multiplier));
}
