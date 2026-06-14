import { describe, it, expect } from "vitest";
import { ACTION_REGISTRY, VALID_ACTION_TIMINGS } from "./actions.ts";
import { DataRepository } from "./DataRepository.ts";

describe("ActionTiming (#503)", () => {
  it("omitted timing implies 'action' bucket (undefined defaults to standard)", () => {
    const slash = ACTION_REGISTRY["action.slash"];
    expect(slash).toBeDefined();
    expect(slash.timing).toBeUndefined();
  });

  it("explicit timing is stored and readable", () => {
    const cunning = ACTION_REGISTRY["action.cunning_step"];
    expect(cunning.timing).toBe("bonus_action");
  });

  it("healing word is tagged as bonus_action", () => {
    const hw = ACTION_REGISTRY["action.cleric.healing_word"];
    expect(hw.timing).toBe("bonus_action");
  });

  it("VALID_ACTION_TIMINGS contains all expected buckets", () => {
    for (const t of ["action", "bonus_action", "reaction", "free", "passive", "triggered_passive", "attack_action_modifier", "monster_special"] as const) {
      expect(VALID_ACTION_TIMINGS.has(t)).toBe(true);
    }
  });

  it("DataRepository validation passes with valid timing values", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const report = repo.validate();
    const timingErrors = report.errors.filter((e) => e.includes("timing"));
    expect(timingErrors).toHaveLength(0);
  });
});

describe("B5: On-hit riders conversion (#512)", () => {
  it("Divine Smite is tagged triggered_passive (on-hit rider, not standalone action)", () => {
    expect(ACTION_REGISTRY["action.paladin.divine_smite"].timing).toBe("triggered_passive");
  });

  it("Stunning Strike is tagged triggered_passive (on-hit rider, not standalone action)", () => {
    expect(ACTION_REGISTRY["action.monk.stunning_strike"].timing).toBe("triggered_passive");
  });

  it("Divine Smite still has its spell slot cost", () => {
    expect(ACTION_REGISTRY["action.paladin.divine_smite"].resourceType).toBe("spell_slot");
    expect(ACTION_REGISTRY["action.paladin.divine_smite"].slotCost).toBe(1);
  });

  it("Stunning Strike still has its ki point cost", () => {
    expect(ACTION_REGISTRY["action.monk.stunning_strike"].kiPointCost).toBe(1);
  });

  it("triggered_passive timing does not consume action economy slots", () => {
    // triggered_passive falls through payActionCosts without setting actionUsed or bonusActionUsed
    const divineTiming = ACTION_REGISTRY["action.paladin.divine_smite"].timing;
    expect(divineTiming).not.toBe("action");
    expect(divineTiming).not.toBe("bonus_action");
    expect(divineTiming).not.toBe("free");
  });
});

describe("B4: Extra action and attack-action modifier support (#511)", () => {
  it("Action Surge is a free-timing action with charges and grantExtraAction effect", () => {
    const action = ACTION_REGISTRY["action.fighter.action_surge"];
    expect(action.timing).toBe("free");
    expect(action.charges).toBe(1);
    expect(action.effect.type).toBe("grantExtraAction");
  });

  it("Extra Attack has attack_action_modifier timing (not 'action')", () => {
    expect(ACTION_REGISTRY["action.fighter.extra_attack"].timing).toBe("attack_action_modifier");
  });

  it("Bard Extra Attack has attack_action_modifier timing", () => {
    expect(ACTION_REGISTRY["action.bard.extra_attack"].timing).toBe("attack_action_modifier");
  });

  it("extra-action vs extra-attack: Action Surge and Extra Attack are distinct mechanics", () => {
    const surge = ACTION_REGISTRY["action.fighter.action_surge"];
    const extra = ACTION_REGISTRY["action.fighter.extra_attack"];
    expect(surge.effect.type).toBe("grantExtraAction");
    expect(extra.effect.type).toBe("marker");
    expect(surge.timing).not.toBe("attack_action_modifier");
    expect(extra.timing).not.toBe("free");
  });

  it("Dread Ambusher is a bonus action with 1 charge (first-round limit)", () => {
    const action = ACTION_REGISTRY["action.ranger.dread_ambusher"];
    expect(action.timing).toBe("bonus_action");
    expect(action.charges).toBe(1);
  });

  it("War Priest is a bonus action with 1 charge", () => {
    const action = ACTION_REGISTRY["action.cleric.war_priest"];
    expect(action.timing).toBe("bonus_action");
    expect(action.charges).toBe(1);
  });

  it("Frenzied Strike is a bonus action (respects bonus action availability)", () => {
    expect(ACTION_REGISTRY["action.barbarian.frenzied_strike"].timing).toBe("bonus_action");
  });
});

describe("B3: Free and no-action features (#510)", () => {
  it("Arcane Recovery is a free action", () => {
    expect(ACTION_REGISTRY["action.wizard.arcane_recovery"].timing).toBe("free");
  });

  it("Fast Hands is a free action with usage cap", () => {
    const action = ACTION_REGISTRY["action.rogue.fast_hands"];
    expect(action.timing).toBe("free");
    expect(action.charges).toBe(1);
  });

  it("Quickened Spell is a bonus action spending sorcery points", () => {
    const action = ACTION_REGISTRY["action.sorcerer.quickened_spell"];
    expect(action.timing).toBe("bonus_action");
    expect(action.sorceryPointCost).toBe(2);
  });

  it("Swift Quiver is a bonus action", () => {
    expect(ACTION_REGISTRY["action.ranger.swift_quiver"].timing).toBe("bonus_action");
  });

  it("Wholeness of Body is a free action with usage cap", () => {
    const action = ACTION_REGISTRY["action.monk.wholeness_of_body"];
    expect(action.timing).toBe("free");
    expect(action.charges).toBe(1);
  });

  it("free actions do not consume action or bonus action timing slots", () => {
    const arcaneRecovery = ACTION_REGISTRY["action.wizard.arcane_recovery"];
    const fastHands = ACTION_REGISTRY["action.rogue.fast_hands"];
    expect(arcaneRecovery.timing).toBe("free");
    expect(fastHands.timing).toBe("free");
    // Verified by ActionEconomy.payActionCosts: free timing sets neither actionUsed nor bonusActionUsed
  });
});

describe("B2: Monk and mobility bonus actions (#509)", () => {
  it("Flurry of Blows is a bonus action with ki cost", () => {
    const action = ACTION_REGISTRY["action.monk.flurry_of_blows"];
    expect(action.timing).toBe("bonus_action");
    expect(action.kiPointCost).toBe(1);
  });

  it("Step of the Wind is a bonus action with ki cost", () => {
    const action = ACTION_REGISTRY["action.monk.step_of_wind"];
    expect(action.timing).toBe("bonus_action");
    expect(action.kiPointCost).toBe(1);
  });

  it("Patient Defense is a bonus action with ki cost", () => {
    const action = ACTION_REGISTRY["action.monk.patient_defense"];
    expect(action.timing).toBe("bonus_action");
    expect(action.kiPointCost).toBe(1);
  });

  it("Shadow Step is a bonus action with ki cost 2", () => {
    const action = ACTION_REGISTRY["action.monk.shadow_step"];
    expect(action.timing).toBe("bonus_action");
    expect(action.kiPointCost).toBe(2);
  });

  it("Misty Step is a bonus action spell slot cost", () => {
    const action = ACTION_REGISTRY["action.wizard.misty_step"];
    expect(action.timing).toBe("bonus_action");
    expect(action.resourceType).toBe("spell_slot");
  });

  it("Monk bonus actions do not target enemies without a target (mobility)", () => {
    expect(ACTION_REGISTRY["action.monk.step_of_wind"].targetType).toBe("self");
    expect(ACTION_REGISTRY["action.monk.patient_defense"].targetType).toBe("self");
  });
});

describe("B1: Low-risk bonus action reclassification (#508)", () => {
  it("Second Wind is a bonus action (self heal)", () => {
    expect(ACTION_REGISTRY["action.second_wind"].timing).toBe("bonus_action");
  });

  it("Hunter's Mark is a bonus action (mark/debuff)", () => {
    expect(ACTION_REGISTRY["action.ranger.hunters_mark"].timing).toBe("bonus_action");
  });

  it("Bardic Inspiration is a bonus action (ally buff)", () => {
    expect(ACTION_REGISTRY["action.bard.inspiration"].timing).toBe("bonus_action");
  });

  it("Hex is a bonus action (mark/debuff)", () => {
    expect(ACTION_REGISTRY["action.warlock.hex"].timing).toBe("bonus_action");
  });

  it("Rage is a bonus action", () => {
    expect(ACTION_REGISTRY["action.barbarian.rage"].timing).toBe("bonus_action");
  });

  it("Vow of Enmity is a bonus action", () => {
    expect(ACTION_REGISTRY["action.paladin.vow_of_enmity"].timing).toBe("bonus_action");
  });

  it("Zephyr Strike is a bonus action", () => {
    expect(ACTION_REGISTRY["action.ranger.zephyr_strike"].timing).toBe("bonus_action");
  });

  it("Disengage & Dash is a bonus action (mobility)", () => {
    expect(ACTION_REGISTRY["action.rogue.disengage_dash"].timing).toBe("bonus_action");
  });

  it("bonus action does not block standard action in same turn", () => {
    // All reclassified actions use bonus_action timing — confirm payActionCosts for one
    // does not set actionUsed (tested via ActionEconomy; this asserts timing contract at data layer)
    const rage = ACTION_REGISTRY["action.barbarian.rage"];
    const slash = ACTION_REGISTRY["action.slash"];
    expect(rage.timing).toBe("bonus_action");
    expect(slash.timing).toBeUndefined(); // defaults to "action"
  });
});
