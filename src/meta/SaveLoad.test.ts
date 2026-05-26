import { describe, it, expect, vi } from "vitest";
import { saveMetaProgression, loadMetaProgression, resetMeta, SAVE_KEY } from "./SaveLoad.ts";
import type { Storage } from "./SaveLoad.ts";
import type { MetaProgressionState } from "./MetaProgression.ts";

function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem(k: string): string | null {
      return store[k] ?? null;
    },
    setItem(k: string, v: string): void {
      store[k] = v;
    },
    removeItem(k: string): void {
      delete store[k];
    },
  };
}

describe("save/load round-trip", () => {
  it("save then load preserves all fields", () => {
    const storage = createMockStorage();
    const meta: MetaProgressionState = {
      renown: 42,
      upgradeRanks: { "upgrade.starting_gold": 3, "upgrade.potion_belt": 1 },
      completedRuns: 5,
      bossWins: 2,
    };
    saveMetaProgression(meta, storage);
    const loaded = loadMetaProgression(storage);
    expect(loaded.renown).toBe(42);
    expect(loaded.upgradeRanks).toEqual({ "upgrade.starting_gold": 3, "upgrade.potion_belt": 1 });
    expect(loaded.completedRuns).toBe(5);
    expect(loaded.bossWins).toBe(2);
  });
});

describe("load edge cases", () => {
  it("missing key returns defaults", () => {
    const storage = createMockStorage();
    const loaded = loadMetaProgression(storage);
    expect(loaded.renown).toBe(0);
    expect(loaded.upgradeRanks).toEqual({});
    expect(loaded.completedRuns).toBe(0);
    expect(loaded.bossWins).toBe(0);
  });

  it("version mismatch resets to defaults", () => {
    const storage = createMockStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      schemaVersion: 2,
      renown: 100,
      upgradeRanks: {},
      completedRuns: 1,
      bossWins: 0,
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const loaded = loadMetaProgression(storage);
    expect(loaded.renown).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("corrupted JSON returns defaults without throwing", () => {
    const storage = createMockStorage();
    storage.setItem(SAVE_KEY, "not-json-at-all");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const loaded = loadMetaProgression(storage);
    expect(loaded.renown).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("resetMeta", () => {
  it("clears saved data", () => {
    const storage = createMockStorage();
    const meta: MetaProgressionState = {
      renown: 50,
      upgradeRanks: {},
      completedRuns: 1,
      bossWins: 0,
    };
    saveMetaProgression(meta, storage);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    resetMeta(storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});

describe("mock storage", () => {
  it("works without localStorage", () => {
    const storage = createMockStorage();
    const meta: MetaProgressionState = {
      renown: 10, upgradeRanks: {}, completedRuns: 0, bossWins: 0,
    };
    saveMetaProgression(meta, storage);
    const loaded = loadMetaProgression(storage);
    expect(loaded.renown).toBe(10);
  });
});
