import type { Hex } from "../../state/types.ts";
import type { SpriteFrameId } from "../../data/sprites.ts";

export type CombatAnimationStep =
  | {
    kind: "move";
    unitId: string;
    from: Hex;
    to: Hex;
    durationMs?: number;
  }
  | {
    kind: "attack";
    attackerId: string;
    targetIds: string[];
    frame?: SpriteFrameId;
    durationMs?: number;
  }
  | {
    kind: "hit" | "miss" | "heal" | "death";
    unitIds: string[];
    durationMs?: number;
  }
  | {
    kind: "aoeFlash";
    hexKeys: string[];
    durationMs?: number;
  }
  | {
    kind: "wait";
    durationMs: number;
  };

export interface QueueUpdateResult {
  started: CombatAnimationStep[];
  finished: CombatAnimationStep[];
}

const DEFAULT_DURATION_MS: Record<CombatAnimationStep["kind"], number> = {
  move: 300,
  attack: 240,
  hit: 180,
  miss: 180,
  heal: 260,
  death: 420,
  aoeFlash: 240,
  wait: 0,
};

export class CombatAnimationQueue {
  private pending: CombatAnimationStep[] = [];
  private current: CombatAnimationStep | null = null;
  private elapsedMs = 0;
  private speedMultiplier = 1;

  enqueue(steps: CombatAnimationStep | CombatAnimationStep[]): void {
    const next = Array.isArray(steps) ? steps : [steps];
    this.pending.push(...next);
  }

  update(deltaMs: number): QueueUpdateResult {
    const started: CombatAnimationStep[] = [];
    const finished: CombatAnimationStep[] = [];
    if (this.speedMultiplier <= 0) return { started, finished };

    this.startNext(started);
    if (!this.current) return { started, finished };

    this.elapsedMs += Math.max(0, deltaMs) * this.speedMultiplier;

    while (this.current && this.elapsedMs >= this.durationOf(this.current)) {
      const duration = this.durationOf(this.current);
      this.elapsedMs = duration > 0 ? this.elapsedMs - duration : 0;
      finished.push(this.current);
      this.current = null;
      this.startNext(started);
      if (!this.current) {
        this.elapsedMs = 0;
      }
    }

    return { started, finished };
  }

  flush(): CombatAnimationStep[] {
    const flushed = this.current ? [this.current, ...this.pending] : [...this.pending];
    this.pending = [];
    this.current = null;
    this.elapsedMs = 0;
    return flushed;
  }

  isAnimating(): boolean {
    return this.current !== null || this.pending.length > 0;
  }

  hasQueuedUnit(unitId: string): boolean {
    return (this.current ? [this.current, ...this.pending] : this.pending).some((step) => stepIncludesUnit(step, unitId));
  }

  getActiveStep(): CombatAnimationStep | null {
    return this.current;
  }

  getProgress(): number {
    if (!this.current) return 1;
    const duration = this.durationOf(this.current);
    if (duration <= 0) return 1;
    return Math.max(0, Math.min(1, this.elapsedMs / duration));
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0.25, Math.min(4, multiplier));
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  private startNext(started: CombatAnimationStep[]): void {
    if (this.current || this.pending.length === 0) return;
    this.current = this.pending.shift() ?? null;
    this.elapsedMs = 0;
    if (this.current) started.push(this.current);
  }

  private durationOf(step: CombatAnimationStep): number {
    return step.durationMs ?? DEFAULT_DURATION_MS[step.kind];
  }
}

export function easeInOut(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function stepIncludesUnit(step: CombatAnimationStep, unitId: string): boolean {
  switch (step.kind) {
    case "move":
      return step.unitId === unitId;
    case "attack":
      return step.attackerId === unitId || step.targetIds.includes(unitId);
    case "hit":
    case "miss":
    case "heal":
    case "death":
      return step.unitIds.includes(unitId);
    case "aoeFlash":
    case "wait":
      return false;
  }
}
