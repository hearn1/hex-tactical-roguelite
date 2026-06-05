import * as THREE from "three";
import { hexKey, parseHexKey } from "../../core/hex.ts";
import type { CombatState, Hex, UnitInstance } from "../../state/types.ts";
import { getSpriteDef, type SpriteDef, type SpriteFrameId } from "../../data/sprites.ts";
import { axialToWorld, HEX_WORLD_RADIUS } from "./hexWorld.ts";
import { hexFromPickData } from "./picking.ts";

export interface Combat3DHighlights {
  hoveredHex: Hex | null;
  reachableKeys: Set<string>;
  targetKeys: Set<string>;
  telegraphKeys: Set<string>;
}

export interface CombatThreeRendererOptions {
  onPickHex: (hex: Hex) => void;
  onHoverHex: (hex: Hex | null) => void;
}

type UnitGroup = THREE.Group & {
  userData: {
    unitId: string;
    sprite: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    hpFill: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    activeRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  };
};

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 480;
const BASE_TILE_COLOR = new THREE.Color("#27344d");
const BASE_TILE_EMISSIVE = new THREE.Color("#02050a");
const REACHABLE_COLOR = new THREE.Color("#257d4b");
const TARGET_COLOR = new THREE.Color("#9d3434");
const TELEGRAPH_COLOR = new THREE.Color("#c87922");
const HOVER_COLOR = new THREE.Color("#9b8d38");
const ACTIVE_COLOR = new THREE.Color("#ffd166");
const UNIT_WIDTH = 0.78;
const UNIT_HEIGHT = 0.9;

export class CombatThreeRenderer {
  private readonly container: HTMLElement;
  private readonly options: CombatThreeRendererOptions;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly tileMeshes = new Map<string, THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>>();
  private readonly unitGroups = new Map<string, UnitGroup>();
  private readonly textureCache = new Map<string, THREE.CanvasTexture>();
  private readonly tileGeometry = new THREE.CylinderGeometry(HEX_WORLD_RADIUS * 0.96, HEX_WORLD_RADIUS * 0.96, 0.08, 6);
  private readonly unitGeometry = new THREE.PlaneGeometry(UNIT_WIDTH, UNIT_HEIGHT);
  private readonly hpBackGeometry = new THREE.PlaneGeometry(0.7, 0.07);
  private readonly hpFillGeometry = new THREE.PlaneGeometry(0.7, 0.07);
  private readonly activeRingGeometry = new THREE.RingGeometry(0.45, 0.54, 40);
  private currentCombat: CombatState | null = null;
  private animationId: number | null = null;

  constructor(container: HTMLElement, options: CombatThreeRendererOptions) {
    assertWebGLAvailable();
    this.container = container;
    this.options = options;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#111827");
    this.camera = new THREE.OrthographicCamera(-5.7, 5.7, 4.25, -4.25, 0.1, 100);
    this.camera.position.set(5.2, 6.8, 7.4);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(VIEW_WIDTH, VIEW_HEIGHT, false);
    this.renderer.domElement.className = "combat-three-canvas";
    this.renderer.domElement.setAttribute("aria-label", "3D tactical combat view");
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "auto";
    this.renderer.domElement.style.display = "block";
    this.container.appendChild(this.renderer.domElement);

    this.addLights();
    this.bindPointerEvents();
    this.startLoop();
  }

  update(combat: CombatState, highlights: Combat3DHighlights): void {
    this.currentCombat = combat;
    this.syncTiles(combat, highlights);
    this.syncUnits(combat);
    this.renderFrame();
  }

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.tileGeometry.dispose();
    this.unitGeometry.dispose();
    this.hpBackGeometry.dispose();
    this.hpFillGeometry.dispose();
    this.activeRingGeometry.dispose();
    for (const texture of this.textureCache.values()) {
      texture.dispose();
    }
    this.renderer.dispose();
  }

  private addLights(): void {
    const ambient = new THREE.AmbientLight("#dbeafe", 1.2);
    const directional = new THREE.DirectionalLight("#ffffff", 1.4);
    directional.position.set(3, 8, 4);
    this.scene.add(ambient, directional);
  }

  private bindPointerEvents(): void {
    this.renderer.domElement.addEventListener("pointermove", (event) => {
      const hex = this.pickHex(event);
      this.options.onHoverHex(hex);
    });
    this.renderer.domElement.addEventListener("pointerleave", () => {
      this.options.onHoverHex(null);
    });
    this.renderer.domElement.addEventListener("click", (event) => {
      const hex = this.pickHex(event);
      if (hex) this.options.onPickHex(hex);
    });
  }

  private startLoop(): void {
    const loop = () => {
      if (!this.container.isConnected) {
        this.dispose();
        return;
      }
      this.renderFrame();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  private renderFrame(): void {
    for (const group of this.unitGroups.values()) {
      group.userData.sprite.quaternion.copy(this.camera.quaternion);
      group.userData.hpFill.quaternion.copy(this.camera.quaternion);
      const hpBack = group.children.find((child) => child.userData.kind === "hpBack");
      if (hpBack) hpBack.quaternion.copy(this.camera.quaternion);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private syncTiles(combat: CombatState, highlights: Combat3DHighlights): void {
    const liveKeys = new Set(combat.gridKeys);
    for (const [key, mesh] of this.tileMeshes) {
      if (liveKeys.has(key)) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.tileMeshes.delete(key);
    }

    for (const key of combat.gridKeys) {
      let mesh = this.tileMeshes.get(key);
      if (!mesh) {
        const material = new THREE.MeshStandardMaterial({
          color: BASE_TILE_COLOR.clone(),
          emissive: BASE_TILE_EMISSIVE.clone(),
          roughness: 0.9,
          metalness: 0,
        });
        mesh = new THREE.Mesh(this.tileGeometry.clone(), material);
        const hex = parseHexKey(key);
        const world = axialToWorld(hex);
        mesh.position.set(world.x, 0, world.z);
        mesh.rotation.y = Math.PI / 6;
        mesh.userData = { kind: "hex", hexKey: key };
        this.tileMeshes.set(key, mesh);
        this.scene.add(mesh);
      }

      const material = mesh.material;
      material.color.copy(BASE_TILE_COLOR);
      material.emissive.copy(BASE_TILE_EMISSIVE);

      if (highlights.reachableKeys.has(key)) {
        material.color.copy(REACHABLE_COLOR);
        material.emissive.set("#0b3d24");
      }
      if (highlights.targetKeys.has(key)) {
        material.color.copy(TARGET_COLOR);
        material.emissive.set("#4c1212");
      }
      if (highlights.telegraphKeys.has(key)) {
        material.color.copy(TELEGRAPH_COLOR);
        material.emissive.set("#55300a");
      }
      if (highlights.hoveredHex && hexKey(highlights.hoveredHex) === key) {
        material.color.copy(HOVER_COLOR);
        material.emissive.set("#3d3510");
      }
    }
  }

  private syncUnits(combat: CombatState): void {
    const activeId = combat.turnQueue[combat.activeIndex];
    const liveUnits = combat.units.filter((unit) => unit.hp > 0);
    const liveIds = new Set(liveUnits.map((unit) => unit.instanceId));

    for (const [unitId, group] of this.unitGroups) {
      if (liveIds.has(unitId)) continue;
      this.scene.remove(group);
      disposeGroupMaterials(group);
      this.unitGroups.delete(unitId);
    }

    for (const unit of liveUnits) {
      let group = this.unitGroups.get(unit.instanceId);
      if (!group) {
        group = this.createUnitGroup(unit);
        this.unitGroups.set(unit.instanceId, group);
        this.scene.add(group);
      }

      const world = axialToWorld(unit.pos);
      group.position.set(world.x, 0, world.z);
      group.userData.unitId = unit.instanceId;
      group.userData.sprite.userData.hexKey = hexKey(unit.pos);
      group.userData.sprite.userData.unitId = unit.instanceId;

      const sprite = getSpriteDef(unit.defId);
      const isAttackStance = unit.instanceId === activeId && combat.targetingActionId !== null && !unit.hasActed;
      group.userData.sprite.material.map = this.getTexture(sprite, isAttackStance ? "attack" : "idle");
      group.userData.sprite.material.needsUpdate = true;

      const spriteScale = sprite?.scale ?? 1;
      group.userData.sprite.scale.setScalar(spriteScale);
      const hpPct = Math.max(0, Math.min(1, unit.hp / unit.stats.maxHp));
      group.userData.hpFill.scale.x = hpPct;
      group.userData.hpFill.position.x = -0.35 * (1 - hpPct);
      group.userData.hpFill.material.color.set(hpPct > 0.5 ? "#54d17a" : "#d65a5a");
      group.userData.activeRing.visible = unit.instanceId === activeId;
      group.userData.activeRing.material.color.copy(ACTIVE_COLOR);
    }
  }

  private createUnitGroup(unit: UnitInstance): UnitGroup {
    const group = new THREE.Group() as UnitGroup;
    const texture = this.getTexture(getSpriteDef(unit.defId), "idle");
    const spriteMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide,
    });
    const sprite = new THREE.Mesh(this.unitGeometry, spriteMaterial);
    sprite.position.set(0, 0.72, 0);
    sprite.userData = { kind: "unit", unitId: unit.instanceId, hexKey: hexKey(unit.pos), billboard: true };

    const hpBack = new THREE.Mesh(
      this.hpBackGeometry,
      new THREE.MeshBasicMaterial({ color: "#111827", transparent: true, opacity: 0.95 }),
    );
    hpBack.position.set(0, 1.25, 0);
    hpBack.userData = { kind: "hpBack", billboard: true };

    const hpFill = new THREE.Mesh(
      this.hpFillGeometry,
      new THREE.MeshBasicMaterial({ color: "#54d17a", transparent: true, opacity: 0.95 }),
    );
    hpFill.position.set(0, 1.251, 0.002);
    hpFill.userData = { kind: "hpFill", billboard: true };

    const activeRing = new THREE.Mesh(
      this.activeRingGeometry,
      new THREE.MeshBasicMaterial({ color: ACTIVE_COLOR, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    activeRing.rotation.x = -Math.PI / 2;
    activeRing.position.y = 0.075;

    group.add(sprite, hpBack, hpFill, activeRing);
    group.userData = {
      unitId: unit.instanceId,
      sprite,
      hpFill,
      activeRing,
    };
    return group;
  }

  private getTexture(sprite: SpriteDef | null, frameId: SpriteFrameId): THREE.CanvasTexture {
    const cacheKey = `${sprite?.id ?? "fallback"}:${frameId}`;
    const cached = this.textureCache.get(cacheKey);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create sprite canvas.");
    drawPlaceholderSprite(ctx, sprite, frameId);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  private pickHex(event: PointerEvent): Hex | null {
    const combat = this.currentCombat;
    if (!combat) return null;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const unitMeshes = Array.from(this.unitGroups.values()).map((group) => group.userData.sprite);
    const unitIntersections = this.raycaster.intersectObjects(unitMeshes, false);
    const unitHex = unitIntersections.length > 0
      ? hexFromPickData(unitIntersections[0].object.userData, combat.units)
      : null;
    if (unitHex) return unitHex;

    const tileIntersections = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()), false);
    if (tileIntersections.length === 0) return null;
    return hexFromPickData(tileIntersections[0].object.userData, combat.units);
  }
}

function assertWebGLAvailable(): void {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) {
    throw new Error("WebGL is unavailable.");
  }
}

function drawPlaceholderSprite(ctx: CanvasRenderingContext2D, sprite: SpriteDef | null, frameId: SpriteFrameId): void {
  const palette = sprite?.palette ?? {
    primary: "#4488ff",
    secondary: "#20345f",
    accent: "#ffffff",
    shadow: "#101624",
  };
  const attacking = frameId === "attack" || frameId === "cast";
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  ctx.fillStyle = palette.shadow;
  ctx.fillRect(10, 25, 13, 3);
  ctx.fillStyle = palette.secondary;
  ctx.fillRect(10, 13, 12, 12);
  ctx.fillStyle = palette.primary;
  ctx.fillRect(12, 8, 8, 6);
  ctx.fillRect(11, 15, 10, 8);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(14, 10, 2, 2);
  ctx.fillRect(18, 10, 2, 2);

  if (attacking) {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(21, 12, 7, 2);
    ctx.fillRect(25, 9, 2, 8);
  } else {
    ctx.fillStyle = palette.secondary;
    ctx.fillRect(22, 16, 3, 7);
  }

  if (sprite?.id.includes("wolf")) {
    ctx.fillStyle = palette.primary;
    ctx.fillRect(8, 15, 16, 8);
    ctx.fillRect(19, 11, 6, 6);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(23, 13, 2, 2);
  }

  if (sprite?.id.includes("ogre")) {
    ctx.fillStyle = palette.primary;
    ctx.fillRect(8, 9, 16, 16);
    ctx.fillStyle = palette.secondary;
    ctx.fillRect(10, 5, 12, 7);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(24, attacking ? 9 : 13, 5, 3);
  }
}

function disposeGroupMaterials(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const mat of material) mat.dispose();
    } else if (material) {
      material.dispose();
    }
  });
}
