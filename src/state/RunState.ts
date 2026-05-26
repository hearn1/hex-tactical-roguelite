import type { MapState } from "../run/MapGraph.ts";
import type { UnitStats, ShopInventory, RunModifier } from "./types.ts";
import type { InventoryState } from "../run/Inventory.ts";

export interface PartyMember {
  instanceId: string;
  classId: string;
  displayName: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  bonusStats: Partial<UnitStats>;
  equippedItemIds: {
    weapon: string | null;
    armor: string | null;
    trinket: string | null;
  };
}

export type Difficulty = "normal" | "hard";

export interface RunState {
  seed: number;
  gold: number;
  party: PartyMember[];
  inventory: InventoryState;
  mapState: MapState;
  runStatus: "active" | "won" | "lost";
  shopStates: Record<string, ShopInventory>;
  recruitOffers: Record<string, PartyMember[]>;
  runModifiers: RunModifier[];
  difficulty: Difficulty;
  eventSelections: Record<string, string>;
}
