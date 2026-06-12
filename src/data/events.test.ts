import { describe, it, expect } from "vitest";
import {
  EVENT_REGISTRY,
  EVENT_PACK_IDS,
  EVENT_POOLS,
  DEFAULT_EVENT_POOL_ID,
  type EventTag,
} from "./events.ts";
import { ITEM_REGISTRY } from "./items.ts";
import { POTION_REGISTRY } from "./potions.ts";

const VALID_TAGS: EventTag[] = ["risk", "social", "treasure", "heal", "train", "moral"];

describe("event content pack (F25 / #56)", () => {
  it("ships exactly 10 authored pack events, all present in the registry", () => {
    expect(EVENT_PACK_IDS).toHaveLength(10);
    for (const id of EVENT_PACK_IDS) {
      expect(EVENT_REGISTRY[id], `${id} missing`).toBeDefined();
      expect(EVENT_REGISTRY[id].id).toBe(id);
    }
  });

  it("gives every pack event a title and at least two meaningful choices", () => {
    for (const id of EVENT_PACK_IDS) {
      const def = EVENT_REGISTRY[id];
      expect(def.title.length, `${id} title`).toBeGreaterThan(0);
      expect(def.choices.length, `${id} choices`).toBeGreaterThanOrEqual(2);
      for (const choice of def.choices) {
        expect(choice.effects.length, `${choice.id} effects`).toBeGreaterThan(0);
        expect(choice.label.length, `${choice.id} label`).toBeGreaterThan(0);
      }
    }
  });

  it("tags every pack event using only the approved vocabulary", () => {
    for (const id of EVENT_PACK_IDS) {
      const tags = EVENT_REGISTRY[id].tags ?? [];
      expect(tags.length, `${id} should be tagged`).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(VALID_TAGS).toContain(tag);
      }
    }
  });

  it("uses every tag in the vocabulary at least once across the pack", () => {
    const used = new Set<EventTag>();
    for (const id of EVENT_PACK_IDS) {
      for (const tag of EVENT_REGISTRY[id].tags ?? []) used.add(tag);
    }
    for (const tag of VALID_TAGS) {
      expect(used.has(tag), `tag "${tag}" unused`).toBe(true);
    }
  });

  it("ships no repeatable events by default (no-repeat within a run)", () => {
    for (const id of EVENT_PACK_IDS) {
      expect(EVENT_REGISTRY[id].repeatable ?? false).toBe(false);
    }
  });

  it("includes the whole pack in the default shared pool", () => {
    const pool = EVENT_POOLS[DEFAULT_EVENT_POOL_ID];
    for (const id of EVENT_PACK_IDS) {
      expect(pool).toContain(id);
    }
  });

  // Resolves item/potion references locally too (DataRepository.validate covers this end-to-end).
  const collectRefs = (effects: ReturnType<() => typeof EVENT_REGISTRY[string]["choices"][number]["effects"]>) => {
    const items: string[] = [];
    const potions: string[] = [];
    const walk = (list: typeof effects): void => {
      for (const e of list) {
        if (e.type === "item") items.push(e.itemId);
        else if (e.type === "potion") potions.push(e.potionId);
        else if (e.type === "check") {
          walk(e.onSuccess);
          walk(e.onFailure);
          if (e.onPartial) walk(e.onPartial);
        }
      }
    };
    walk(effects);
    return { items, potions };
  };

  it("references only existing items and potions (including nested check branches)", () => {
    for (const id of EVENT_PACK_IDS) {
      for (const choice of EVENT_REGISTRY[id].choices) {
        const { items, potions } = collectRefs(choice.effects);
        for (const itemId of items) {
          expect(ITEM_REGISTRY[itemId], `${choice.id}: ${itemId}`).toBeDefined();
        }
        for (const potionId of potions) {
          expect(POTION_REGISTRY[potionId], `${choice.id}: ${potionId}`).toBeDefined();
        }
      }
    }
  });
});

describe("cross-act goblin relic echo event (#402)", () => {
  const EVENT_ID = "event.sq.act1.goblin_relic.echo";

  it("is registered in EVENT_REGISTRY", () => {
    expect(EVENT_REGISTRY[EVENT_ID]).toBeDefined();
    expect(EVENT_REGISTRY[EVENT_ID].id).toBe(EVENT_ID);
  });

  it("claim choice requires flag.sq.act1.goblin_relic.completed", () => {
    const claimChoice = EVENT_REGISTRY[EVENT_ID].choices.find(
      (c) => c.id === "event.sq.act1.goblin_relic.echo.claim",
    );
    expect(claimChoice).toBeDefined();
    const flagReq = claimChoice!.requirements?.find((r) => r.type === "hasFlag");
    expect(flagReq).toBeDefined();
    expect((flagReq as { type: "hasFlag"; flagId: string }).flagId).toBe(
      "flag.sq.act1.goblin_relic.completed",
    );
  });

  it("claim choice awards item.goblin_relic_shard and a log_entry", () => {
    const claimChoice = EVENT_REGISTRY[EVENT_ID].choices.find(
      (c) => c.id === "event.sq.act1.goblin_relic.echo.claim",
    );
    expect(claimChoice!.effects.some((e) => e.type === "item" && (e as { type: "item"; itemId: string }).itemId === "item.goblin_relic_shard")).toBe(true);
    expect(claimChoice!.effects.some((e) => e.type === "log_entry")).toBe(true);
  });

  it("item.goblin_relic_shard exists in ITEM_REGISTRY", () => {
    expect(ITEM_REGISTRY["item.goblin_relic_shard"]).toBeDefined();
    expect(ITEM_REGISTRY["item.goblin_relic_shard"].rarity).toBe("rare");
  });
});
