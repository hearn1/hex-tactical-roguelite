import type { PartyMember } from "../state/RunState.ts";
import type { RunState } from "../state/RunState.ts";
import type { EventChoice } from "../data/events.ts";
import { applyXpToPartyMember } from "./Leveling.ts";

export function restParty(party: PartyMember[]): void {
  for (const pm of party) {
    if (pm.hp <= 0) continue;
    const healAmount = Math.max(1, Math.floor(pm.maxHp * 0.4));
    pm.hp = Math.min(pm.maxHp, pm.hp + healAmount);
  }
}

export function trainPartyMember(pm: PartyMember, xp: number): ReturnType<typeof applyXpToPartyMember> {
  return applyXpToPartyMember(pm, xp);
}

export function applyEventChoiceEffects(choice: EventChoice, run: RunState, rng: () => number): string[] {
  const messages: string[] = [];

  for (const effect of choice.effects) {
    if (effect.type === "gold") {
      run.gold += effect.amount;
      run.inventory.gold += effect.amount;
      messages.push(`Party gains ${effect.amount} gold.`);
    } else if (effect.type === "hp_damage") {
      const living = run.party.filter((p) => p.hp > 0);
      if (living.length > 0 && effect.target === "random_hero") {
        const target = living[Math.floor(rng() * living.length)];
        const dmg = effect.amount;
        target.hp = Math.max(1, target.hp - dmg);
        messages.push(`${target.displayName} takes ${dmg} damage (now ${target.hp} HP).`);
      }
    } else if (effect.type === "potion") {
      run.inventory.potions.push(effect.potionId);
      messages.push(`Gained a potion.`);
    } else if (effect.type === "noop") {
      messages.push(`Nothing happens.`);
    }
  }

  return messages;
}

export function applyStatBoost(pm: PartyMember, stat: string, amount: number): string {
  const key = stat as keyof typeof pm.bonusStats;
  pm.bonusStats[key] = (pm.bonusStats[key] ?? 0) + amount;
  return `${pm.displayName} gains +${amount} ${stat}.`;
}
