import { describe, it, expect } from "vitest";
import {
  ensureAdventureLog,
  appendAdventureLog,
  appendAdventureLogOnce,
  buildRunEpilogue,
} from "./AdventureLog.ts";
import { createRunState, buildParty, defaultPartySpecs } from "./PartySetup.ts";
import { createDefaultAbilityScores } from "../data/abilities.ts";

function makeRun() {
  const specs = defaultPartySpecs().map((s) => ({ ...s, abilityScores: createDefaultAbilityScores() }));
  const party = buildParty(specs);
  return createRunState(party);
}

describe("ensureAdventureLog", () => {
  it("returns existing log when present", () => {
    const run = makeRun();
    run.adventureLog = [];
    const log = ensureAdventureLog(run);
    expect(log).toBe(run.adventureLog);
  });

  it("creates a missing log array", () => {
    const run = makeRun();
    run.adventureLog = undefined;
    const log = ensureAdventureLog(run);
    expect(Array.isArray(log)).toBe(true);
    expect(run.adventureLog).toBe(log);
  });
});

describe("appendAdventureLog", () => {
  it("assigns increasing index", () => {
    const run = makeRun();
    const e1 = appendAdventureLog(run, { kind: "run_start", text: "First" });
    const e2 = appendAdventureLog(run, { kind: "node_visit", text: "Second" });
    expect(e1.index).toBe(0);
    expect(e2.index).toBe(1);
  });

  it("assigns deterministic id including kind and sourceKey", () => {
    const run = makeRun();
    const e = appendAdventureLog(run, { kind: "run_start", text: "Start", sourceKey: "run_start" });
    expect(e.id).toBe("0:run_start:run_start");
  });

  it("assigns fallback id when sourceKey is absent", () => {
    const run = makeRun();
    const e = appendAdventureLog(run, { kind: "hero_downed", text: "Downed" });
    expect(e.id).toBe("0:hero_downed:entry");
  });

  it("preserves append order", () => {
    const run = makeRun();
    appendAdventureLog(run, { kind: "run_start", text: "A" });
    appendAdventureLog(run, { kind: "node_visit", text: "B" });
    appendAdventureLog(run, { kind: "combat_victory", text: "C" });
    expect(run.adventureLog!.map((e) => e.text)).toEqual(["A", "B", "C"]);
  });
});

describe("appendAdventureLogOnce", () => {
  it("appends a new entry when sourceKey is unseen", () => {
    const run = makeRun();
    const e = appendAdventureLogOnce(run, "run_start", { kind: "run_start", text: "Start" });
    expect(e).not.toBeNull();
    expect(run.adventureLog!.length).toBe(1);
  });

  it("prevents duplicate sourceKey", () => {
    const run = makeRun();
    appendAdventureLogOnce(run, "run_start", { kind: "run_start", text: "Start" });
    const second = appendAdventureLogOnce(run, "run_start", { kind: "run_start", text: "Start again" });
    expect(second).toBeNull();
    expect(run.adventureLog!.length).toBe(1);
  });

  it("allows entries with different sourceKeys", () => {
    const run = makeRun();
    appendAdventureLogOnce(run, "node_visit:node.a1", { kind: "node_visit", text: "A1" });
    appendAdventureLogOnce(run, "node_visit:node.a2", { kind: "node_visit", text: "A2" });
    expect(run.adventureLog!.length).toBe(2);
  });
});

describe("createRunState initializes adventureLog", () => {
  it("new run has an empty adventureLog array", () => {
    const run = makeRun();
    expect(Array.isArray(run.adventureLog)).toBe(true);
    expect(run.adventureLog!.length).toBe(0);
  });
});

describe("buildRunEpilogue", () => {
  it("returns empty lines when log is empty and no run events", () => {
    const run = makeRun();
    const lines = buildRunEpilogue(run);
    expect(lines.some((l) => l.includes("Nodes cleared"))).toBe(true);
  });

  it("includes run_start text when present", () => {
    const run = makeRun();
    appendAdventureLogOnce(run, "run_start", { kind: "run_start", text: "Run begins on normal." });
    const lines = buildRunEpilogue(run);
    expect(lines[0]).toBe("Run begins on normal.");
  });

  it("includes run_end text when present", () => {
    const run = makeRun();
    appendAdventureLogOnce(run, "run_end:lost", { kind: "run_end", text: "Run ended in defeat.", runStatus: "lost" });
    const lines = buildRunEpilogue(run);
    expect(lines.some((l) => l === "Run ended in defeat.")).toBe(true);
  });

  it("includes up to 3 loot entries", () => {
    const run = makeRun();
    for (let i = 0; i < 5; i++) {
      appendAdventureLog(run, { kind: "loot_gained", text: `Item ${i}` });
    }
    const lines = buildRunEpilogue(run);
    const lootLines = lines.filter((l) => l.startsWith("Item "));
    expect(lootLines.length).toBe(3);
  });

  it("renders safely for existing runs without logs (ensureAdventureLog creates one)", () => {
    const run = makeRun();
    run.adventureLog = undefined;
    expect(() => buildRunEpilogue(run)).not.toThrow();
  });
});
