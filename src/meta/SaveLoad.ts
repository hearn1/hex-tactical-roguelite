import type { MetaProgressionState } from "./MetaProgression.ts";
import { createDefaultMetaProgression } from "./MetaProgression.ts";

export const SAVE_KEY = "dnroguelite.meta.v1";

export interface SaveV1 {
  schemaVersion: 1;
  renown: number;
  upgradeRanks: Record<string, number>;
  completedRuns: number;
  bossWins: number;
}

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function isSaveV1(data: unknown): data is SaveV1 {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.schemaVersion === 1
    && typeof d.renown === "number"
    && typeof d.upgradeRanks === "object" && d.upgradeRanks !== null
    && typeof d.completedRuns === "number"
    && typeof d.bossWins === "number";
}

export function saveMetaProgression(meta: MetaProgressionState, storage: Storage = window.localStorage): void {
  const save: SaveV1 = {
    schemaVersion: 1,
    renown: meta.renown,
    upgradeRanks: { ...meta.upgradeRanks },
    completedRuns: meta.completedRuns,
    bossWins: meta.bossWins,
  };
  storage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function loadMetaProgression(storage: Storage = window.localStorage): MetaProgressionState {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) {
    return createDefaultMetaProgression();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[SaveLoad] Failed to parse save data at "${SAVE_KEY}". Returning defaults.`);
    return createDefaultMetaProgression();
  }

  if (!isSaveV1(parsed)) {
    console.warn(`[SaveLoad] Save data at "${SAVE_KEY}" has unexpected schema. Returning defaults.`);
    return createDefaultMetaProgression();
  }

  return {
    renown: parsed.renown,
    upgradeRanks: { ...parsed.upgradeRanks },
    completedRuns: parsed.completedRuns,
    bossWins: parsed.bossWins,
  };
}

export function resetMeta(storage: Storage = window.localStorage): void {
  storage.removeItem(SAVE_KEY);
}
