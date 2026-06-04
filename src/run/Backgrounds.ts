import type { RunState, PartyMember } from "../state/RunState.ts";
import { BACKGROUND_REGISTRY } from "../data/backgrounds.ts";

/**
 * Applies a single hero's chosen background to a fresh run. Deterministic (no RNG) and
 * idempotent per call — invoke exactly once at run start, alongside meta upgrades.
 *
 * - `statBonus` → adds to the hero's `bonusStats` (flows into combat AND F23 checks).
 * - `gold` → adds to the shared `run.gold`.
 * - `potion` → pushes starter potion(s) into the run inventory.
 * - `eventModifier` → declared seam for F24/F25 events; no run-start effect today.
 */
export function applyBackground(pm: PartyMember, run: RunState): void {
  if (!pm.backgroundId) return;
  const def = BACKGROUND_REGISTRY[pm.backgroundId];
  if (!def) return;

  const effect = def.effect;
  switch (effect.type) {
    case "statBonus": {
      const key = effect.stat as keyof typeof pm.bonusStats;
      pm.bonusStats[key] = (pm.bonusStats[key] ?? 0) + effect.amount;
      break;
    }
    case "gold": {
      run.gold += effect.amount;
      break;
    }
    case "potion": {
      for (let i = 0; i < effect.count; i++) {
        run.inventory.potions.push(effect.potionId);
      }
      break;
    }
    case "eventModifier": {
      // Consumption owned by F24/F25 events; nothing to apply at run start.
      break;
    }
  }
}

/** Applies every party member's background once. Call at run start. */
export function applyBackgrounds(run: RunState): void {
  for (const pm of run.party) {
    applyBackground(pm, run);
  }
}
