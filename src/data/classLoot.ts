export interface ClassLootEntry {
  itemId: string;
  weight: number;
  reason?: string;
}

export const CLASS_LOOT_HOOK_REGISTRY: Record<string, ClassLootEntry[]> = {};
