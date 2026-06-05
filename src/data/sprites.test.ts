import { describe, expect, it } from "vitest";
import { CLASS_REGISTRY } from "./classes.ts";
import { ENEMY_REGISTRY } from "./enemies.ts";
import { SPRITE_REGISTRY, spriteSheetSize, type SpriteDef } from "./sprites.ts";

function expectSpriteHasRequiredFrames(sprite: SpriteDef): void {
  expect(sprite.frameW).toBe(32);
  expect(sprite.frameH).toBe(32);
  expect(sprite.frames.idle).toBeDefined();
  expect(sprite.frames.attack).toBeDefined();

  const sheet = spriteSheetSize(sprite);
  for (const frame of Object.values(sprite.frames)) {
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.y).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.w).toBeLessThanOrEqual(sheet.width);
    expect(frame.y + frame.h).toBeLessThanOrEqual(sheet.height);
  }
}

describe("sprite registry", () => {
  it("covers every playable class with 32x32 idle and attack frames", () => {
    for (const classId of Object.keys(CLASS_REGISTRY)) {
      expect(SPRITE_REGISTRY[classId], classId).toBeDefined();
      expectSpriteHasRequiredFrames(SPRITE_REGISTRY[classId]);
    }
  });

  it("covers the boss and at least three enemies", () => {
    const enemySpriteIds = Object.keys(ENEMY_REGISTRY).filter((enemyId) => SPRITE_REGISTRY[enemyId]);

    expect(enemySpriteIds.length).toBeGreaterThanOrEqual(3);
    expect(SPRITE_REGISTRY["enemy.ogre_hexbreaker"]).toBeDefined();

    for (const enemyId of enemySpriteIds) {
      expectSpriteHasRequiredFrames(SPRITE_REGISTRY[enemyId]);
    }
  });
});
