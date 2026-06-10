import type { ConditionId, UnitInstance } from "../state/types.ts";
import type { EnemyDef } from "../data/enemies.ts";
import { ENEMY_REGISTRY } from "../data/enemies.ts";
import { ACTION_REGISTRY } from "../data/actions.ts";

/**
 * Short behavior hint per enemy AI tag, so the inspect panel reads like a monster
 * stat block's tactics line. Mirrors the actual {@link EnemyAI} behavior.
 */
const AI_BEHAVIOR_HINTS: Record<EnemyDef["aiTag"], string> = {
  brute: "Charges the nearest hero and hits hard in melee.",
  skirmisher: "Tries to stay at attack range and targets wounded heroes.",
  support: "Hangs back to heal and bolster its allies.",
  caster: "Strikes from range with damaging spells.",
  boss: "Uses heavy melee attacks and telegraphs a Ground Slam below half HP.",
  ambusher: "Hunts exposed or wounded heroes.",
};

const AI_TAG_LABELS: Record<EnemyDef["aiTag"], string> = {
  brute: "Brute",
  skirmisher: "Skirmisher",
  support: "Support",
  caster: "Caster",
  boss: "Boss",
  ambusher: "Ambusher",
};

/** Player-facing one-line summary of what each combat condition does. */
const CONDITION_DESCRIPTIONS: Record<ConditionId, string> = {
  guarded: "Incoming damage reduced.",
  weakened: "Deals reduced damage.",
  blessed: "Bonus to attack and heal rolls.",
  slowed: "Movement reduced each turn.",
  rallied: "Bolstered morale.",
  warded: "Protected by extra Armor.",
  empowered: "Next damaging spell hits harder.",
  taunted: "Forced to attack the taunter.",
  mesmerized: "Cannot act.",
  reckless: "Deals and takes extra damage.",
  armored: "Extra Armor.",
  sanctuary: "Next attack against it is negated.",
  hasted: "Extra movement.",
  counterspelled: "Cancels a boss's telegraphed action.",
};

export function aiBehaviorHint(aiTag: EnemyDef["aiTag"]): string {
  return AI_BEHAVIOR_HINTS[aiTag];
}

export function describeCondition(id: ConditionId): string {
  return CONDITION_DESCRIPTIONS[id];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build the inspect stat-block markup for an enemy unit. Pure presentation: reads the
 * live {@link UnitInstance} plus the enemy definition for actions and behavior hints.
 * `intent` is an optional dynamic line (e.g. a wound-up boss telegraph).
 */
export function buildInspectPanelHtml(unit: UnitInstance, intent: string | null = null): string {
  const def = ENEMY_REGISTRY[unit.defId];
  const tagLabel = def ? AI_TAG_LABELS[def.aiTag] : "";
  const s = unit.stats;

  const header = `<div class="inspect-title">${escapeHtml(unit.displayName)}${
    tagLabel ? ` <span class="inspect-tag">${tagLabel}</span>` : ""
  }</div>`;

  const stats =
    `<div class="inspect-row"><b>HP</b> ${unit.hp}/${s.maxHp}` +
    ` &nbsp; <b>Armor</b> ${s.armor} &nbsp; <b>Move</b> ${s.move}</div>` +
    `<div class="inspect-row"><b>STR</b> ${s.str} &nbsp; <b>DEX</b> ${s.dex}` +
    ` &nbsp; <b>CON</b> ${s.con} &nbsp; <b>INT</b> ${s.int}` +
    ` &nbsp; <b>WIS</b> ${s.wis} &nbsp; <b>CHA</b> ${s.cha}</div>`;

  const actionIds = def ? def.actionIds : [];
  const actionsBody = actionIds
    .map((id) => ACTION_REGISTRY[id])
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map(
      (a) =>
        `<div class="inspect-action"><b>${escapeHtml(a.displayName)}</b> (Range ${a.range})<br/>` +
        `<span class="inspect-sub">${escapeHtml(a.description)}</span></div>`,
    )
    .join("");
  const actions = actionsBody
    ? `<div class="inspect-section"><div class="inspect-label">Actions</div>${actionsBody}</div>`
    : "";

  const conditionsBody = unit.conditions
    .map(
      (c) =>
        `<div class="inspect-sub">${c.id} (${c.remainingTurns}) — ${escapeHtml(describeCondition(c.id))}</div>`,
    )
    .join("");
  const conditions = conditionsBody
    ? `<div class="inspect-section"><div class="inspect-label">Conditions</div>${conditionsBody}</div>`
    : "";

  const behavior = def
    ? `<div class="inspect-section"><div class="inspect-label">Behavior</div>` +
      `<div class="inspect-sub">${escapeHtml(aiBehaviorHint(def.aiTag))}</div></div>`
    : "";

  const intentHtml = intent
    ? `<div class="inspect-section"><div class="inspect-label">Intent</div>` +
      `<div class="inspect-sub inspect-intent">${escapeHtml(intent)}</div></div>`
    : "";

  return header + stats + actions + conditions + behavior + intentHtml;
}
