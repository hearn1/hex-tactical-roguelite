/**
 * Combat trigger event taxonomy for reactions and triggered passives.
 *
 * REACTION: Consumes the unit's reaction slot (once per reset window).
 * TRIGGERED_PASSIVE: Fires automatically without consuming a reaction.
 *
 * Loop prevention: reaction callbacks must never trigger another reaction
 * (checked by isReactionAvailable before each callback).
 */

export type CombatTriggerKind =
  | "beforeAttackRoll"
  | "afterAttackRollBeforeHit"
  | "beforeDamage"
  | "afterDamage"
  | "afterHit"
  | "onMeleeHitTaken"
  | "onRangedHitTaken"
  | "onSpellCast"
  | "onBossTelegraphStarted"
  | "onBossTelegraphResolving"
  | "onEnemyLeavesAdjacent"
  | "onUnitDropsToZero"
  | "onKill"
  | "onTurnStart"
  | "onTurnEnd";

/** Whether firing the trigger consumes the reaction slot. */
export type ReactionKind = "reaction" | "triggered_passive";

/** Damage delivery channel for hit-taken events. */
export type DamageChannel = "melee" | "ranged" | "spell" | "aoe" | "hazard" | "unknown";

export interface CombatTriggerPayload {
  kind: CombatTriggerKind;
  reactionKind: ReactionKind;
  /** Unit that caused the event (attacker / caster). */
  sourceUnitId?: string;
  /** Unit that receives the event (defender / target). */
  targetUnitId?: string;
  /** Action that produced the event. */
  actionId?: string;
  damageChannel?: DamageChannel;
  previousHp?: number;
  currentHp?: number;
  damageAmount?: number;
  round: number;
}
