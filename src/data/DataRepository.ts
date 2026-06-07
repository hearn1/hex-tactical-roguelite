import type { ActionDef } from "./actions.ts";
import { ACTION_REGISTRY } from "./actions.ts";
import type { BackgroundDef } from "./backgrounds.ts";
import { BACKGROUND_REGISTRY } from "./backgrounds.ts";
import type { ClassDef } from "./classes.ts";
import { CLASS_REGISTRY } from "./classes.ts";
import type { EnemyDef } from "./enemies.ts";
import { ENEMY_REGISTRY } from "./enemies.ts";
import type { EncounterDef } from "./encounters.ts";
import { ENCOUNTER_REGISTRY, ENCOUNTER_POOLS } from "./encounters.ts";
import { hexesWithinRange, hexKey } from "../core/hex.ts";
import type { EventDef, EventEffect } from "./events.ts";
import { EVENT_REGISTRY, EVENT_POOLS } from "./events.ts";
import { ABILITY_KEYS } from "./abilities.ts";
import type { ItemDef } from "./items.ts";
import { ITEM_REGISTRY } from "./items.ts";
import type { NodeDef } from "./nodes.ts";
import { NODE_REGISTRY } from "./nodes.ts";
import type { PotionDef } from "./potions.ts";
import { POTION_REGISTRY } from "./potions.ts";
import type { RewardPoolDef } from "./rewards.ts";
import { REWARD_REGISTRY } from "./rewards.ts";
import type { UpgradeDef } from "./upgrades.ts";
import { UPGRADE_REGISTRY } from "./upgrades.ts";
import type { LevelUpOption } from "./levelups.ts";
import {
  LEVELUP_CHOICES,
  SHARED_FALLBACK_CHOICES,
  LEVELUP_PASSIVE_START_COMBAT_GUARDED,
  LEVELUP_PASSIVE_FIRST_HEAL_BONUS,
} from "./levelups.ts";
import { ENVIRONMENT_THEMES, getNodeTypeThemeMap } from "./environmentThemes.ts";

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class DataRepository {
  private classes: Map<string, ClassDef>;
  private actions: Map<string, ActionDef>;
  private items: Map<string, ItemDef>;
  private potions: Map<string, PotionDef>;
  private enemies: Map<string, EnemyDef>;
  private encounters: Map<string, EncounterDef>;
  private nodes: Map<string, NodeDef>;
  private upgrades: Map<string, UpgradeDef>;
  private events: Map<string, EventDef>;
  private rewards: Map<string, RewardPoolDef>;
  private backgrounds: Map<string, BackgroundDef>;
  private loaded: boolean;

  constructor() {
    this.classes = new Map();
    this.actions = new Map();
    this.items = new Map();
    this.potions = new Map();
    this.enemies = new Map();
    this.encounters = new Map();
    this.nodes = new Map();
    this.upgrades = new Map();
    this.events = new Map();
    this.rewards = new Map();
    this.backgrounds = new Map();
    this.loaded = false;
  }

  loadAll(): void {
    this.loadActions();
    this.loadItems();
    this.loadPotions();
    this.loadClasses();
    this.loadEnemies();
    this.loadEncounters();
    this.loadEvents();
    this.loadRewards();
    this.loadNodes();
    this.loadUpgrades();
    this.loadBackgrounds();
    this.loaded = true;
  }

  private loadMap<T extends { id: string }>(registry: Record<string, T>): Map<string, T> {
    const map = new Map<string, T>();
    for (const key of Object.keys(registry)) {
      map.set(key, registry[key]);
    }
    return map;
  }

  private loadActions(): void {
    this.actions = this.loadMap(ACTION_REGISTRY);
  }

  private loadItems(): void {
    this.items = this.loadMap(ITEM_REGISTRY);
  }

  private loadPotions(): void {
    this.potions = this.loadMap(POTION_REGISTRY);
  }

  private loadClasses(): void {
    this.classes = this.loadMap(CLASS_REGISTRY);
  }

  private loadEnemies(): void {
    this.enemies = this.loadMap(ENEMY_REGISTRY);
  }

  private loadEncounters(): void {
    this.encounters = this.loadMap(ENCOUNTER_REGISTRY);
  }

  private loadEvents(): void {
    this.events = this.loadMap(EVENT_REGISTRY);
  }

  private loadRewards(): void {
    this.rewards = this.loadMap(REWARD_REGISTRY);
  }

  private loadNodes(): void {
    this.nodes = this.loadMap(NODE_REGISTRY);
  }

  private loadUpgrades(): void {
    this.upgrades = this.loadMap(UPGRADE_REGISTRY);
  }

  private loadBackgrounds(): void {
    this.backgrounds = this.loadMap(BACKGROUND_REGISTRY);
  }

  getClass(id: string): ClassDef | undefined {
    return this.classes.get(id);
  }

  getAction(id: string): ActionDef | undefined {
    return this.actions.get(id);
  }

  getItem(id: string): ItemDef | undefined {
    return this.items.get(id);
  }

  getPotion(id: string): PotionDef | undefined {
    return this.potions.get(id);
  }

  getEnemy(id: string): EnemyDef | undefined {
    return this.enemies.get(id);
  }

  getEncounter(id: string): EncounterDef | undefined {
    return this.encounters.get(id);
  }

  getNode(id: string): NodeDef | undefined {
    return this.nodes.get(id);
  }

  getUpgrade(id: string): UpgradeDef | undefined {
    return this.upgrades.get(id);
  }

  getEvent(id: string): EventDef | undefined {
    return this.events.get(id);
  }

  getReward(id: string): RewardPoolDef | undefined {
    return this.rewards.get(id);
  }

  getBackground(id: string): BackgroundDef | undefined {
    return this.backgrounds.get(id);
  }

  getAllBackgrounds(): BackgroundDef[] {
    return Array.from(this.backgrounds.values());
  }

  getAllEncounters(): EncounterDef[] {
    return Array.from(this.encounters.values());
  }

  getAllNodes(): NodeDef[] {
    return Array.from(this.nodes.values());
  }

  getAllUpgrades(): UpgradeDef[] {
    return Array.from(this.upgrades.values());
  }

  getAllEvents(): EventDef[] {
    return Array.from(this.events.values());
  }

  getAllActions(): ActionDef[] {
    return Array.from(this.actions.values());
  }

  getAllItems(): ItemDef[] {
    return Array.from(this.items.values());
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  validate(): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.loaded) {
      return { valid: false, errors: ["DataRepository not loaded"], warnings: [] };
    }

    const allActionIds = new Set(this.actions.keys());
    const allItemIds = new Set(this.items.keys());
    const allEnemyIds = new Set(this.enemies.keys());
    const allEncounterIds = new Set(this.encounters.keys());
    const allNodeIds = new Set(this.nodes.keys());
    const allRewardIds = new Set(this.rewards.keys());
    const allEventIds = new Set(this.events.keys());
    const allPotionIds = new Set(this.potions.keys());
    const allBackgroundIds = new Set(this.backgrounds.keys());
    const checkStats = new Set(["might", "agility", "spirit"]);
    const abilityKeys = new Set<string>(ABILITY_KEYS);
    const statKeys = new Set(["maxHp", "armor", "move", "might", "agility", "spirit"]);
    const eventTags = new Set(["risk", "social", "treasure", "heal", "train", "moral"]);
    const environmentThemeIds = new Set(Object.keys(ENVIRONMENT_THEMES));

    if (environmentThemeIds.size < 2) {
      errors.push("Environment themes: must define at least 2 themes");
    }
    for (const [id, theme] of Object.entries(ENVIRONMENT_THEMES)) {
      if (!theme.ground.baseColor || !theme.ground.tileColor || !theme.ground.pattern) {
        errors.push(`Environment theme "${id}": ground treatment is incomplete`);
      }
      if (!theme.sky.topColor || !theme.sky.horizonColor || !theme.sky.bottomColor) {
        errors.push(`Environment theme "${id}": sky treatment is incomplete`);
      }
    }
    for (const [nodeType, themeId] of Object.entries(getNodeTypeThemeMap())) {
      if (!environmentThemeIds.has(themeId)) {
        errors.push(`Node type "${nodeType}": environment theme "${themeId}" not found`);
      }
    }

    for (const [id, def] of this.classes) {
      for (const aid of def.actionIds) {
        if (!allActionIds.has(aid)) {
          errors.push(`Class "${id}": action "${aid}" not found`);
        }
      }
      for (const iid of def.startingItems) {
        if (!allItemIds.has(iid)) {
          errors.push(`Class "${id}": starting item "${iid}" not found`);
        }
      }
      if (def.defaultBackgroundId && !allBackgroundIds.has(def.defaultBackgroundId)) {
        errors.push(`Class "${id}": default background "${def.defaultBackgroundId}" not found`);
      }
      if (![6, 8, 10, 12].includes(def.hitDieSize)) errors.push(`Class "${id}": hitDieSize must be a standard die`);
      const stats = def.baseStats;
      if (stats.maxHp <= 0) errors.push(`Class "${id}": maxHp must be > 0`);
      if (stats.armor < 0) errors.push(`Class "${id}": armor must be >= 0`);
      if (stats.move < 0 || stats.move > 10) errors.push(`Class "${id}": move out of range 0-10`);
      if (stats.might < 0 || stats.might > 10) errors.push(`Class "${id}": might out of range 0-10`);
      if (stats.agility < 0 || stats.agility > 10) errors.push(`Class "${id}": agility out of range 0-10`);
      if (stats.spirit < 0 || stats.spirit > 10) errors.push(`Class "${id}": spirit out of range 0-10`);
    }

    for (const [id, def] of this.enemies) {
      for (const aid of def.actionIds) {
        if (!allActionIds.has(aid)) {
          errors.push(`Enemy "${id}": action "${aid}" not found`);
        }
      }
      const stats = def.baseStats;
      if (stats.maxHp <= 0) errors.push(`Enemy "${id}": maxHp must be > 0`);
      if (stats.armor < 0) errors.push(`Enemy "${id}": armor must be >= 0`);
      if (stats.move < 0 || stats.move > 10) errors.push(`Enemy "${id}": move out of range 0-10`);
      if (stats.might < 0 || stats.might > 10) errors.push(`Enemy "${id}": might out of range 0-10`);
      if (stats.agility < 0 || stats.agility > 10) errors.push(`Enemy "${id}": agility out of range 0-10`);
      if (stats.spirit < 0 || stats.spirit > 10) errors.push(`Enemy "${id}": spirit out of range 0-10`);
    }

    // Combat grid is a radius-3 hex disc; enemies must spawn on it without overlapping.
    const MAX_ENEMIES_PER_ENCOUNTER = 5;
    const gridCells = new Set(hexesWithinRange({ q: 0, r: 0 }, 3).map(hexKey));

    for (const [id, def] of this.encounters) {
      let totalEnemies = 0;
      for (const group of def.enemyGroups) {
        if (!allEnemyIds.has(group.enemyId)) {
          errors.push(`Encounter "${id}": enemy "${group.enemyId}" not found`);
        }
        if (group.count <= 0) {
          errors.push(`Encounter "${id}": enemy "${group.enemyId}" count must be > 0`);
        }
        totalEnemies += group.count;
      }
      if (totalEnemies > MAX_ENEMIES_PER_ENCOUNTER) {
        errors.push(
          `Encounter "${id}": ${totalEnemies} enemies exceeds cap of ${MAX_ENEMIES_PER_ENCOUNTER}`,
        );
      }
      if (def.rewardPoolId && !allRewardIds.has(def.rewardPoolId)) {
        errors.push(`Encounter "${id}": reward pool "${def.rewardPoolId}" not found`);
      }
      if (def.positions) {
        if (def.positions.length !== totalEnemies) {
          errors.push(
            `Encounter "${id}": ${def.positions.length} positions but ${totalEnemies} enemies`,
          );
        }
        const seen = new Set<string>();
        for (const pos of def.positions) {
          const key = hexKey(pos);
          if (!gridCells.has(key)) {
            errors.push(`Encounter "${id}": position (${pos.q}, ${pos.r}) is outside the grid`);
          }
          if (seen.has(key)) {
            errors.push(`Encounter "${id}": position (${pos.q}, ${pos.r}) is used twice`);
          }
          seen.add(key);
        }
      }
    }

    for (const [poolId, encounterIds] of Object.entries(ENCOUNTER_POOLS)) {
      if (encounterIds.length === 0) {
        errors.push(`Encounter pool "${poolId}": must contain at least one encounter`);
      }
      for (const eid of encounterIds) {
        if (!allEncounterIds.has(eid)) {
          errors.push(`Encounter pool "${poolId}": encounter "${eid}" not found`);
        }
      }
    }

    for (const [id, def] of this.nodes) {
      for (const nid of def.nextNodeIds) {
        if (!allNodeIds.has(nid)) {
          errors.push(`Node "${id}": next node "${nid}" not found`);
        }
      }
      if (def.encounterId && !allEncounterIds.has(def.encounterId)) {
        errors.push(`Node "${id}": encounter "${def.encounterId}" not found`);
      }
      if (def.encounterPoolId && !ENCOUNTER_POOLS[def.encounterPoolId]) {
        errors.push(`Node "${id}": encounter pool "${def.encounterPoolId}" not found`);
      }
      if (
        (def.type === "combat" || def.type === "elite" || def.type === "boss") &&
        !def.encounterId &&
        !def.encounterPoolId
      ) {
        errors.push(`Node "${id}": ${def.type} node must declare an encounterId or encounterPoolId`);
      }
      if (def.eventId && !allEventIds.has(def.eventId)) {
        errors.push(`Node "${id}": event "${def.eventId}" not found`);
      }
      if (def.eventPoolId && !EVENT_POOLS[def.eventPoolId]) {
        errors.push(`Node "${id}": event pool "${def.eventPoolId}" not found`);
      }
    }

    const validConditionIds = new Set(["guarded", "weakened", "blessed", "slowed", "rallied"]);

    for (const [id, def] of this.items) {
      if (def.grantedActionIds) {
        for (const aid of def.grantedActionIds) {
          if (!allActionIds.has(aid)) {
            errors.push(`Item "${id}": granted action "${aid}" not found`);
          }
        }
      }
      if (def.requiresAttunement !== undefined && typeof def.requiresAttunement !== "boolean") {
        errors.push(`Item "${id}": requiresAttunement must be a boolean`);
      }
      if (def.hook) {
        if (def.hook.type === "oncePerCombatBonus" && def.hook.effect.kind === "applyCondition") {
          if (!validConditionIds.has(def.hook.effect.conditionId)) {
            errors.push(`Item "${id}": hook references unknown condition "${def.hook.effect.conditionId}"`);
          }
        }
        if (def.requiresAttunement !== true) {
          warnings.push(`Item "${id}": hook item should usually require attunement.`);
        }
      }
      if (def.rarity === "common" && def.requiresAttunement === true) {
        warnings.push(`Item "${id}": common item requires attunement.`);
      }
    }

    for (const [id, def] of this.upgrades) {
      if (def.effect.type === "startingItem") {
        if (def.effect.itemId && !allItemIds.has(def.effect.itemId)) {
          errors.push(`Upgrade "${id}": item "${def.effect.itemId}" not found`);
        }
      }
    }

    for (const [id, def] of this.backgrounds) {
      if (!statKeys.has(def.statBonus.stat)) {
        errors.push(`Background "${id}": stat "${def.statBonus.stat}" is not a valid stat`);
      }
      if (def.startingItemId && !allItemIds.has(def.startingItemId)) {
        errors.push(`Background "${id}": item "${def.startingItemId}" not found`);
      }
      if (def.startingPotionId && !allPotionIds.has(def.startingPotionId)) {
        errors.push(`Background "${id}": potion "${def.startingPotionId}" not found`);
      }
      if (def.startingPotionCount !== undefined && def.startingPotionCount <= 0) {
        errors.push(`Background "${id}": startingPotionCount must be > 0`);
      }
      if (def.perk.type === "xpMultiplier" && def.perk.value <= 0) {
        errors.push(`Background "${id}": XP multiplier must be > 0`);
      }
      if (def.perk.type === "revealNodes" && def.perk.count <= 0) {
        errors.push(`Background "${id}": reveal count must be > 0`);
      }
      if (def.perk.type === "bonusGold" && def.perk.amount < 0) {
        errors.push(`Background "${id}": bonus gold must be >= 0`);
      }
      if (def.perk.type === "shopDiscount" && (def.perk.value < 0 || def.perk.value >= 1)) {
        errors.push(`Background "${id}": shop discount must be between 0 and 1`);
      }
    }

    const validateEventEffect = (effect: EventEffect, where: string): void => {
      if (effect.type === "item" && !allItemIds.has(effect.itemId)) {
        errors.push(`${where}: item "${effect.itemId}" not found`);
      } else if (effect.type === "potion" && !allPotionIds.has(effect.potionId)) {
        errors.push(`${where}: potion "${effect.potionId}" not found`);
      } else if (effect.type === "stat_boost" && !checkStats.has(effect.stat)) {
        errors.push(`${where}: stat "${effect.stat}" is not a valid check stat`);
      } else if (effect.type === "check") {
        if (effect.check.dc <= 0) errors.push(`${where}: check DC must be > 0`);
        if (!abilityKeys.has(effect.check.stat)) {
          errors.push(`${where}: check stat "${effect.check.stat}" is not a valid ability`);
        }
        for (const e of effect.onSuccess) validateEventEffect(e, `${where} (onSuccess)`);
        for (const e of effect.onFailure) validateEventEffect(e, `${where} (onFailure)`);
        for (const e of effect.onPartial ?? []) validateEventEffect(e, `${where} (onPartial)`);
      } else if (effect.type === "buff" && effect.modifier.kind === "global_stat" && !statKeys.has(effect.modifier.stat)) {
        errors.push(`${where}: buff stat "${effect.modifier.stat}" is not a valid stat`);
      }
    };

    for (const [id, def] of this.events) {
      if (def.choices.length < 2) {
        errors.push(`Event "${id}": must offer at least 2 choices`);
      }
      for (const tag of def.tags ?? []) {
        if (!eventTags.has(tag)) {
          errors.push(`Event "${id}": unknown tag "${tag}"`);
        }
      }
      for (const choice of def.choices) {
        const where = `Event "${id}" choice "${choice.id}"`;
        for (const effect of choice.effects) {
          validateEventEffect(effect, where);
        }
        for (const req of choice.requirements ?? []) {
          if (req.type === "hasItem" && !allItemIds.has(req.itemId)) {
            errors.push(`${where}: required item "${req.itemId}" not found`);
          }
        }
      }
    }

    for (const [poolId, eventIds] of Object.entries(EVENT_POOLS)) {
      for (const eid of eventIds) {
        if (!allEventIds.has(eid)) {
          errors.push(`Event pool "${poolId}": event "${eid}" not found`);
        }
      }
    }

    // Level-up choices (F29): action upgrades must reference real actions; passives must be known.
    const knownPassives = new Set([
      LEVELUP_PASSIVE_START_COMBAT_GUARDED,
      LEVELUP_PASSIVE_FIRST_HEAL_BONUS,
    ]);
    const validateLevelUpOption = (option: LevelUpOption, where: string): void => {
      const upgrade = option.upgrade;
      if (upgrade.kind === "action") {
        if (upgrade.actionIds.length === 0) {
          errors.push(`${where}: action upgrade lists no actions`);
        }
        for (const aid of upgrade.actionIds) {
          if (!allActionIds.has(aid)) {
            errors.push(`${where}: action "${aid}" not found`);
          }
        }
      } else if (upgrade.kind === "passive" && !knownPassives.has(upgrade.passiveId)) {
        errors.push(`${where}: unknown passive "${upgrade.passiveId}"`);
      } else if (upgrade.kind === "stat") {
        for (const key of Object.keys(upgrade.stats)) {
          if (!statKeys.has(key)) errors.push(`${where}: invalid stat "${key}"`);
        }
      }
    };
    for (const [classId, byLevel] of Object.entries(LEVELUP_CHOICES)) {
      if (!this.classes.has(classId)) {
        errors.push(`Level-up table "${classId}": class not found`);
      }
      for (const [level, options] of Object.entries(byLevel)) {
        if (options.length < 2) {
          errors.push(`Level-up table "${classId}" level ${level}: must offer at least 2 options`);
        }
        for (const option of options) {
          validateLevelUpOption(option, `Level-up "${classId}" L${level} option "${option.id}"`);
        }
      }
    }
    for (const option of SHARED_FALLBACK_CHOICES) {
      validateLevelUpOption(option, `Level-up shared fallback option "${option.id}"`);
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    return { valid: true, errors, warnings };
  }
}

let _instance: DataRepository | null = null;

export function getDataRepository(): DataRepository {
  if (!_instance) {
    _instance = new DataRepository();
    _instance.loadAll();
    const report = _instance.validate();
    if (!report.valid) {
      console.warn("DataRepository validation errors:", report.errors);
    }
  }
  return _instance;
}
