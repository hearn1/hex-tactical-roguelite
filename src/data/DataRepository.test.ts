import { describe, it, expect, beforeEach } from "vitest";
import { DataRepository } from "./DataRepository.ts";
import { ENCOUNTER_POOLS } from "./encounters.ts";

describe("DataRepository", () => {
  let repo: DataRepository;

  beforeEach(() => {
    repo = new DataRepository();
    repo.loadAll();
  });

  it("loads all definitions without crashing", () => {
    expect(repo.isLoaded()).toBe(true);
  });

  it("validate() returns valid: true with no errors", () => {
    const report = repo.validate();
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("getClass returns expected def", () => {
    const def = repo.getClass("class.guardian");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Guardian");
    expect(def!.baseStats.maxHp).toBe(18);
  });

  it("getAction returns expected def", () => {
    const def = repo.getAction("action.slash");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Slash");
    expect(def!.effect).toEqual({ type: "damage", formula: "1d6 + str" });
  });

  it("getItem returns expected def", () => {
    const def = repo.getItem("item.iron_sword");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Iron Sword");
    expect(def!.slot).toBe("weapon");
  });

  it("getEnemy returns expected def", () => {
    const def = repo.getEnemy("enemy.goblin_skirmisher");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Goblin Skirmisher");
    expect(def!.baseStats.maxHp).toBe(8);
  });

  it("getEncounter returns expected def", () => {
    const def = repo.getEncounter("encounter.road_ambush");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Road Ambush");
  });

  it("getNode returns expected def", () => {
    const def = repo.getNode("node.start");
    expect(def).toBeDefined();
    expect(def!.type).toBe("start");
  });

  it("getPotion returns expected def", () => {
    const def = repo.getPotion("potion.healing");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Healing Potion");
  });

  it("getUpgrade returns expected def", () => {
    const def = repo.getUpgrade("upgrade.starting_gold");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Coin Purse");
  });

  it("getEvent returns expected def", () => {
    const def = repo.getEvent("event.strange_shrine");
    expect(def).toBeDefined();
    expect(def!.title).toBe("Strange Shrine");
  });

  it("getReward returns expected def", () => {
    const def = repo.getReward("reward.basic");
    expect(def).toBeDefined();
    expect(def!.itemIds.length).toBeGreaterThan(0);
  });

  it("getting non-existent id returns undefined", () => {
    expect(repo.getClass("class.nonexistent")).toBeUndefined();
    expect(repo.getAction("action.nonexistent")).toBeUndefined();
    expect(repo.getItem("item.nonexistent")).toBeUndefined();
    expect(repo.getEnemy("enemy.nonexistent")).toBeUndefined();
  });

  it("getAllEncounters returns all encounters", () => {
    const all = repo.getAllEncounters();
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  it("getAllNodes returns all nodes", () => {
    const all = repo.getAllNodes();
    expect(all.length).toBeGreaterThanOrEqual(10);
  });

  it("getAllUpgrades returns all upgrades", () => {
    const all = repo.getAllUpgrades();
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  it("getAllEvents returns all events", () => {
    const all = repo.getAllEvents();
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it("getBackground returns expected def", () => {
    const def = repo.getBackground("background.caravan_guard");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Caravan Guard");
    expect(def!.statBonus).toEqual({ stat: "str", amount: 1 });
    expect(def!.perk).toEqual({ type: "startCombatGuarded" });
  });

  it("getAllBackgrounds returns all backgrounds", () => {
    const all = repo.getAllBackgrounds();
    expect(all.length).toBe(5);
  });

  it("every class default background resolves", () => {
    for (const cls of [repo.getClass("class.guardian")!, repo.getClass("class.acolyte")!, repo.getClass("class.arcanist")!]) {
      expect(repo.getBackground(cls.defaultBackgroundId)).toBeDefined();
    }
  });

  it("wizard class registers with correct starting actions and stats", () => {
    const wizard = repo.getClass("class.wizard");
    expect(wizard).toBeDefined();
    expect(wizard!.hitDieSize).toBe(6);
    expect(wizard!.spellSlotsMax).toBe(2);
    expect(wizard!.spellcastingAbility).toBe("int");
    expect(wizard!.actionIds).toContain("action.wizard.fire_bolt");
    expect(wizard!.actionIds).toContain("action.wizard.magic_missile");
    expect(wizard!.actionIds).toContain("action.wizard.mage_armor");
    expect(repo.getAction("action.wizard.fire_bolt")).toBeDefined();
    expect(repo.getAction("action.wizard.magic_missile")).toBeDefined();
    expect(repo.getAction("action.wizard.mage_armor")).toBeDefined();
  });

  it("wizard magic missile has no accuracyStat (auto-hit)", () => {
    const mm = repo.getAction("action.wizard.magic_missile");
    expect(mm).toBeDefined();
    expect(mm!.accuracyStat).toBeUndefined();
    expect(mm!.effect).toMatchObject({ type: "damage", formula: "3d4 + 3" });
  });

  it("wizard archetypes and progression passives are all registered", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    expect(ARCHETYPE_REGISTRY["archetype.wizard.evocation"]).toBeDefined();
    expect(ARCHETYPE_REGISTRY["archetype.wizard.abjuration"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.wizard.arcane_recovery"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.wizard.extra_slot_l5"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.wizard.sculpt_spells"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.wizard.empowered_evocation"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.wizard.ward_regain"]).toBeDefined();
  });

  it("ranger class registers with correct starting actions and stats", () => {
    const ranger = repo.getClass("class.ranger");
    expect(ranger).toBeDefined();
    expect(ranger!.hitDieSize).toBe(10);
    expect(ranger!.spellSlotsMax).toBe(1);
    expect(ranger!.primaryAbility).toBe("dex");
    expect(ranger!.spellcastingAbility).toBe("wis");
    expect(ranger!.actionIds).toContain("action.ranger.hunters_mark");
    expect(ranger!.actionIds).toContain("action.ranger.volley");
    expect(ranger!.actionIds).toContain("action.ranger.ensnaring_strike");
    expect(repo.getAction("action.ranger.hunters_mark")).toBeDefined();
    expect(repo.getAction("action.ranger.volley")).toBeDefined();
    expect(repo.getAction("action.ranger.ensnaring_strike")).toBeDefined();
  });

  it("ranger Hunter's Mark applies hunters_mark condition, Ensnaring Strike roots on hit", () => {
    const mark = repo.getAction("action.ranger.hunters_mark");
    expect(mark).toBeDefined();
    expect(mark!.isCantrip).toBe(true);
    expect(mark!.effect).toMatchObject({ type: "applyCondition", conditionId: "hunters_mark" });

    const strike = repo.getAction("action.ranger.ensnaring_strike");
    expect(strike!.resourceType).toBe("spell_slot");
    expect(strike!.effect).toMatchObject({ type: "damage", applyCondition: { id: "rooted" } });
  });

  it("ranger Volley is a cantrip AoE dealing 1d6+dex", () => {
    const volley = repo.getAction("action.ranger.volley");
    expect(volley).toBeDefined();
    expect(volley!.isCantrip).toBe(true);
    expect(volley!.effect).toMatchObject({ type: "damage", formula: "1d6 + dex", targetMode: "aoe_radius", radius: 2 });
  });

  it("ranger archetypes and passives are all registered", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    expect(ARCHETYPE_REGISTRY["archetype.ranger.hunter"]).toBeDefined();
    expect(ARCHETYPE_REGISTRY["archetype.ranger.gloom_stalker"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.ranger.colossus_slayer"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.ranger.dread_ambusher"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.ranger.extra_slot_l5"]).toBeDefined();
    expect(repo.getAction("action.ranger.hail_of_arrows")).toBeDefined();
    expect(repo.getAction("action.ranger.umbral_sight")).toBeDefined();
  });

  it("ranger L5 progression auto-grants extra_attack", () => {
    const { RANGER_PROGRESSION } = require("./progressionTables.ts");
    const l5 = RANGER_PROGRESSION.find((e: { level: number }) => e.level === 5);
    expect(l5).toBeDefined();
    expect(l5.featuresGranted).toContain("passive.extra_attack");
  });

  it("ranger archetype passives use correct effect types", () => {
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    const colossus = PASSIVE_REGISTRY["passive.ranger.colossus_slayer"];
    expect(colossus.effect).toMatchObject({ type: "colossusSlayer", dice: "1d8" });
    const dread = PASSIVE_REGISTRY["passive.ranger.dread_ambusher"];
    expect(dread.effect).toMatchObject({ type: "dreadAmbusher", initiativeBonus: 1 });
  });

  it("druid class registers with correct starting actions and stats", () => {
    const druid = repo.getClass("class.druid");
    expect(druid).toBeDefined();
    expect(druid!.hitDieSize).toBe(8);
    expect(druid!.spellSlotsMax).toBe(2);
    expect(druid!.primaryAbility).toBe("wis");
    expect(druid!.spellcastingAbility).toBe("wis");
    expect(druid!.actionIds).toContain("action.druid.shillelagh");
    expect(druid!.actionIds).toContain("action.druid.thunderwave");
    expect(druid!.actionIds).toContain("action.druid.healing_rune");
    expect(repo.getAction("action.druid.shillelagh")).toBeDefined();
    expect(repo.getAction("action.druid.thunderwave")).toBeDefined();
    expect(repo.getAction("action.druid.healing_rune")).toBeDefined();
  });

  it("druid Shillelagh is a WIS cantrip melee; Thunderwave is a spell slot AoE with push", () => {
    const shillelagh = repo.getAction("action.druid.shillelagh");
    expect(shillelagh).toBeDefined();
    expect(shillelagh!.isCantrip).toBe(true);
    expect(shillelagh!.accuracyStat).toBe("wis");
    expect(shillelagh!.effect).toMatchObject({ type: "damage", formula: "1d8 + wis" });

    const thunderwave = repo.getAction("action.druid.thunderwave");
    expect(thunderwave!.resourceType).toBe("spell_slot");
    expect(thunderwave!.effect).toMatchObject({ type: "damage", formula: "2d8", targetMode: "aoe_around_caster", pushDistance: 1 });
  });

  it("druid Healing Rune places a healing condition on an ally at range 2", () => {
    const rune = repo.getAction("action.druid.healing_rune");
    expect(rune).toBeDefined();
    expect(rune!.targetType).toBe("ally");
    expect(rune!.range).toBe(2);
    expect(rune!.effect).toMatchObject({ type: "applyCondition", conditionId: "healing_rune", duration: 1 });
  });

  it("druid archetypes and passives are all registered", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    expect(ARCHETYPE_REGISTRY["archetype.druid.circle_of_moon"]).toBeDefined();
    expect(ARCHETYPE_REGISTRY["archetype.druid.circle_of_land"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.druid.wild_shape"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.druid.extra_slot_l5"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.druid.combat_wild_shape"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.druid.natural_recovery"]).toBeDefined();
    expect(repo.getAction("action.druid.wild_shape")).toBeDefined();
    expect(repo.getAction("action.druid.land_stride")).toBeDefined();
  });

  it("druid L2 progression auto-grants wild_shape passive", () => {
    const { DRUID_PROGRESSION } = require("./progressionTables.ts");
    const l2 = DRUID_PROGRESSION.find((e: { level: number }) => e.level === 2);
    expect(l2).toBeDefined();
    expect(l2.featuresGranted).toContain("passive.druid.wild_shape");
  });

  it("druid L5 progression auto-grants extra_slot_l5 passive", () => {
    const { DRUID_PROGRESSION } = require("./progressionTables.ts");
    const l5 = DRUID_PROGRESSION.find((e: { level: number }) => e.level === 5);
    expect(l5).toBeDefined();
    expect(l5.featuresGranted).toContain("passive.druid.extra_slot_l5");
  });

  it("druid archetype passive effect types are correct", () => {
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    const combatWS = PASSIVE_REGISTRY["passive.druid.combat_wild_shape"];
    expect(combatWS.effect).toMatchObject({ type: "wildShapeBonus", acBonus: 2, strBonus: 2 });
    const natRec = PASSIVE_REGISTRY["passive.druid.natural_recovery"];
    expect(natRec.effect).toMatchObject({ type: "naturalRecovery", slotsAfterCombat: 1 });
    const wildShape = PASSIVE_REGISTRY["passive.druid.wild_shape"];
    expect(wildShape.effect).toMatchObject({ type: "wildShapeGrant", chargesPerCombat: 2 });
  });

  it("bard class registers with correct starting actions and stats", () => {
    const bard = repo.getClass("class.bard");
    expect(bard).toBeDefined();
    expect(bard!.hitDieSize).toBe(8);
    expect(bard!.spellSlotsMax).toBe(2);
    expect(bard!.primaryAbility).toBe("cha");
    expect(bard!.spellcastingAbility).toBe("cha");
    expect(bard!.actionIds).toContain("action.bard.vicious_mockery");
    expect(bard!.actionIds).toContain("action.bard.inspiration");
    expect(bard!.actionIds).toContain("action.bard.healing_song");
    expect(repo.getAction("action.bard.vicious_mockery")).toBeDefined();
    expect(repo.getAction("action.bard.inspiration")).toBeDefined();
    expect(repo.getAction("action.bard.healing_song")).toBeDefined();
  });

  it("bard Vicious Mockery is a CHA cantrip that applies rattled", () => {
    const vm = repo.getAction("action.bard.vicious_mockery");
    expect(vm).toBeDefined();
    expect(vm!.isCantrip).toBe(true);
    expect(vm!.accuracyStat).toBe("cha");
    expect(vm!.effect).toMatchObject({ type: "damage", formula: "1d4 + cha", applyCondition: { id: "rattled" } });
  });

  it("bard Bardic Inspiration is a cantrip that grants bardic_inspiration to an ally", () => {
    const insp = repo.getAction("action.bard.inspiration");
    expect(insp).toBeDefined();
    expect(insp!.isCantrip).toBe(true);
    expect(insp!.targetType).toBe("ally");
    expect(insp!.range).toBe(2);
    expect(insp!.effect).toMatchObject({ type: "applyCondition", conditionId: "bardic_inspiration" });
  });

  it("bard Healing Song is a spell slot AoE heal targeting allies", () => {
    const hs = repo.getAction("action.bard.healing_song");
    expect(hs).toBeDefined();
    expect(hs!.resourceType).toBe("spell_slot");
    expect(hs!.targetType).toBe("ally");
    expect(hs!.effect).toMatchObject({ type: "heal", formula: "1d6 + cha", targetMode: "aoe_radius", radius: 2 });
  });

  it("bard archetypes and passives are all registered", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    expect(ARCHETYPE_REGISTRY["archetype.bard.college_of_lore"]).toBeDefined();
    expect(ARCHETYPE_REGISTRY["archetype.bard.college_of_valor"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.jack_of_all_trades"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.bard.font_of_inspiration"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.bard.additional_magical_secrets"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.bard.combat_inspiration"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.bard.extra_attack"]).toBeDefined();
    expect(repo.getAction("action.bard.cutting_words")).toBeDefined();
  });

  it("bard L2 progression auto-grants jack_of_all_trades passive", () => {
    const { BARD_PROGRESSION } = require("./progressionTables.ts");
    const l2 = BARD_PROGRESSION.find((e: { level: number }) => e.level === 2);
    expect(l2).toBeDefined();
    expect(l2.featuresGranted).toContain("passive.jack_of_all_trades");
  });

  it("bard L5 progression auto-grants font_of_inspiration passive", () => {
    const { BARD_PROGRESSION } = require("./progressionTables.ts");
    const l5 = BARD_PROGRESSION.find((e: { level: number }) => e.level === 5);
    expect(l5).toBeDefined();
    expect(l5.featuresGranted).toContain("passive.bard.font_of_inspiration");
  });

  it("bard College of Valor grants extra_attack at L5", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const valor = ARCHETYPE_REGISTRY["archetype.bard.college_of_valor"];
    expect(valor).toBeDefined();
    expect(valor.featuresByHeroLevel?.[5]?.featuresGranted).toContain("passive.bard.extra_attack");
  });

  it("bard College of Lore grants Cutting Words action", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const lore = ARCHETYPE_REGISTRY["archetype.bard.college_of_lore"];
    expect(lore).toBeDefined();
    expect(lore.grantedActionId).toBe("action.bard.cutting_words");
  });

  it("warlock class registers with correct starting actions, stats, and pact magic flag", () => {
    const warlock = repo.getClass("class.warlock");
    expect(warlock).toBeDefined();
    expect(warlock!.hitDieSize).toBe(8);
    expect(warlock!.spellSlotsMax).toBe(1);
    expect(warlock!.pactMagic).toBe(true);
    expect(warlock!.primaryAbility).toBe("cha");
    expect(warlock!.spellcastingAbility).toBe("cha");
    expect(warlock!.actionIds).toContain("action.warlock.eldritch_blast");
    expect(warlock!.actionIds).toContain("action.warlock.hex");
    expect(warlock!.actionIds).toContain("action.warlock.armor_of_agathys");
    expect(repo.getAction("action.warlock.eldritch_blast")).toBeDefined();
    expect(repo.getAction("action.warlock.hex")).toBeDefined();
    expect(repo.getAction("action.warlock.armor_of_agathys")).toBeDefined();
  });

  it("warlock Eldritch Blast is a CHA cantrip at range 4; Hex applies a curse condition", () => {
    const eb = repo.getAction("action.warlock.eldritch_blast");
    expect(eb).toBeDefined();
    expect(eb!.isCantrip).toBe(true);
    expect(eb!.accuracyStat).toBe("cha");
    expect(eb!.range).toBe(4);
    expect(eb!.effect).toMatchObject({ type: "damage", formula: "1d10 + cha" });

    const hex = repo.getAction("action.warlock.hex");
    expect(hex!.isCantrip).toBe(true);
    expect(hex!.effect).toMatchObject({ type: "applyCondition", conditionId: "hexed" });
  });

  it("warlock Armor of Agathys is a spell-slot self-buff", () => {
    const aoa = repo.getAction("action.warlock.armor_of_agathys");
    expect(aoa).toBeDefined();
    expect(aoa!.resourceType).toBe("spell_slot");
    expect(aoa!.targetType).toBe("self");
    expect(aoa!.effect).toMatchObject({ type: "applyCondition", conditionId: "armor_of_agathys" });
  });

  it("warlock archetypes and passives are all registered", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    expect(ARCHETYPE_REGISTRY["archetype.warlock.fiend"]).toBeDefined();
    expect(ARCHETYPE_REGISTRY["archetype.warlock.great_old_one"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.warlock.dark_ones_blessing"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.warlock.awakened_mind"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.warlock.agonizing_blast"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.warlock.extra_pact_slot"]).toBeDefined();
    expect(repo.getAction("action.warlock.hellish_rebuke")).toBeDefined();
    expect(repo.getAction("action.warlock.entropic_ward")).toBeDefined();
  });

  it("warlock L5 progression auto-grants extra_pact_slot passive", () => {
    const { WARLOCK_PROGRESSION } = require("./progressionTables.ts");
    const l5 = WARLOCK_PROGRESSION.find((e: { level: number }) => e.level === 5);
    expect(l5).toBeDefined();
    expect(l5.featuresGranted).toContain("passive.warlock.extra_pact_slot");
  });

  it("warlock archetype passive effect types are correct", () => {
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    const darkBlessing = PASSIVE_REGISTRY["passive.warlock.dark_ones_blessing"];
    expect(darkBlessing.effect).toMatchObject({ type: "onKillTempHp", stat: "cha" });
    const awakenedMind = PASSIVE_REGISTRY["passive.warlock.awakened_mind"];
    expect(awakenedMind.effect).toMatchObject({ type: "forceReroll", usesPerCombat: 1 });
    const agonizing = PASSIVE_REGISTRY["passive.warlock.agonizing_blast"];
    expect(agonizing.effect).toMatchObject({ type: "empoweredEvocation", stat: "cha" });
  });

  it("paladin class registers with correct starting actions and stats", () => {
    const paladin = repo.getClass("class.paladin");
    expect(paladin).toBeDefined();
    expect(paladin!.hitDieSize).toBe(10);
    expect(paladin!.spellSlotsMax).toBe(1);
    expect(paladin!.primaryAbility).toBe("str");
    expect(paladin!.spellcastingAbility).toBe("cha");
    expect(paladin!.savingThrowProficiencies).toEqual(["wis", "cha"]);
    expect(paladin!.actionIds).toContain("action.paladin.divine_smite");
    expect(paladin!.actionIds).toContain("action.paladin.lay_on_hands");
    expect(paladin!.actionIds).toContain("action.paladin.sacred_weapon");
    expect(repo.getAction("action.paladin.divine_smite")).toBeDefined();
    expect(repo.getAction("action.paladin.lay_on_hands")).toBeDefined();
    expect(repo.getAction("action.paladin.sacred_weapon")).toBeDefined();
  });

  it("paladin Divine Smite is a spell_slot melee damage action with 2d8", () => {
    const smite = repo.getAction("action.paladin.divine_smite");
    expect(smite).toBeDefined();
    expect(smite!.resourceType).toBe("spell_slot");
    expect(smite!.range).toBe(1);
    expect(smite!.accuracyStat).toBe("str");
    expect(smite!.effect).toMatchObject({ type: "damage", formula: "2d8" });
  });

  it("paladin Lay on Hands is a limited-charge heal for adjacent targets", () => {
    const loh = repo.getAction("action.paladin.lay_on_hands");
    expect(loh).toBeDefined();
    expect(loh!.charges).toBeGreaterThan(0);
    expect(loh!.range).toBe(1);
    expect(loh!.effect).toMatchObject({ type: "heal" });
  });

  it("paladin Sacred Weapon is a cantrip self-buff that applies a condition", () => {
    const sw = repo.getAction("action.paladin.sacred_weapon");
    expect(sw).toBeDefined();
    expect(sw!.isCantrip).toBe(true);
    expect(sw!.targetType).toBe("self");
    expect(sw!.effect).toMatchObject({ type: "applyCondition", conditionId: "sacred_weapon" });
  });

  it("paladin archetypes and passives are all registered", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    expect(ARCHETYPE_REGISTRY["archetype.paladin.devotion"]).toBeDefined();
    expect(ARCHETYPE_REGISTRY["archetype.paladin.vengeance"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.paladin.devotion_aura"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.paladin.relentless_avenger"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.paladin.loh_pool_extended"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.paladin.extra_slot_l5"]).toBeDefined();
    expect(repo.getAction("action.paladin.holy_nimbus")).toBeDefined();
    expect(repo.getAction("action.paladin.vow_of_enmity")).toBeDefined();
  });

  it("paladin Devotion Aura is a save aura with radius 2", () => {
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    const aura = PASSIVE_REGISTRY["passive.paladin.devotion_aura"];
    expect(aura.effect).toMatchObject({ type: "saveAura", bonus: 1, radius: 2 });
  });

  it("paladin Relentless Avenger is a relentlessAvenger passive", () => {
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    const passive = PASSIVE_REGISTRY["passive.paladin.relentless_avenger"];
    expect(passive.effect).toMatchObject({ type: "relentlessAvenger", moveBonus: 1 });
  });

  it("paladin L2 progression auto-grants loh_pool_extended passive", () => {
    const { PALADIN_PROGRESSION } = require("./progressionTables.ts");
    const l2 = PALADIN_PROGRESSION.find((e: { level: number }) => e.level === 2);
    expect(l2).toBeDefined();
    expect(l2.featuresGranted).toContain("passive.paladin.loh_pool_extended");
  });

  it("paladin L5 progression auto-grants extra_attack and extra_slot_l5", () => {
    const { PALADIN_PROGRESSION } = require("./progressionTables.ts");
    const l5 = PALADIN_PROGRESSION.find((e: { level: number }) => e.level === 5);
    expect(l5).toBeDefined();
    expect(l5.featuresGranted).toContain("passive.extra_attack");
    expect(l5.featuresGranted).toContain("passive.paladin.extra_slot_l5");
  });

  it("barbarian class registers with correct starting actions and stats", () => {
    const barbarian = repo.getClass("class.barbarian");
    expect(barbarian).toBeDefined();
    expect(barbarian!.hitDieSize).toBe(12);
    expect(barbarian!.primaryAbility).toBe("str");
    expect(barbarian!.savingThrowProficiencies).toEqual(["str", "con"]);
    expect(barbarian!.spellSlotsMax).toBeUndefined();
    expect(barbarian!.actionIds).toContain("action.barbarian.rage");
    expect(barbarian!.actionIds).toContain("action.barbarian.reckless_attack");
    expect(barbarian!.actionIds).toContain("action.barbarian.brutal_strike");
    expect(repo.getAction("action.barbarian.rage")).toBeDefined();
    expect(repo.getAction("action.barbarian.reckless_attack")).toBeDefined();
    expect(repo.getAction("action.barbarian.brutal_strike")).toBeDefined();
  });

  it("barbarian Rage is a limited-charge self-buff that applies the raged condition", () => {
    const rage = repo.getAction("action.barbarian.rage");
    expect(rage).toBeDefined();
    expect(rage!.charges).toBe(2);
    expect(rage!.targetType).toBe("self");
    expect(rage!.effect).toMatchObject({ type: "applyCondition", conditionId: "raged", duration: 3 });
  });

  it("barbarian Reckless Attack is a STR cantrip melee dealing 1d8+str", () => {
    const ra = repo.getAction("action.barbarian.reckless_attack");
    expect(ra).toBeDefined();
    expect(ra!.isCantrip).toBe(true);
    expect(ra!.range).toBe(1);
    expect(ra!.accuracyStat).toBe("str");
    expect(ra!.effect).toMatchObject({ type: "damage", formula: "1d8 + str" });
  });

  it("barbarian Brutal Strike is a STR cantrip melee dealing 1d12+str", () => {
    const bs = repo.getAction("action.barbarian.brutal_strike");
    expect(bs).toBeDefined();
    expect(bs!.isCantrip).toBe(true);
    expect(bs!.accuracyStat).toBe("str");
    expect(bs!.effect).toMatchObject({ type: "damage", formula: "1d12 + str" });
  });

  it("barbarian archetypes and passives are all registered", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    expect(ARCHETYPE_REGISTRY["archetype.barbarian.berserker"]).toBeDefined();
    expect(ARCHETYPE_REGISTRY["archetype.barbarian.totem_bear"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.barbarian.danger_sense"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.barbarian.frenzy"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.barbarian.bear_totem"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.barbarian.extra_rage_l2"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.barbarian.extra_rage_l5"]).toBeDefined();
    expect(repo.getAction("action.barbarian.frenzied_strike")).toBeDefined();
  });

  it("barbarian Berserker grants frenzied_strike and frenzy passive", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const berserker = ARCHETYPE_REGISTRY["archetype.barbarian.berserker"];
    expect(berserker.grantedActionId).toBe("action.barbarian.frenzied_strike");
    expect(berserker.passiveId).toBe("passive.barbarian.frenzy");
  });

  it("barbarian Totem Bear passive grants resistance to all damage types", () => {
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    const bearTotem = PASSIVE_REGISTRY["passive.barbarian.bear_totem"];
    expect(bearTotem.effect).toMatchObject({ type: "resistance", damageTypes: ["all"] });
  });

  it("barbarian L2 progression auto-grants danger_sense passive", () => {
    const { BARBARIAN_PROGRESSION } = require("./progressionTables.ts");
    const l2 = BARBARIAN_PROGRESSION.find((e: { level: number }) => e.level === 2);
    expect(l2).toBeDefined();
    expect(l2.featuresGranted).toContain("passive.barbarian.danger_sense");
  });

  it("barbarian L5 progression auto-grants extra_attack", () => {
    const { BARBARIAN_PROGRESSION } = require("./progressionTables.ts");
    const l5 = BARBARIAN_PROGRESSION.find((e: { level: number }) => e.level === 5);
    expect(l5).toBeDefined();
    expect(l5.featuresGranted).toContain("passive.extra_attack");
  });

  it("barbarian frenzy passive uses frenziedAttack effect type", () => {
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    const frenzy = PASSIVE_REGISTRY["passive.barbarian.frenzy"];
    expect(frenzy.effect).toMatchObject({ type: "frenziedAttack", usesPerCombat: 1 });
  });
});

describe("DataRepository validation rejects broken references", () => {
  it("detects missing action in class", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const originalActions = [...cls.actionIds];
    cls.actionIds.push("action.nonexistent");
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("action.nonexistent"))).toBe(true);
    cls.actionIds = originalActions;
  });

  it("detects missing item in class startingItems", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const original = [...cls.startingItems];
    cls.startingItems.push("item.nonexistent");
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("item.nonexistent"))).toBe(true);
    cls.startingItems = original;
  });

  it("detects missing enemy in encounter", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const enc = repo.getEncounter("encounter.road_ambush")!;
    const original = [...enc.enemyGroups];
    enc.enemyGroups.push({ enemyId: "enemy.nonexistent", count: 1 });
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("enemy.nonexistent"))).toBe(true);
    enc.enemyGroups = original;
  });

  it("warns when a class is missing new required proficiency fields", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const original = { ...cls };
    delete (cls as Partial<typeof cls>).primaryAbility;
    delete (cls as Partial<typeof cls>).savingThrowProficiencies;
    delete (cls as Partial<typeof cls>).armorProficiencies;
    delete (cls as Partial<typeof cls>).weaponProficiencies;
    const report = repo.validate();
    expect(report.valid).toBe(true);
    expect(report.warnings.some((w) => w.includes("primaryAbility"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("savingThrowProficiencies"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("armorProficiencies"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("weaponProficiencies"))).toBe(true);
    Object.assign(cls, original);
  });

  it("errors on invalid primaryAbility stat key", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const original = cls.primaryAbility;
    // @ts-expect-error — deliberately invalid stat key
    cls.primaryAbility = "luck";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('"luck"') && e.includes("primaryAbility"))).toBe(true);
    cls.primaryAbility = original;
  });

  it("errors on invalid armorProficiencies value", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const original = cls.armorProficiencies;
    // @ts-expect-error — deliberately invalid armor type
    cls.armorProficiencies = ["plate"];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('"plate"') && e.includes("armorProficiencies"))).toBe(true);
    cls.armorProficiencies = original;
  });

  it("errors on invalid weaponProficiencies value", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const original = cls.weaponProficiencies;
    // @ts-expect-error — deliberately invalid weapon type
    cls.weaponProficiencies = ["exotic"];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('"exotic"') && e.includes("weaponProficiencies"))).toBe(true);
    cls.weaponProficiencies = original;
  });

  it("errors when savingThrowProficiencies does not have exactly 2 entries", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const original = cls.savingThrowProficiencies;
    // @ts-expect-error — deliberately wrong length
    cls.savingThrowProficiencies = ["str"];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("exactly 2 entries"))).toBe(true);
    cls.savingThrowProficiencies = original;
  });

  it("detects an invalid class default background reference", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const cls = repo.getClass("class.guardian")!;
    const original = cls.defaultBackgroundId;
    cls.defaultBackgroundId = "background.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("background.nonexistent"))).toBe(true);
    cls.defaultBackgroundId = original;
  });

  it("detects an unknown potion reference in a background", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const bg = repo.getBackground("background.field_medic")!;
    const original = bg.startingPotionId;
    bg.startingPotionId = "potion.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("potion.nonexistent"))).toBe(true);
    bg.startingPotionId = original;
  });

  it("detects an unknown item reference in a background", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const bg = repo.getBackground("background.cutpurse")!;
    const original = bg.startingItemId;
    bg.startingItemId = "item.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("item.nonexistent"))).toBe(true);
    bg.startingItemId = original;
  });

  it("detects an unknown item referenced by an event effect", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.rogue_trader")!;
    const choice = ev.choices[0];
    const original = [...choice.effects];
    choice.effects.push({ type: "item", itemId: "item.nonexistent" });
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("item.nonexistent"))).toBe(true);
    choice.effects = original;
  });

  it("detects an unknown potion nested inside a check branch", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.crumbling_bridge")!;
    const choice = ev.choices[0];
    const original = [...choice.effects];
    choice.effects = [{
      type: "check",
      check: { stat: "dex", dc: 12 },
      onSuccess: [{ type: "potion", potionId: "potion.nonexistent" }],
      onFailure: [{ type: "noop" }],
    }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("potion.nonexistent"))).toBe(true);
    choice.effects = original;
  });

  it("detects a non-positive check DC", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.crumbling_bridge")!;
    const choice = ev.choices[0];
    const original = [...choice.effects];
    choice.effects = [{
      type: "check",
      check: { stat: "dex", dc: 0 },
      onSuccess: [{ type: "noop" }],
      onFailure: [{ type: "noop" }],
    }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("DC must be > 0"))).toBe(true);
    choice.effects = original;
  });

  it("detects an unknown item in a choice requirement", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.rogue_trader")!;
    const choice = ev.choices[0];
    choice.requirements = [{ type: "hasItem", itemId: "item.nonexistent" }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("item.nonexistent"))).toBe(true);
    delete choice.requirements;
  });

  it("detects an event with fewer than 2 choices", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.quiet_hollow")!;
    const original = [...ev.choices];
    ev.choices = [original[0]];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("at least 2 choices"))).toBe(true);
    ev.choices = original;
  });

  it("detects an unknown event tag", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.quiet_hollow")!;
    const original = ev.tags;
    // @ts-expect-error — deliberately invalid tag to exercise the validator
    ev.tags = ["bogus"];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('unknown tag "bogus"'))).toBe(true);
    ev.tags = original;
  });

  it("detects an encounter referencing an unknown reward pool", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const enc = repo.getEncounter("encounter.road_ambush")!;
    enc.rewardPoolId = "reward.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("reward.nonexistent"))).toBe(true);
    delete enc.rewardPoolId;
  });

  it("detects an enemy position outside the combat grid", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const enc = repo.getEncounter("encounter.shadowed_defile")!;
    const original = enc.positions ? [...enc.positions] : undefined;
    enc.positions = [{ q: 9, r: 9 }, { q: 0, r: 2 }, { q: 0, r: -2 }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("outside the grid"))).toBe(true);
    enc.positions = original;
  });

  it("detects overlapping enemy positions", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const enc = repo.getEncounter("encounter.shadowed_defile")!;
    const original = enc.positions ? [...enc.positions] : undefined;
    enc.positions = [{ q: 0, r: 2 }, { q: 0, r: 2 }, { q: 0, r: -2 }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("used twice"))).toBe(true);
    enc.positions = original;
  });

  it("detects an encounter exceeding the 5-enemy cap", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const enc = repo.getEncounter("encounter.road_ambush")!;
    const original = [...enc.enemyGroups];
    enc.enemyGroups = [{ enemyId: "enemy.wolf", count: 6 }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("exceeds cap"))).toBe(true);
    enc.enemyGroups = original;
  });

  it("detects an encounter pool referencing an unknown encounter", () => {
    const repo = new DataRepository();
    repo.loadAll();
    ENCOUNTER_POOLS["pool.standard_combat"].push("encounter.nonexistent");
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("encounter.nonexistent"))).toBe(true);
    ENCOUNTER_POOLS["pool.standard_combat"].pop();
  });

  it("detects a node referencing an unknown encounter pool", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const node = repo.getNode("node.long_combat_a")!;
    const original = node.encounterPoolId;
    node.encounterPoolId = "pool.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("pool.nonexistent"))).toBe(true);
    node.encounterPoolId = original;
  });

  it("detects a node referencing an unknown event pool", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const node = repo.getNode("node.event_1")!;
    node.eventPoolId = "pool.nonexistent";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("pool.nonexistent"))).toBe(true);
    delete node.eventPoolId;
  });

  it("validation fails when not loaded", () => {
    const repo = new DataRepository();
    const report = repo.validate();
    expect(report.valid).toBe(false);
  });

  it("rejects a non-boolean requiresAttunement", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const item = repo.getItem("item.runemark_blade")!;
    const original = item.requiresAttunement;
    // @ts-expect-error — deliberately invalid type to exercise the validator
    item.requiresAttunement = "yes";
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("requiresAttunement must be a boolean"))).toBe(true);
    item.requiresAttunement = original;
  });

  it("rejects legacy check stat 'might' — must use AbilityKey", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.crumbling_bridge")!;
    const choice = ev.choices[0];
    const original = [...choice.effects];
    // @ts-expect-error — deliberately injecting a legacy stat to test the validator
    choice.effects = [{ type: "check", check: { stat: "might", dc: 12 }, onSuccess: [{ type: "noop" }], onFailure: [{ type: "noop" }] }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('"might"') && e.includes("valid ability"))).toBe(true);
    choice.effects = original;
  });

  it("accepts stat_boost with ability key stat 'wis'", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const report = repo.validate();
    expect(report.valid).toBe(true);
    // event.strange_shrine uses stat_boost: wis (was spirit before #141)
    const shrine = repo.getEvent("event.strange_shrine")!;
    const prayChoice = shrine.choices.find((c) => c.id === "event.strange_shrine.pray")!;
    expect(prayChoice.effects[0]).toMatchObject({ type: "stat_boost", stat: "wis" });
  });

  it("rejects an invalid ability key in a check stat", () => {
    const repo = new DataRepository();
    repo.loadAll();
    const ev = repo.getEvent("event.crumbling_bridge")!;
    const choice = ev.choices[0];
    const original = [...choice.effects];
    // @ts-expect-error — deliberately injecting a bad ability key
    choice.effects = [{ type: "check", check: { stat: "luck", dc: 12 }, onSuccess: [{ type: "noop" }], onFailure: [{ type: "noop" }] }];
    const report = repo.validate();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('"luck"'))).toBe(true);
    choice.effects = original;
  });
});

describe("Sorcerer class content (epic #188)", () => {
  let repo: DataRepository;

  beforeEach(() => {
    repo = new DataRepository();
    repo.loadAll();
  });

  it("sorcerer class registers with correct starting actions and stats", () => {
    const sorcerer = repo.getClass("class.sorcerer");
    expect(sorcerer).toBeDefined();
    expect(sorcerer!.hitDieSize).toBe(6);
    expect(sorcerer!.spellSlotsMax).toBe(2);
    expect(sorcerer!.sorceryPointsMax).toBe(2);
    expect(sorcerer!.primaryAbility).toBe("cha");
    expect(sorcerer!.spellcastingAbility).toBe("cha");
    expect(sorcerer!.savingThrowProficiencies).toEqual(["con", "cha"]);
    expect(sorcerer!.actionIds).toContain("action.sorcerer.chromatic_orb");
    expect(sorcerer!.actionIds).toContain("action.sorcerer.twin_bolt");
    expect(sorcerer!.actionIds).toContain("action.sorcerer.wild_surge");
    expect(repo.getAction("action.sorcerer.chromatic_orb")).toBeDefined();
    expect(repo.getAction("action.sorcerer.twin_bolt")).toBeDefined();
    expect(repo.getAction("action.sorcerer.wild_surge")).toBeDefined();
  });

  it("Chromatic Orb is a spell-slot ranged-3 damage action using CHA", () => {
    const orb = repo.getAction("action.sorcerer.chromatic_orb");
    expect(orb).toBeDefined();
    expect(orb!.resourceType).toBe("spell_slot");
    expect(orb!.range).toBe(3);
    expect(orb!.accuracyStat).toBe("cha");
    expect(orb!.effect).toMatchObject({ type: "damage", formula: "3d8 + cha" });
  });

  it("Twin Bolt is a CHA cantrip with sorceryPointCost 1 hitting primary plus adjacent", () => {
    const tb = repo.getAction("action.sorcerer.twin_bolt");
    expect(tb).toBeDefined();
    expect(tb!.isCantrip).toBe(true);
    expect(tb!.sorceryPointCost).toBe(1);
    expect(tb!.accuracyStat).toBe("cha");
    expect(tb!.effect).toMatchObject({ type: "damage", formula: "1d8 + cha", targetMode: "primary_plus_adjacent" });
  });

  it("Wild Surge is a CHA cantrip ranged-3 dealing 1d10+cha", () => {
    const ws = repo.getAction("action.sorcerer.wild_surge");
    expect(ws).toBeDefined();
    expect(ws!.isCantrip).toBe(true);
    expect(ws!.range).toBe(3);
    expect(ws!.accuracyStat).toBe("cha");
    expect(ws!.effect).toMatchObject({ type: "damage", formula: "1d10 + cha" });
  });

  it("sorcerer archetypes and passives are all registered", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    expect(ARCHETYPE_REGISTRY["archetype.sorcerer.draconic"]).toBeDefined();
    expect(ARCHETYPE_REGISTRY["archetype.sorcerer.wild_magic"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.sorcerer.draconic_resilience"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.sorcerer.elemental_affinity"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.sorcerer.wild_magic_surge"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.sorcerer.empowered_spell"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.sorcerer.quickened_spell"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.sorcerer.heightened_spell"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.sorcerer.extra_sp_l2"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.sorcerer.extra_sp_l5"]).toBeDefined();
    expect(PASSIVE_REGISTRY["passive.sorcerer.extra_slot_l5"]).toBeDefined();
    expect(repo.getAction("action.sorcerer.tides_of_chaos")).toBeDefined();
  });

  it("Draconic Bloodline grants draconic_resilience passive and elemental_affinity at L5", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const draconic = ARCHETYPE_REGISTRY["archetype.sorcerer.draconic"];
    expect(draconic).toBeDefined();
    expect(draconic.passiveId).toBe("passive.sorcerer.draconic_resilience");
    expect(draconic.featuresByHeroLevel?.[5]?.featuresGranted).toContain("passive.sorcerer.elemental_affinity");
  });

  it("Wild Magic grants tides_of_chaos action and wild_magic_surge passive", () => {
    const { ARCHETYPE_REGISTRY } = require("./archetypes.ts");
    const wildMagic = ARCHETYPE_REGISTRY["archetype.sorcerer.wild_magic"];
    expect(wildMagic).toBeDefined();
    expect(wildMagic.grantedActionId).toBe("action.sorcerer.tides_of_chaos");
    expect(wildMagic.passiveId).toBe("passive.sorcerer.wild_magic_surge");
  });

  it("sorcerer L2 progression auto-grants extra_sp_l2 passive", () => {
    const { SORCERER_PROGRESSION } = require("./progressionTables.ts");
    const l2 = SORCERER_PROGRESSION.find((e: { level: number }) => e.level === 2);
    expect(l2).toBeDefined();
    expect(l2.featuresGranted).toContain("passive.sorcerer.extra_sp_l2");
  });

  it("sorcerer L5 progression auto-grants extra_slot_l5 and extra_sp_l5", () => {
    const { SORCERER_PROGRESSION } = require("./progressionTables.ts");
    const l5 = SORCERER_PROGRESSION.find((e: { level: number }) => e.level === 5);
    expect(l5).toBeDefined();
    expect(l5.featuresGranted).toContain("passive.sorcerer.extra_slot_l5");
    expect(l5.featuresGranted).toContain("passive.sorcerer.extra_sp_l5");
  });

  it("sorcerer SP and spell-slot passives use correct effect types", () => {
    const { PASSIVE_REGISTRY } = require("./passives.ts");
    const extraSp = PASSIVE_REGISTRY["passive.sorcerer.extra_sp_l2"];
    expect(extraSp.effect).toMatchObject({ type: "sorceryPointBonus", amount: 2 });
    const extraSlot = PASSIVE_REGISTRY["passive.sorcerer.extra_slot_l5"];
    expect(extraSlot.effect).toMatchObject({ type: "spellSlotBonus", amount: 1 });
    const empowered = PASSIVE_REGISTRY["passive.sorcerer.empowered_spell"];
    expect(empowered.effect).toMatchObject({ type: "empoweredSpell", usesPerCast: 1 });
    const wildSurge = PASSIVE_REGISTRY["passive.sorcerer.wild_magic_surge"];
    expect(wildSurge.effect).toMatchObject({ type: "wildMagicSurge", chance: 1 });
  });

  it("DataRepository.validate() passes with all Sorcerer content registered", () => {
    const report = repo.validate();
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });
});
