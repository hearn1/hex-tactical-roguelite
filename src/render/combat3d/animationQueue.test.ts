import { describe, expect, it } from "vitest";
import { CombatAnimationQueue, easeInOut } from "./animationQueue.ts";

describe("CombatAnimationQueue", () => {
  it("starts and finishes queued steps in order", () => {
    const queue = new CombatAnimationQueue();
    const move = { kind: "move" as const, unitId: "hero", from: { q: 0, r: 0 }, to: { q: 1, r: 0 }, durationMs: 100 };
    const hit = { kind: "hit" as const, unitIds: ["enemy"], durationMs: 50 };
    queue.enqueue([move, hit]);

    const first = queue.update(40);
    expect(first.started).toEqual([move]);
    expect(first.finished).toEqual([]);
    expect(queue.getProgress()).toBeCloseTo(0.4);
    expect(queue.isAnimating()).toBe(true);

    const second = queue.update(60);
    expect(second.finished).toEqual([move]);
    expect(second.started).toEqual([hit]);
    expect(queue.getActiveStep()).toEqual(hit);

    const third = queue.update(50);
    expect(third.finished).toEqual([hit]);
    expect(queue.isAnimating()).toBe(false);
  });

  it("reports input gating for units with active or pending animation steps", () => {
    const queue = new CombatAnimationQueue();
    queue.enqueue([
      { kind: "attack", attackerId: "hero", targetIds: ["enemy"], durationMs: 100 },
      { kind: "death", unitIds: ["enemy"], durationMs: 100 },
    ]);

    expect(queue.hasQueuedUnit("hero")).toBe(true);
    expect(queue.hasQueuedUnit("enemy")).toBe(true);
    expect(queue.hasQueuedUnit("bystander")).toBe(false);

    queue.update(100);
    expect(queue.hasQueuedUnit("hero")).toBe(false);
    expect(queue.hasQueuedUnit("enemy")).toBe(true);
  });

  it("flushes current and pending steps for skip animation controls", () => {
    const queue = new CombatAnimationQueue();
    const attack = { kind: "attack" as const, attackerId: "hero", targetIds: ["enemy"], durationMs: 100 };
    const miss = { kind: "miss" as const, unitIds: ["enemy"], durationMs: 100 };
    queue.enqueue([attack, miss]);
    queue.update(20);

    expect(queue.flush()).toEqual([attack, miss]);
    expect(queue.isAnimating()).toBe(false);
    expect(queue.getProgress()).toBe(1);
  });
});

describe("combat3d easing", () => {
  it("is monotonic and preserves endpoints", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.25)).toBeLessThan(easeInOut(0.5));
    expect(easeInOut(0.5)).toBeLessThan(easeInOut(0.75));
  });
});
