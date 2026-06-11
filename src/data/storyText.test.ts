import { describe, it, expect } from "vitest";
import {
  STORY_TEXT_REGISTRY,
  DEFAULT_CAMPAIGN_REQUIRED_HOOKS,
  lookupStoryText,
  missingStoryText,
  getCampaignStartHookId,
  getCampaignEndHookId,
  getActIntroHookId,
  getActOutroHookId,
  getBossIntroHookId,
  getBossOutroHookId,
} from "./storyText.ts";

// ---------------------------------------------------------------------------
// Story hook lookup
// ---------------------------------------------------------------------------

describe("lookupStoryText", () => {
  it("returns non-empty text for a registered hook", () => {
    const text = lookupStoryText("act_1.intro");
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain("Missing text");
  });

  it("returns fallback text for an unregistered hook", () => {
    const hookId = "act_99.unknown_beat";
    const text = lookupStoryText(hookId);
    expect(text).toBe(`Missing text for story hook ${hookId}`);
  });

  it("fallback text contains the missing hook id", () => {
    const hookId = "campaign.unknown.start";
    expect(lookupStoryText(hookId)).toContain(hookId);
  });
});

describe("missingStoryText", () => {
  it("includes the hook id in the output", () => {
    expect(missingStoryText("some.hook")).toBe("Missing text for story hook some.hook");
  });
});

// ---------------------------------------------------------------------------
// Default campaign hook completeness
// ---------------------------------------------------------------------------

describe("DEFAULT_CAMPAIGN_REQUIRED_HOOKS", () => {
  it("covers all 4 acts with intro, outro, boss_intro, boss_outro", () => {
    for (const n of [1, 2, 3, 4]) {
      expect(DEFAULT_CAMPAIGN_REQUIRED_HOOKS).toContain(`act_${n}.intro`);
      expect(DEFAULT_CAMPAIGN_REQUIRED_HOOKS).toContain(`act_${n}.outro`);
      expect(DEFAULT_CAMPAIGN_REQUIRED_HOOKS).toContain(`act_${n}.boss_intro`);
      expect(DEFAULT_CAMPAIGN_REQUIRED_HOOKS).toContain(`act_${n}.boss_outro`);
    }
  });

  it("includes campaign start and end hooks", () => {
    expect(DEFAULT_CAMPAIGN_REQUIRED_HOOKS).toContain("campaign.verdant_dark.start");
    expect(DEFAULT_CAMPAIGN_REQUIRED_HOOKS).toContain("campaign.verdant_dark.end");
  });

  it("every required hook resolves to non-fallback text", () => {
    for (const hookId of DEFAULT_CAMPAIGN_REQUIRED_HOOKS) {
      const text = lookupStoryText(hookId);
      expect(text, `Hook "${hookId}" returned fallback text`).not.toContain("Missing text");
      expect(text.length, `Hook "${hookId}" has empty text`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Hook ID helper functions
// ---------------------------------------------------------------------------

describe("hook ID helpers", () => {
  it("getCampaignStartHookId appends .start", () => {
    expect(getCampaignStartHookId("campaign.verdant_dark")).toBe("campaign.verdant_dark.start");
  });

  it("getCampaignEndHookId appends .end", () => {
    expect(getCampaignEndHookId("campaign.verdant_dark")).toBe("campaign.verdant_dark.end");
  });

  it("getActIntroHookId returns act_N.intro", () => {
    expect(getActIntroHookId(1)).toBe("act_1.intro");
    expect(getActIntroHookId(4)).toBe("act_4.intro");
  });

  it("getActOutroHookId returns act_N.outro", () => {
    expect(getActOutroHookId(2)).toBe("act_2.outro");
  });

  it("getBossIntroHookId returns act_N.boss_intro", () => {
    expect(getBossIntroHookId(3)).toBe("act_3.boss_intro");
  });

  it("getBossOutroHookId returns act_N.boss_outro", () => {
    expect(getBossOutroHookId(4)).toBe("act_4.boss_outro");
  });
});

// ---------------------------------------------------------------------------
// STORY_TEXT_REGISTRY structure
// ---------------------------------------------------------------------------

describe("STORY_TEXT_REGISTRY", () => {
  it("every entry has an id matching its key", () => {
    for (const [key, hook] of Object.entries(STORY_TEXT_REGISTRY)) {
      expect(hook.id, `Registry key "${key}" id mismatch`).toBe(key);
    }
  });

  it("every entry has non-empty text", () => {
    for (const [key, hook] of Object.entries(STORY_TEXT_REGISTRY)) {
      expect(hook.text.length, `Hook "${key}" has empty text`).toBeGreaterThan(0);
    }
  });

  it("flags field, when present, is a plain object with string values", () => {
    for (const [key, hook] of Object.entries(STORY_TEXT_REGISTRY)) {
      if (hook.flags !== undefined) {
        expect(typeof hook.flags, `Hook "${key}" flags is not an object`).toBe("object");
        for (const [flagKey, flagVal] of Object.entries(hook.flags)) {
          expect(typeof flagVal, `Hook "${key}" flag "${flagKey}" value is not a string`).toBe("string");
        }
      }
    }
  });

  it("contains entries for all 4 acts", () => {
    for (const n of [1, 2, 3, 4]) {
      expect(STORY_TEXT_REGISTRY[`act_${n}.intro`]).toBeDefined();
      expect(STORY_TEXT_REGISTRY[`act_${n}.boss_intro`]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Story text independence from act design notes
// ---------------------------------------------------------------------------

describe("story text is independent from ActStoryBeat descriptions", () => {
  it("act intro display text differs from the design-note description in campaigns.ts", async () => {
    const { STORY_BEAT_REGISTRY } = await import("./campaigns.ts");
    const designNote = STORY_BEAT_REGISTRY["act_1.intro"]?.description ?? "";
    const displayText = lookupStoryText("act_1.intro");
    // Display text is the player-facing prose, not a copy of the internal design note.
    expect(displayText).not.toBe(designNote);
  });
});
