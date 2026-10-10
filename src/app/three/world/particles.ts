import * as THREE from 'three';
import type { QualityProfile } from './quality';
import type { Terrain } from './terrain';
import type { WorldClock } from './cards';
import { smallLeafTexture } from './textures';

/**
 * Pollen motes and the odd falling leaf.
 *
 * Motes are a single `THREE.Points` whose vertex shader wraps every point into
 * a box that travels with the camera, so they never need CPU updates. Their
 * alpha is multiplied by (1 - fogFactor) computed in-shader, so distant motes
 * vanish into the mist instead of glowing through it.
 *
 * Leaves are a small InstancedMesh animated on the CPU (sway, tumble, respawn
 * above the camera once they reach the ground).
 */
const BOX = new THREE.Vector3(34, 9, 34);

interface Leaf { pos: THREE.Vector3; spin: THREE.Vector3; rot: THREE.Euler; fall: number; phase: number; }

export class Particles {
  readonly group = new THREE.Group();
  private readonly motes: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly moteCount: number;
  private readonly leaves: THREE.InstancedMesh | null = null;
  private readonly leafState: Leaf[] = [];
  private activeLeaves = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private leafTime = 0;

  constructor(private terrain: Terrain, profile: QualityProfile, clock: WorldClock) {
    this.group.name = 'particles';
    this.moteCount = profile.motes;
    const seeds = new Float32Array(this.moteCount * 3);
    const sizes = new Float32Array(this.moteCount);
    const phases = new Float32Array(this.moteCount);
    for (let i = 0; i < this.moteCount; i++) {
      seeds[i * 3] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();
      sizes[i] = 0.025 + Math.random() * 0.035;
      phases[i] = Math.random();
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: clock.time,
        uCam: { value: new THREE.Vector3() },
        uBox: { value: BOX },
        uPxScale: { value: 500 },
        uFogDensity: { value: profile.fogDensity },
        uColor: { value: new THREE.Color(0xfff1d0) },
      },
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.motes = new THREE.Points(geom, mat);
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 5;
    this.motes.name = 'motes';
    this.group.add(this.motes);

    if (profile.leaves > 0) {
      const leafMat = new THREE.MeshStandardMaterial({
        map: smallLeafTexture(),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.85,
      });
      this.leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.13), leafMat, profile.leaves);
      this.leaves.frustumCulled = false;
      this.leaves.name = 'falling-leaves';
      const c = new THREE.Color();
      for (let i = 0; i < profile.leaves; i++) {
        this.leafState.push({
          pos: new THREE.Vector3(), spin: new THREE.Vector3(
            (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4),
          rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
          fall: 0.35 + Math.random() * 0.45, phase: Math.random() * 6.28,
        });
        c.setHSL(0.08 + Math.random() * 0.08, 0.45 + Math.random() * 0.2, 0.42 + Math.random() * 0.15);
        this.leaves.setColorAt(i, c);
      }
      if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
      this.activeLeaves = profile.leaves;
      this.group.add(this.leaves);
    }
    this.setTier(profile);
  }

  /** @param pxScale drawing-buffer height / (2 * tan(fov / 2)) */
  update(dt: number, camPos: THREE.Vector3, forward: THREE.Vector3, pxScale: number, motion: boolean): void {
    const u = this.motes.material.uniforms;
    (u['uCam'].value as THREE.Vector3).copy(camPos);
    u['uPxScale'].value = pxScale;
    if (!this.leaves || this.activeLeaves === 0) return;
    if (!motion) return;
    this.leafTime += dt;
    for (let i = 0; i < this.activeLeaves; i++) {
      const l = this.leafState[i];
      const ground = this.terrain.heightAt(l.pos.x, l.pos.z);
      const dx = l.pos.x - camPos.x, dz = l.pos.z - camPos.z;
      if (l.pos.y < ground + 0.03 || dx * dx + dz * dz > 26 * 26 || l.pos.lengthSq() === 0) {
        this.spawnLeaf(l, camPos, forward, l.pos.lengthSq() === 0);
      }
      l.pos.y -= l.fall * dt;
      l.pos.x += Math.sin(this.leafTime * 1.3 + l.phase) * 0.45 * dt + 0.08 * dt;
      l.pos.z += Math.cos(this.leafTime * 1.1 + l.phase) * 0.35 * dt;
      l.rot.x += l.spin.x * dt;
      l.rot.y += l.spin.y * dt;
      l.rot.z += l.spin.z * dt;
      this.q.setFromEuler(l.rot);
      this.m.compose(l.pos, this.q, this.s);
      this.leaves.setMatrixAt(i, this.m);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
  }

  setFogDensity(density: number): void {
    this.motes.material.uniforms['uFogDensity'].value = density;
  }

  setTier(profile: QualityProfile): void {
    this.motes.geometry.setDrawRange(0, Math.min(this.moteCount, profile.motes));
    this.setFogDensity(profile.fogDensity);
    if (this.leaves) {
      this.activeLeaves = Math.min(this.leafState.length, profile.leaves);
      this.leaves.count = this.activeLeaves;
      this.leaves.visible = this.activeLeaves > 0;
    }
  }

  dispose(): void { /* released by the scene traversal */ }

  private spawnLeaf(l: Leaf, camPos: THREE.Vector3, forward: THREE.Vector3, initial: boolean): void {
    const a = Math.random() * Math.PI * 2;
    const r = 2 + Math.random() * 18;
    l.pos.set(
      camPos.x + forward.x * 8 + Math.cos(a) * r,
      0,
      camPos.z + forward.z * 8 + Math.sin(a) * r,
    );
    const ground = this.terrain.heightAt(l.pos.x, l.pos.z);
    l.pos.y = ground + (initial ? 0.5 + Math.random() * 9 : 6 + Math.random() * 5);
  }
}

const MOTE_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uBox;
uniform float uPxScale;
uniform float uFogDensity;
varying float vAlpha;
void main() {
  float ph = aPhase * 6.2831;
  vec3 drift = vec3(
    sin(uTime * 0.13 + ph) * 0.8 + uTime * 0.05,
    uTime * 0.03 + sin(uTime * 0.21 + ph * 1.3) * 0.35,
    cos(uTime * 0.11 + ph) * 0.8);
  vec3 centre = uCam + vec3(0.0, 1.2, 0.0);
  vec3 local = mod(position * uBox + drift - centre, uBox) - uBox * 0.5;
  vec3 world = centre + local;
  vec4 mv = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  gl_PointSize = clamp(aSize * uPxScale / max(depth, 0.1), 0.0, 9.0);
  vec3 e = abs(local) / (uBox * 0.5);
  float edge = (1.0 - smoothstep(0.72, 1.0, max(e.x, e.z))) * (1.0 - smoothstep(0.7, 1.0, e.y));
  float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
  float near = smoothstep(0.4, 1.4, depth);
  float twinkle = 0.65 + 0.35 * sin(uTime * 1.7 + ph * 3.0);
  vAlpha = edge * near * twinkle * (1.0 - fogFactor);
}`;

const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.08, d) * vAlpha * 0.8;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;
