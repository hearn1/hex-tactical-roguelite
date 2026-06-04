import type { MetaProgressionState } from "./MetaProgression.ts";
import { UPGRADE_REGISTRY } from "../data/upgrades.ts";
import type { UpgradeDef } from "../data/upgrades.ts";
import type { RunState, PartyMember } from "../state/RunState.ts";
import { applyXpToPartyMember } from "../run/Leveling.ts";
import { ITEM_REGISTRY } from "../data/items.ts";

export function canPurchase(
  upgradeId: string,
  meta: MetaProgressionState,
): { ok: true } | { ok: false; reason: string } {
  const def = UPGRADE_REGISTRY[upgradeId];
  if (!def) return { ok: false, reason: "Unknown upgrade" };

  const currentRank = meta.upgradeRanks[upgradeId] ?? 0;
  if (currentRank >= def.maxRank) return { ok: false, reason: "Max rank reached" };

  const cost = def.costRenownPerRank[currentRank];
  if (meta.renown < cost) return { ok: false, reason: "Not enough Renown" };

  return { ok: true };
}

export function purchase(upgradeId: string, meta: MetaProgressionState): void {
  const def = UPGRADE_REGISTRY[upgradeId];
  if (!def) return;

  const currentRank = meta.upgradeRanks[upgradeId] ?? 0;
  if (currentRank >= def.maxRank) return;

  const cost = def.costRenownPerRank[currentRank];
  if (meta.renown < cost) return;

  meta.renown -= cost;
  meta.upgradeRanks[upgradeId] = currentRank + 1;
}

/**
 * A class-targeted upgrade (statBonus / startingItem) whose target class appears more
 * than once in the chosen party, so the player must pick which hero receives it.
 */
export interface AmbiguousClassUpgrade {
  upgradeId: string;
  def: UpgradeDef;
  candidates: PartyMember[];
}

/**
 * Returns the class-targeted upgrades that are ambiguous for the given party — i.e. the
 * target class has more than one hero (possible now that duplicate classes are allowed).
 * The run-setup flow uses this to present a target picker instead of silently applying
 * the effect to the first matching hero.
 */
export function getAmbiguousClassUpgrades(
  party: PartyMember[],
  meta: MetaProgressionState,
): AmbiguousClassUpgrade[] {
  const result: AmbiguousClassUpgrade[] = [];
  for (const [upgradeId, rank] of Object.entries(meta.upgradeRanks)) {
    if (rank <= 0) continue;
    const def = UPGRADE_REGISTRY[upgradeId];
    if (!def) continue;
    const isClassTargeted =
      (def.effect.type === "statBonus" || def.effect.type === "startingItem") && def.effect.classId;
    if (!isClassTargeted) continue;
    const candidates = party.filter((pm) => pm.classId === def.effect.classId);
    if (candidates.length > 1) {
      result.push({ upgradeId, def, candidates });
    }
  }
  return result;
}

function resolveClassTarget(
  party: PartyMember[],
  classId: string,
  assignedInstanceId: string | undefined,
): PartyMember | undefined {
  if (assignedInstanceId) {
    const assigned = party.find(
      (pm) => pm.instanceId === assignedInstanceId && pm.classId === classId,
    );
    if (assigned) return assigned;
  }
  return party.find((pm) => pm.classId === classId);
}

/**
 * Applies purchased meta upgrades to a fresh run.
 *
 * @param targetAssignments Optional map of upgradeId → hero instanceId for class-targeted
 *   effects. When omitted (or no entry for an upgrade), the effect falls back to the first
 *   hero of the target class — preserving the original single-hero behavior. The setup flow
 *   supplies assignments resolved from {@link getAmbiguousClassUpgrades}.
 */
export function applyMetaUpgradesToFreshRun(
  run: RunState,
  meta: MetaProgressionState,
  targetAssignments: Record<string, string> = {},
): void {
  for (const [upgradeId, rank] of Object.entries(meta.upgradeRanks)) {
    if (rank <= 0) continue;
    const def = UPGRADE_REGISTRY[upgradeId];
    if (!def) continue;

    switch (def.effect.type) {
      case "startingGoldBonus": {
        const amount = (def.effect.amountPerRank ?? 5) * rank;
        run.gold += amount;
        break;
      }
      case "startingXpBonus": {
        const xpAmount = (def.effect.amountPerRank ?? 10) * rank;
        for (const pm of run.party) {
          applyXpToPartyMember(pm, xpAmount);
        }
        break;
      }
      case "startingPotion": {
        const count = (def.effect.amountPerRank ?? 1) * rank;
        for (let i = 0; i < count; i++) {
          run.inventory.potions.push("potion.healing");
        }
        break;
      }
      case "statBonus": {
        if (def.effect.stat && def.effect.classId) {
          const member = resolveClassTarget(run.party, def.effect.classId, targetAssignments[upgradeId]);
          if (member) {
            const statKey = def.effect.stat as keyof typeof member.bonusStats;
            const existing = member.bonusStats[statKey] ?? 0;
            member.bonusStats[statKey] = existing + (def.effect.amountPerRank ?? 1) * rank;
          }
        }
        break;
      }
      case "startingItem": {
        if (def.effect.classId && def.effect.itemId) {
          const member = resolveClassTarget(run.party, def.effect.classId, targetAssignments[upgradeId]);
          if (member) {
            const itemDef = ITEM_REGISTRY[def.effect.itemId];
            if (!itemDef) break;
            const slot = itemDef.slot;
            if (!member.equippedItemIds[slot]) {
              member.equippedItemIds[slot] = def.effect.itemId;
            }
          }
        }
        break;
      }
    }
  }
}
