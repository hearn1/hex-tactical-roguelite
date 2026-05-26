import type { ActionDef } from "./actions.ts";
import { ACTION_REGISTRY } from "./actions.ts";
import type { ClassDef } from "./classes.ts";
import { CLASS_REGISTRY } from "./classes.ts";
import type { EnemyDef } from "./enemies.ts";
import { ENEMY_REGISTRY } from "./enemies.ts";
import type { EncounterDef } from "./encounters.ts";
import { ENCOUNTER_REGISTRY } from "./encounters.ts";
import type { EventDef } from "./events.ts";
import { EVENT_REGISTRY } from "./events.ts";
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

    for (const [id, def] of this.encounters) {
      for (const group of def.enemyGroups) {
        if (!allEnemyIds.has(group.enemyId)) {
          errors.push(`Encounter "${id}": enemy "${group.enemyId}" not found`);
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
    }

    for (const [id, def] of this.items) {
      if (def.grantedActionIds) {
        for (const aid of def.grantedActionIds) {
          if (!allActionIds.has(aid)) {
            errors.push(`Item "${id}": granted action "${aid}" not found`);
          }
        }
      }
    }

    for (const [id, def] of this.upgrades) {
      if (def.effect.type === "startingItem") {
        if (def.effect.itemId && !allItemIds.has(def.effect.itemId)) {
          errors.push(`Upgrade "${id}": item "${def.effect.itemId}" not found`);
        }
      }
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
