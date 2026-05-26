export type ScreenId =
  | "main_menu"
  | "meta_upgrades"
  | "map"
  | "combat"
  | "reward"
  | "shop"
  | "camp"
  | "event"
  | "recruit"
  | "pet"
  | "run_summary";

export type Team = "hero" | "enemy";

export type ConditionId = "guarded" | "weakened" | "blessed" | "slowed";

export interface UnitStats {
  maxHp: number;
  armor: number;
  move: number;
  might: number;
  agility: number;
  spirit: number;
}

export interface Condition {
  id: ConditionId;
  remainingTurns: number;
}

export interface Hex {
  q: number;
  r: number;
}

export interface UnitInstance {
  instanceId: string;
  defId: string;
  displayName: string;
  team: Team;
  level: number;
  xp: number;
  stats: UnitStats;
  hp: number;
  pos: Hex;
  conditions: Condition[];
  movePointsRemaining: number;
  hasActed: boolean;
  equippedItemIds: { weapon: string | null; armor: string | null; trinket: string | null };
  bonusStats: Partial<UnitStats>;
}

export interface CombatLogEntry {
  kind: "initiative" | "turn_start" | "move" | "action" | "defeat" | "victory" | "defeat_squad";
  text: string;
  round: number;
}

export interface ShopInventory {
  items: { itemId: string; sold: boolean }[];
  potions: { potionId: string; sold: boolean }[];
  healServiceUsed: boolean;
}

export type RunModifier =
  | { kind: "gold_multiplier"; value: number }
  | { kind: "global_stat"; stat: keyof UnitStats; value: number }
  | { kind: "first_hit_bonus_damage"; amount: number };

export interface CombatState {
  round: number;
  activeIndex: number;
  turnQueue: string[];
  units: UnitInstance[];
  log: CombatLogEntry[];
  status: "active" | "victory" | "defeat";
  gridKeys: string[];
  targetingActionId: string | null;
  bossActionIndex?: number;
  bossReinforcementSpawned?: boolean;
  encounterId?: string;
  difficulty?: "normal" | "hard";
}
