import type { Hex } from "../state/types.ts";

export type EnemyTraitDef =
  | {
      id: "boss_action_rotation";
      actionIds: string[];
    }
  | {
      id: "boss_ground_slam_telegraph";
      actionId: string;
      thresholdHpPct: number;
      targetPattern: "adjacent";
      cadence?: {
        mode: "once_per_threshold" | "cooldown" | "rotation_integrated";
        cooldownTurns?: number; // required only when mode === "cooldown"
      };
      warningText?: string;
    }
  | {
      id: "boss_reinforcement_at_hp_threshold";
      thresholdHpPct: number;
      enemyId: string;
      count: number;
      spawnCandidates: Hex[];
      logText?: string;
    };

export type EncounterTraitDef =
  | {
      id: "elite_rally_on_first_death";
      conditionId: "rallied";
      duration: number;
      attackBonus?: number;
      logText?: string;
    };
