import type { RunState, PartyMember, Difficulty } from "../state/RunState.ts";
import { CLASS_REGISTRY, HERO_DEFAULT_NAMES } from "../data/classes.ts";
import { ITEM_REGISTRY } from "../data/items.ts";
import { DEFAULT_MAP_TEMPLATE_ID, getMapTemplate } from "../data/nodes.ts";
import { abilityMod, createDefaultAbilityScores, isCompleteAbilityScores } from "../data/abilities.ts";
import type { AbilityScores } from "../data/abilities.ts";
import { createInventory } from "./Inventory.ts";
import { STARTING_CAMP_SUPPLIES, syncHitDiceForPartyMember, syncSpellSlotsForPartyMember } from "./Rest.ts";
import { DEFAULT_CAMPAIGN, getActDefinition } from "../data/campaigns.ts";

/**
 * Number of heroes the run-setup flow builds.
 *
 * CURRENT-IMPLEMENTATION VALUE ONLY — matches today's encounter tuning and the
 * available hero spawn slots. It is expected to change as the party system grows
 * (recruits, larger parties). Keep the setup UI size-agnostic (render N slots from
 * this constant) and never hardcode "3" in layout/validation logic elsewhere.
 */
export const RUN_SETUP_PARTY_SIZE = 3;

/** A single editable run-setup slot: which class, what the hero is named, and an optional background. */
export interface PartySpec {
  classId: string;
  name: string;
  /** Six assigned ability scores. Defaults/Quick Start use all-10 zero-modifier scores. */
  abilityScores?: AbilityScores;
  /** Chosen background id, or null for "none". See `data/backgrounds.ts`. */
  backgroundId?: string | null;
}

export interface PartyValidation {
  ok: boolean;
  /** Per-slot reason a slot is invalid (null = valid). Index-aligned with the specs. */
  slotErrors: (string | null)[];
  /** First overall reason Confirm should be disabled, or null when the setup is valid. */
  reason: string | null;
}

/**
 * Sensible pre-filled defaults for the quick-start path. Both the Quick Start button
 * and the editable Custom Party screen seed from this.
 */
export function defaultPartySpecs(): PartySpec[] {
  const classIds = ["class.guardian", "class.acolyte", "class.arcanist"];
  return classIds.slice(0, RUN_SETUP_PARTY_SIZE).map((classId, i) => ({
    classId,
    name: HERO_DEFAULT_NAMES[classId] ?? CLASS_REGISTRY[classId]?.displayName ?? `Hero ${i + 1}`,
    abilityScores: createDefaultAbilityScores(),
    // Seed each slot with its class-default background so Quick Start (which uses these
    // specs directly) produces a complete, flavored hero. Custom setup may change it.
    backgroundId: CLASS_REGISTRY[classId]?.defaultBackgroundId ?? null,
  }));
}

/**
 * Validates a setup. Rules (per maintainer decisions for #52):
 * - Exactly RUN_SETUP_PARTY_SIZE slots, each with a known class.
 * - Names must be non-empty; duplicate names AND duplicate classes are both allowed.
 */
export function validatePartySetup(specs: PartySpec[]): PartyValidation {
  const slotErrors: (string | null)[] = [];
  let reason: string | null = null;

  if (specs.length !== RUN_SETUP_PARTY_SIZE) {
    reason = `Party must have exactly ${RUN_SETUP_PARTY_SIZE} heroes.`;
  }

  for (const spec of specs) {
    let err: string | null = null;
    if (!CLASS_REGISTRY[spec.classId]) {
      err = "Choose a class.";
    } else if (spec.name.trim().length === 0) {
      err = "Name cannot be empty.";
    } else if (!isCompleteAbilityScores(spec.abilityScores)) {
      err = "Assign all six ability scores.";
    }
    slotErrors.push(err);
    if (err && !reason) reason = err;
  }

  return { ok: reason === null, slotErrors, reason };
}

/**
 * Pure party builder shared by Quick Start and Custom Party. Produces the same
 * `PartyMember[]` shape the legacy hardcoded party did: starting items from the class
 * definition are auto-equipped into their slots. This is the seam future features
 * (seeded runs, backgrounds/traits) should extend rather than fork.
 */
export function buildParty(specs: PartySpec[]): PartyMember[] {
  return specs.map((spec, i) => {
    const def = CLASS_REGISTRY[spec.classId];
    const equippedItemIds: { weapon: string | null; armor: string | null; trinket: string | null } = {
      weapon: null,
      armor: null,
      trinket: null,
    };
    for (const itemId of def?.startingItems ?? []) {
      const itemDef = ITEM_REGISTRY[itemId];
      if (!itemDef) continue;
      if (!equippedItemIds[itemDef.slot]) {
        equippedItemIds[itemDef.slot] = itemId;
      }
    }
    const baseMaxHp = def?.baseStats.maxHp ?? 1;
    const maxHp = Math.max(1, baseMaxHp + (spec.abilityScores ? abilityMod(spec.abilityScores.con) : 0));
    const member: PartyMember = {
      instanceId: `hero_00${i + 1}`,
      classId: spec.classId,
      displayName: spec.name.trim(),
      level: 1,
      xp: 0,
      hp: maxHp,
      maxHp,
      bonusStats: {},
      equippedItemIds,
      abilityScores: spec.abilityScores ? { ...spec.abilityScores } : undefined,
      // Effect is applied at run start by applyBackgrounds, not here. "none" → undefined.
      backgroundId: spec.backgroundId ?? undefined,
      savingThrowProficiencies: def?.savingThrowProficiencies ? [...def.savingThrowProficiencies] : undefined,
      armorProficiencies: def?.armorProficiencies ? [...def.armorProficiencies] : undefined,
      weaponProficiencies: def?.weaponProficiencies ? [...def.weaponProficiencies] : undefined,
      spellsKnown: [],
      preparedActionIds: [],
    };
    syncHitDiceForPartyMember(member);
    syncSpellSlotsForPartyMember(member);
    return member;
  });
}

/** Map template to use for Act 1 new runs, derived from campaign data with a safe fallback. */
const ACT_1_MAP_TEMPLATE_ID =
  getActDefinition(DEFAULT_CAMPAIGN, 1)?.mapPool.templateIds[0] ?? DEFAULT_MAP_TEMPLATE_ID;

/** Builds a fresh active run around an already-built party. */
export function createRunState(
  party: PartyMember[],
  difficulty: Difficulty = "normal",
  mapTemplateId: string = ACT_1_MAP_TEMPLATE_ID,
): RunState {
  const template = getMapTemplate(mapTemplateId);
  return {
    seed: Date.now(),
    gold: 30,
    campSupplies: STARTING_CAMP_SUPPLIES,
    shortRestsSinceLongRest: 0,
    party,
    inventory: createInventory(),
    mapTemplateId: template.id,
    mapState: {
      currentNodeId: template.startNodeId,
      visitedNodeIds: [template.startNodeId],
      nodesCleared: 0,
      elitesDefeated: 0,
      bossDefeated: false,
    },
    runStatus: "active",
    shopStates: {},
    campStates: {},
    recruitOffers: {},
    runModifiers: [],
    difficulty,
    eventSelections: {},
    adventureLog: [],
  };
}
