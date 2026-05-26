import { describe, it, expect } from "vitest";

interface Roll {
  id: string;
  value: number;
  team: "hero" | "enemy";
}

function sortQueue(rolls: Roll[]): string[] {
  const sorted = [...rolls].sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    if (a.team !== b.team) return a.team === "hero" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return sorted.map((r) => r.id);
}

describe("TurnQueue", () => {
  it("sorts by initiative descending, heroes before enemies on tie", () => {
    const rolls: Roll[] = [
      { id: "hero_001", value: 15, team: "hero" },
      { id: "enemy_g1", value: 18, team: "enemy" },
      { id: "hero_002", value: 12, team: "hero" },
      { id: "enemy_w1", value: 15, team: "enemy" },
    ];
    const queue = sortQueue(rolls);
    expect(queue[0]).toBe("enemy_g1");
    expect(queue[1]).toBe("hero_001");
    expect(queue[2]).toBe("enemy_w1");
    expect(queue[3]).toBe("hero_002");
  });
});
