import * as THREE from "three";
import type { ActionElement } from "../../state/types.ts";

const MAX_TEXT_SPRITES = 12;
const MAX_PROJECTILES = 4;
const MAX_BURST_PARTICLES = 16;
const MAX_SPARKLES = 10;
const MAX_SHIELD_FLASHES = 4;
const MAX_DEATH_PARTICLES = 20;

const ELEMENT_COLORS: Record<ActionElement, THREE.Color> = {
  fire: new THREE.Color("#ff6622"),
  frost: new THREE.Color("#66ccff"),
  arcane: new THREE.Color("#bb88ff"),
  heal: new THREE.Color("#66ff88"),
  physical: new THREE.Color("#ffcc66"),
  dark: new THREE.Color("#8844aa"),
};

const ELEMENT_BURST_COLORS: Record<ActionElement, THREE.Color> = {
  fire: new THREE.Color("#ff4400"),
  frost: new THREE.Color("#44aaff"),
  arcane: new THREE.Color("#9966ff"),
  heal: new THREE.Color("#44ff77"),
  physical: new THREE.Color("#ffaa33"),
  dark: new THREE.Color("#663388"),
};

interface TextSprite {
  sprite: THREE.Sprite;
  startY: number;
  rise: number;
  duration: number;
  elapsed: number;
  active: boolean;
}

interface Projectile {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  duration: number;
  elapsed: number;
  active: boolean;
  onDone: (() => void) | null;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  startScale: number;
  expand: number;
  duration: number;
  elapsed: number;
  active: boolean;
  color: THREE.Color;
}

interface Sparkle {
  sprite: THREE.Sprite;
  startPos: THREE.Vector3;
  drift: THREE.Vector3;
  duration: number;
  elapsed: number;
  active: boolean;
  color: THREE.Color;
}

interface ShieldFlash {
  mesh: THREE.Mesh;
  duration: number;
  elapsed: number;
  active: boolean;
}

interface DeathParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  duration: number;
  elapsed: number;
  active: boolean;
  color: THREE.Color;
}

export class VfxManager {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;

  private textPool: TextSprite[] = [];
  private projPool: Projectile[] = [];
  private burstPool: BurstParticle[] = [];
  private sparklePool: Sparkle[] = [];
  private shieldPool: ShieldFlash[] = [];
  private deathPool: DeathParticle[] = [];

  private shakeIntensity = 0;
  private shakeDecay = 0;
  private shakeElapsed = 0;
  private shakeDuration = 0;
  private readonly baseCameraPos = new THREE.Vector3(5.2, 6.8, 7.4);

  private readonly projGeom = new THREE.SphereGeometry(0.08, 8, 8);
  private readonly burstGeom = new THREE.SphereGeometry(0.06, 6, 6);
  private readonly sparkleGeom = new THREE.SphereGeometry(0.04, 4, 4);
  private readonly shieldGeom = new THREE.RingGeometry(0.35, 0.55, 24);
  private readonly deathGeom = new THREE.BoxGeometry(0.06, 0.06, 0.06);

  private mat(mesh: THREE.Mesh): THREE.MeshBasicMaterial {
    return (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshBasicMaterial;
  }

  constructor(scene: THREE.Scene, camera: THREE.OrthographicCamera) {
    this.scene = scene;
    this.camera = camera;
    this.preallocate();
  }

  private preallocate(): void {
    for (let i = 0; i < MAX_TEXT_SPRITES; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 32;
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      this.scene.add(sprite);
      this.textPool.push({ sprite, startY: 0, rise: 0.4, duration: 0.6, elapsed: 0, active: false });
    }

    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const material = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true });
      const mesh = new THREE.Mesh(this.projGeom.clone(), material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projPool.push({ mesh, from: new THREE.Vector3(), to: new THREE.Vector3(), duration: 0.3, elapsed: 0, active: false, onDone: null });
    }

    for (let i = 0; i < MAX_BURST_PARTICLES; i++) {
      const material = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true });
      const mesh = new THREE.Mesh(this.burstGeom.clone(), material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.burstPool.push({ mesh, startScale: 0.3, expand: 1.2, duration: 0.25, elapsed: 0, active: false, color: new THREE.Color("#ffffff") });
    }

    for (let i = 0; i < MAX_SPARKLES; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.makeSparkleTexture(),
        transparent: true,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.scale.set(0.15, 0.15, 1);
      this.scene.add(sprite);
      this.sparklePool.push({ sprite, startPos: new THREE.Vector3(), drift: new THREE.Vector3(), duration: 0.5, elapsed: 0, active: false, color: new THREE.Color("#ffffff") });
    }

    for (let i = 0; i < MAX_SHIELD_FLASHES; i++) {
      const material = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(this.shieldGeom.clone(), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.6;
      mesh.visible = false;
      this.scene.add(mesh);
      this.shieldPool.push({ mesh, duration: 0.25, elapsed: 0, active: false });
    }

    for (let i = 0; i < MAX_DEATH_PARTICLES; i++) {
      const material = new THREE.MeshBasicMaterial({ color: "#442233", transparent: true });
      const mesh = new THREE.Mesh(this.deathGeom.clone(), material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.deathPool.push({ mesh, velocity: new THREE.Vector3(), duration: 0.4, elapsed: 0, active: false, color: new THREE.Color("#442233") });
    }
  }

  private makeSparkleTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(8, 8, 1, 8, 8, 7);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.8)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  private makeTextTexture(text: string, color: string, fontSize: number): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 32;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 64, 32);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = color;
    ctx.fillText(text, 32, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  private acquire<T extends { active: boolean }>(pool: T[]): T | null {
    for (const item of pool) {
      if (!item.active) return item;
    }
    return null;
  }

  spawnFloatingNumber(worldPos: THREE.Vector3, amount: number, kind: "damage" | "heal" | "miss", isCrit: boolean): void {
    const text = kind === "miss" ? "Miss!" : kind === "heal" ? `+${amount}` : `${amount}`;
    const color = kind === "heal" ? "#66ff88" : kind === "miss" ? "#cccccc" : isCrit ? "#ff4444" : "#ffaa66";
    const fontSize = isCrit ? 16 : 13;

    const entry = this.acquire(this.textPool);
    if (!entry) return;

    entry.active = true;
    entry.elapsed = 0;
    entry.duration = 0.6;
    entry.rise = 0.5;
    entry.startY = worldPos.y + 1.3;

    const tex = this.makeTextTexture(text, color, fontSize);
    entry.sprite.material.map = tex;
    entry.sprite.material.needsUpdate = true;

    const scale = isCrit ? 0.6 : 0.4;
    entry.sprite.scale.set(scale, scale * 0.5, 1);
    entry.sprite.position.copy(worldPos);
    entry.sprite.position.y = entry.startY;
    entry.sprite.visible = true;

    entry.sprite.material.color.set("#ffffff");
  }

  spawnProjectile(from: THREE.Vector3, to: THREE.Vector3, element: ActionElement): void {
    const entry = this.acquire(this.projPool);
    if (!entry) return;

    entry.active = true;
    entry.elapsed = 0;
    entry.duration = 0.3;
    entry.from.copy(from);
    entry.from.y += 0.9;
    entry.to.copy(to);
    entry.to.y += 0.9;
    entry.onDone = null;

    const color = ELEMENT_COLORS[element];
    entry.mesh.position.copy(entry.from);
    this.mat(entry.mesh).color.copy(color);
    this.mat(entry.mesh).opacity = 1;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(1);
  }

  spawnBurst(pos: THREE.Vector3, element: ActionElement): void {
    const color = ELEMENT_BURST_COLORS[element];
    const count = 4;
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    for (let i = 0; i < count; i++) {
      const entry = this.acquire(this.burstPool);
      if (!entry) continue;
      entry.active = true;
      entry.elapsed = 0;
      entry.duration = 0.25;
      entry.startScale = 0.2;
      entry.expand = 1.0;
      entry.color.copy(color);
      entry.mesh.position.set(pos.x, pos.y + 0.8, pos.z);
      entry.mesh.position.x += Math.cos(angles[i]) * 0.1;
      entry.mesh.position.z += Math.sin(angles[i]) * 0.1;
      entry.mesh.scale.setScalar(entry.startScale);
      this.mat(entry.mesh).color.copy(color);
      this.mat(entry.mesh).opacity = 1;
      entry.mesh.visible = true;
    }
  }

  spawnSparkle(pos: THREE.Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const entry = this.acquire(this.sparklePool);
      if (!entry) continue;
      entry.active = true;
      entry.elapsed = 0;
      entry.duration = 0.5 + Math.random() * 0.3;
      entry.startPos.set(pos.x, pos.y + 0.7, pos.z);
      entry.drift.set(
        (Math.random() - 0.5) * 0.4,
        0.3 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.4,
      );
      entry.color.setHSL(0.3 + Math.random() * 0.15, 0.8, 0.6);
      entry.sprite.position.copy(entry.startPos);
      entry.sprite.material.color.copy(entry.color);
      entry.sprite.material.opacity = 1;
      entry.sprite.visible = true;
    }
  }

  spawnShieldFlash(pos: THREE.Vector3): void {
    const entry = this.acquire(this.shieldPool);
    if (!entry) return;

    entry.active = true;
    entry.elapsed = 0;
    entry.duration = 0.25;
    entry.mesh.position.set(pos.x, 0, pos.z);
    this.mat(entry.mesh).color.set("#88ccff");
    this.mat(entry.mesh).opacity = 0.7;
    entry.mesh.scale.setScalar(1);
    entry.mesh.visible = true;
  }

  spawnDeathBurst(pos: THREE.Vector3): void {
    const colors = ["#442233", "#553344", "#332244", "#222233"];
    for (let i = 0; i < 6; i++) {
      const entry = this.acquire(this.deathPool);
      if (!entry) continue;
      entry.active = true;
      entry.elapsed = 0;
      entry.duration = 0.4 + Math.random() * 0.15;
      entry.velocity.set(
        (Math.random() - 0.5) * 1.2,
        0.5 + Math.random() * 0.8,
        (Math.random() - 0.5) * 1.2,
      );
      entry.color.set(colors[i % colors.length]);
      entry.mesh.position.set(pos.x, pos.y + 0.6, pos.z);
      this.mat(entry.mesh).color.copy(entry.color);
      this.mat(entry.mesh).opacity = 0.9;
      entry.mesh.scale.setScalar(0.5 + Math.random() * 0.5);
      entry.mesh.visible = true;
    }
  }

  startCameraShake(): void {
    this.shakeIntensity = 0.06;
    this.shakeDecay = 3.5;
    this.shakeElapsed = 0;
    this.shakeDuration = 0.3;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;

    for (const entry of this.textPool) {
      if (!entry.active) continue;
      entry.elapsed += dt;
      const p = Math.min(1, entry.elapsed / entry.duration);
      entry.sprite.position.y = entry.startY + entry.rise * p;
      entry.sprite.material.opacity = 1 - p;
      entry.sprite.material.color.set("#ffffff");
      if (p >= 1) {
        entry.sprite.visible = false;
        entry.active = false;
      }
    }

    for (const entry of this.projPool) {
      if (!entry.active) continue;
      entry.elapsed += dt;
      const p = Math.min(1, entry.elapsed / entry.duration);
      entry.mesh.position.lerpVectors(entry.from, entry.to, p);
      this.mat(entry.mesh).opacity = p < 0.9 ? 1 : 1 - (p - 0.9) / 0.1;
      entry.mesh.scale.setScalar(p < 0.1 ? p * 10 : 1);
      if (p >= 1) {
        entry.mesh.visible = false;
        entry.active = false;
        if (entry.onDone) entry.onDone();
      }
    }

    for (const entry of this.burstPool) {
      if (!entry.active) continue;
      entry.elapsed += dt;
      const p = Math.min(1, entry.elapsed / entry.duration);
      const s = entry.startScale + entry.expand * p;
      entry.mesh.scale.setScalar(s);
      this.mat(entry.mesh).color.copy(entry.color);
      this.mat(entry.mesh).opacity = 1 - p;
      if (p >= 1) {
        entry.mesh.visible = false;
        entry.active = false;
      }
    }

    for (const entry of this.sparklePool) {
      if (!entry.active) continue;
      entry.elapsed += dt;
      const p = Math.min(1, entry.elapsed / entry.duration);
      entry.sprite.position.x = entry.startPos.x + entry.drift.x * p;
      entry.sprite.position.y = entry.startPos.y + entry.drift.y * p;
      entry.sprite.position.z = entry.startPos.z + entry.drift.z * p;
      entry.sprite.material.opacity = 1 - p;
      if (p >= 1) {
        entry.sprite.visible = false;
        entry.active = false;
      }
    }

    for (const entry of this.shieldPool) {
      if (!entry.active) continue;
      entry.elapsed += dt;
      const p = Math.min(1, entry.elapsed / entry.duration);
      const flash = Math.sin(Math.PI * p);
      this.mat(entry.mesh).opacity = 0.7 * flash;
      entry.mesh.scale.setScalar(1 + 0.3 * p);
      if (p >= 1) {
        entry.mesh.visible = false;
        entry.active = false;
      }
    }

    for (const entry of this.deathPool) {
      if (!entry.active) continue;
      entry.elapsed += dt;
      const p = Math.min(1, entry.elapsed / entry.duration);
      entry.mesh.position.x += entry.velocity.x * dt;
      entry.mesh.position.y += entry.velocity.y * dt;
      entry.mesh.position.z += entry.velocity.z * dt;
      entry.velocity.y -= 1.5 * dt;
      this.mat(entry.mesh).opacity = 0.9 * (1 - p);
      entry.mesh.scale.multiplyScalar(0.98);
      if (p >= 1) {
        entry.mesh.visible = false;
        entry.active = false;
      }
    }

    if (this.shakeIntensity > 0) {
      this.shakeElapsed += dt;
      const p = Math.min(1, this.shakeElapsed / this.shakeDuration);
      const decay = 1 - p;
      const ox = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
      const oy = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
      const oz = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
      this.camera.position.set(
        this.baseCameraPos.x + ox,
        this.baseCameraPos.y + oy,
        this.baseCameraPos.z + oz,
      );
      this.camera.lookAt(0, 0, 0);
      if (p >= 1) {
        this.shakeIntensity = 0;
        this.camera.position.copy(this.baseCameraPos);
        this.camera.lookAt(0, 0, 0);
      }
    }
  }

  skipAll(): void {
    for (const entry of this.textPool) { entry.sprite.visible = false; entry.active = false; }
    for (const entry of this.projPool) { entry.mesh.visible = false; entry.active = false; }
    for (const entry of this.burstPool) { entry.mesh.visible = false; entry.active = false; }
    for (const entry of this.sparklePool) { entry.sprite.visible = false; entry.active = false; }
    for (const entry of this.shieldPool) { entry.mesh.visible = false; entry.active = false; }
    for (const entry of this.deathPool) { entry.mesh.visible = false; entry.active = false; }
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = 0;
      this.camera.position.copy(this.baseCameraPos);
      this.camera.lookAt(0, 0, 0);
    }
  }

  dispose(): void {
    for (const entry of this.textPool) {
      this.scene.remove(entry.sprite);
      entry.sprite.material.dispose();
    }
    for (const entry of this.projPool) {
      this.scene.remove(entry.mesh);
      this.mat(entry.mesh).dispose();
    }
    for (const entry of this.burstPool) {
      this.scene.remove(entry.mesh);
      this.mat(entry.mesh).dispose();
    }
    for (const entry of this.sparklePool) {
      this.scene.remove(entry.sprite);
      entry.sprite.material.dispose();
    }
    for (const entry of this.shieldPool) {
      this.scene.remove(entry.mesh);
      this.mat(entry.mesh).dispose();
    }
    for (const entry of this.deathPool) {
      this.scene.remove(entry.mesh);
      this.mat(entry.mesh).dispose();
    }
    this.projGeom.dispose();
    this.burstGeom.dispose();
    this.sparkleGeom.dispose();
    this.shieldGeom.dispose();
    this.deathGeom.dispose();
  }
}
