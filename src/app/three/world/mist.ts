import * as THREE from 'three';
import type { QualityProfile } from './quality';
import type { TrailField } from './trail-field';
import type { Terrain } from './terrain';
import { noiseTexture, softBlobTexture } from './textures';

/**
 * Ground mist: one or two noise-textured sheets that hug the terrain around the
 * camera (re-draped every time the snapped centre moves 2 m), plus individual
 * soft sprites drifting along the trail in a window around the viewer.
 * Everything is tinted with the current fog colour, and anything within a few
 * metres of the camera fades out so nothing crosses the lens as a hard edge.
 */
const SHEET_RADIUS = 36;
const SHEET_SEGMENTS = 36;
const SNAP = 2;
/** Faint stacked ground-mist layers: height above the terrain, opacity, noise scale. */
const MIST_LAYERS = [
  { lift: 0.06, opacity: 0.16, scale: 1.0 },
  { lift: 0.3, opacity: 0.13, scale: 0.9 },
  { lift: 0.65, opacity: 0.09, scale: 0.75 },
  { lift: 1.05, opacity: 0.06, scale: 0.63 },
];
const BEHIND_M = 25;
const AHEAD_MIN_M = 45;
const AHEAD_MAX_M = 95;

interface MistSprite {
  sprite: THREE.Sprite;
  u: number;
  lateral: number;
  lift: number;
  speed: number;
  opacity: number;
  phase: number;
}

export class Mist {
  readonly group = new THREE.Group();
  private readonly sheetGeom: THREE.PlaneGeometry;
  private readonly layers: { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; lift: number }[] = [];
  private sheetX = NaN;
  private sheetZ = NaN;
  private readonly sprites: MistSprite[] = [];
  private readonly colourSRGB = new THREE.Color();
  private readonly uniforms: Record<string, THREE.IUniform>;
  private time = 0;
  private activeSprites = 0;
  private baseXZ: Float32Array | null = null;
  private readonly p = { x: 0, z: 0 };
  private readonly t = { x: 0, z: 1 };

  constructor(private field: TrailField, private terrain: Terrain, profile: QualityProfile) {
    this.group.name = 'mist';
    this.uniforms = {
      uNoise: { value: noiseTexture() },
      uColor: { value: this.colourSRGB },
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uRadius: { value: SHEET_RADIUS },
    };
    // Each "sheet" is a stack of faint layers sharing one terrain-draped
    // geometry. A single opaque-ish layer slices every trunk and rock with a
    // hard horizontal line (no soft particles without a depth pre-pass);
    // several faint ones turn that line into a soft gradient.
    this.sheetGeom = new THREE.PlaneGeometry(SHEET_RADIUS * 2, SHEET_RADIUS * 2, SHEET_SEGMENTS, SHEET_SEGMENTS);
    this.sheetGeom.rotateX(-Math.PI / 2);
    MIST_LAYERS.forEach((layer, i) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...this.uniforms, uOpacity: { value: layer.opacity }, uScale: { value: layer.scale } },
        vertexShader: MIST_VERT,
        fragmentShader: MIST_FRAG,
        transparent: true,
        depthWrite: false,
        fog: false,
      });
      const mesh = new THREE.Mesh(this.sheetGeom, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      mesh.name = `mist-layer-${i}`;
      this.layers.push({ mesh, lift: layer.lift });
      this.group.add(mesh);
    });
    this.setLayerCount(profile);

    const blob = softBlobTexture();
    for (let i = 0; i < profile.mistSprites; i++) {
      const mat = new THREE.SpriteMaterial({
        map: blob,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        // Not tone-mapped, so the tint matches the fog/background exactly.
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 3;
      const s: MistSprite = {
        sprite, u: 0, lateral: 0, lift: 0, speed: 0,
        opacity: 0.06 + Math.random() * 0.06, phase: Math.random() * Math.PI * 2,
      };
      this.respawn(s, 0, true);
      this.sprites.push(s);
      this.group.add(sprite);
    }
    this.activeSprites = this.sprites.length;
  }

  /**
   * @param camU arc fraction of the camera on the trail
   * @param motion when false the mist still follows the camera but stops drifting
   */
  update(dt: number, camPos: THREE.Vector3, camU: number, fogColour: THREE.Color, motion: boolean): void {
    if (motion) this.time += dt;
    this.colourSRGB.copy(fogColour).convertLinearToSRGB();
    this.uniforms['uTime'].value = this.time;
    (this.uniforms['uCam'].value as THREE.Vector3).copy(camPos);

    const cx = Math.round(camPos.x / SNAP) * SNAP;
    const cz = Math.round(camPos.z / SNAP) * SNAP;
    if (cx !== this.sheetX || cz !== this.sheetZ) this.drape(cx, cz);

    const len = this.field.length;
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i];
      s.sprite.visible = i < this.activeSprites;
      if (!s.sprite.visible) continue;
      if (motion) s.u += (s.speed * dt) / len;
      const ahead = (s.u - camU) * len;
      if (ahead < -BEHIND_M || ahead > AHEAD_MAX_M + 10) this.respawn(s, camU, false);
      this.place(s);
      const dist = s.sprite.position.distanceTo(camPos);
      const near = THREE.MathUtils.smoothstep(dist, 2.5, 6.5);
      const breathe = 0.85 + 0.15 * Math.sin(this.time * 0.3 + s.phase);
      const mat = s.sprite.material;
      mat.color.copy(fogColour);
      mat.opacity = s.opacity * near * breathe;
    }
  }

  setTier(profile: QualityProfile): void {
    this.activeSprites = Math.min(this.sprites.length, profile.mistSprites);
    this.setLayerCount(profile);
  }

  /** Two sheets (high tier) = the full four-layer stack; one sheet = the lower two. */
  private setLayerCount(profile: QualityProfile): void {
    const count = profile.mistSheets >= 2 ? MIST_LAYERS.length : 2;
    this.layers.forEach((l, i) => { l.mesh.visible = i < count; });
  }

  dispose(): void { /* released by the scene traversal */ }

  private respawn(s: MistSprite, camU: number, initial: boolean): void {
    const len = this.field.length;
    const ahead = initial
      ? -BEHIND_M + Math.random() * (AHEAD_MAX_M + BEHIND_M)
      : AHEAD_MIN_M + Math.random() * (AHEAD_MAX_M - AHEAD_MIN_M);
    s.u = THREE.MathUtils.clamp(camU + ahead / len, 0, 1);
    s.lateral = (Math.random() - 0.5) * 22;
    const size = 6 + Math.random() * 6;
    s.sprite.scale.set(size, size * (0.45 + Math.random() * 0.2), 1);
    s.lift = size * 0.22 + Math.random() * 0.8;
    s.speed = 0.15 + Math.random() * 0.35;
  }

  private place(s: MistSprite): void {
    this.field.pointAt(s.u, this.p);
    this.field.tangentAt(s.u, this.t);
    const lat = s.lateral + Math.sin(this.time * 0.05 + s.phase) * 1.5;
    const x = this.p.x - this.t.z * lat;
    const z = this.p.z + this.t.x * lat;
    s.sprite.position.set(x, this.terrain.heightAt(x, z) + s.lift, z);
  }

  /** Re-drape the shared layer geometry over the terrain around (cx, cz). */
  private drape(cx: number, cz: number): void {
    this.sheetX = cx;
    this.sheetZ = cz;
    const pos = this.sheetGeom.getAttribute('position') as THREE.BufferAttribute;
    if (this.baseXZ === null) {
      this.baseXZ = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) { this.baseXZ[i * 2] = pos.getX(i); this.baseXZ[i * 2 + 1] = pos.getZ(i); }
    }
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, this.terrain.heightAt(cx + this.baseXZ[i * 2], cz + this.baseXZ[i * 2 + 1]));
    }
    pos.needsUpdate = true;
    for (const l of this.layers) l.mesh.position.set(cx, l.lift, cz);
  }
}

const MIST_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const MIST_FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform vec3 uColor;
uniform float uTime;
uniform vec3 uCam;
uniform float uRadius;
uniform float uOpacity;
uniform float uScale;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz * uScale;
  float n1 = texture2D(uNoise, p * 0.018 + vec2(uTime * 0.0045, uTime * 0.002)).r;
  float n2 = texture2D(uNoise, p * 0.052 - vec2(uTime * 0.006, -uTime * 0.0035)).r;
  float m = smoothstep(0.32, 0.78, n1 * 0.62 + n2 * 0.45);
  float radial = 1.0 - smoothstep(uRadius * 0.5, uRadius * 0.98, length(vWorld.xz - uCam.xz));
  float nearFade = smoothstep(2.0, 7.0, length(vWorld - uCam));
  gl_FragColor = vec4(uColor, m * radial * nearFade * uOpacity);
}`;
