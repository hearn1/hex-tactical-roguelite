export interface InventoryState {
  items: string[];
  potions: string[];
  gold: number;
}

export function createInventory(): InventoryState {
  return { items: [], potions: [], gold: 0 };
}
