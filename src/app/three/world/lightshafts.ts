import * as THREE from 'three';
import type { QualityProfile } from './quality';
import type { TrailField } from './trail-field';
import type { Terrain } from './terrain';
import { shaftTexture } from './textures';

/**
 * Faint shafts of morning sun slanting through gaps in the canopy. Each is a
 * thin additive plane whose long axis points back up the sun direction and
 * which turns about that axis to face the camera. Additive + fog would brighten
 * the distance, so they use `fog: false` and fade by distance by hand. They
 * live in a window around the viewer and are recycled ahead as you walk.
 */
const LENGTH = 40;
const BEHIND_M = 10;
const AHEAD_MIN_M = 12;
const AHEAD_MAX_M = 65;

interface Shaft {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  u: number;
  lateral: number;
  base: THREE.Vector3;
  phase: number;
  strength: number;
  fadeIn: number;
}

export class LightShafts {
  readonly group = new THREE.Group();
  private readonly shafts: Shaft[] = [];
  private readonly axis: THREE.Vector3;
  private active = 0;
  private time = 0;
  private readonly tmpN = new THREE.Vector3();
  private readonly tmpX = new THREE.Vector3();
  private readonly tmpMid = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();
  private readonly colour = new THREE.Color(0xfff4e0);
  private readonly p = { x: 0, z: 0 };
  private readonly t = { x: 0, z: 1 };

  constructor(private field: TrailField, private terrain: Terrain, sunDir: THREE.Vector3, profile: QualityProfile) {
    this.group.name = 'light-shafts';
    this.axis = sunDir.clone().negate().normalize();
    const geom = new THREE.PlaneGeometry(1, 1);
    geom.translate(0, 0.5, 0);
    const tex = shaftTexture();
    for (let i = 0; i < profile.lightShafts; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: this.colour,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      const shaft: Shaft = { mesh, u: 0, lateral: 0, base: new THREE.Vector3(), phase: Math.random() * 6.28, strength: 0, fadeIn: 1 };
      this.respawn(shaft, 0, true);
      this.shafts.push(shaft);
      this.group.add(mesh);
    }
    this.active = this.shafts.length;
  }

  update(dt: number, camPos: THREE.Vector3, camU: number, lightColour: THREE.Color, motion: boolean): void {
    if (motion) this.time += dt;
    const len = this.field.length;
    for (let i = 0; i < this.shafts.length; i++) {
      const s = this.shafts[i];
      s.mesh.visible = i < this.active;
      if (!s.mesh.visible) continue;
      const ahead = (s.u - camU) * len;
      if (ahead < -BEHIND_M || ahead > AHEAD_MAX_M + 20) this.respawn(s, camU, false);
      s.fadeIn = Math.min(1, s.fadeIn + dt / 2.5);

      // Face the camera while keeping the long axis on the sun direction.
      this.tmpMid.copy(s.base).addScaledVector(this.axis, LENGTH * 0.5);
      this.tmpN.subVectors(camPos, this.tmpMid);
      this.tmpN.addScaledVector(this.axis, -this.tmpN.dot(this.axis));
      if (this.tmpN.lengthSq() < 1e-6) this.tmpN.set(0, 0, 1);
      this.tmpN.normalize();
      this.tmpX.crossVectors(this.axis, this.tmpN).normalize();
      this.basis.makeBasis(this.tmpX, this.axis, this.tmpN);
      s.mesh.quaternion.setFromRotationMatrix(this.basis);
      s.mesh.position.copy(s.base);

      const dist = this.tmpMid.distanceTo(camPos);
      const closest = distanceToSegment(camPos, s.base, this.axis, LENGTH);
      const far = 1 - THREE.MathUtils.smoothstep(dist, 35, 85);
      const near = THREE.MathUtils.smoothstep(closest, 2.5, 7);
      const breathe = 0.75 + 0.25 * Math.sin(this.time * 0.35 + s.phase);
      s.mesh.material.opacity = 0.06 * s.strength * breathe * far * near * s.fadeIn;
      s.mesh.material.color.copy(this.colour).lerp(lightColour, 0.5);
    }
  }

  setTier(profile: QualityProfile): void {
    this.active = Math.min(this.shafts.length, profile.lightShafts);
  }

  dispose(): void { /* released by the scene traversal */ }

  private respawn(s: Shaft, camU: number, initial: boolean): void {
    const len = this.field.length;
    const ahead = initial
      ? -BEHIND_M + Math.random() * (AHEAD_MAX_M + BEHIND_M)
      : AHEAD_MIN_M + Math.random() * (AHEAD_MAX_M - AHEAD_MIN_M);
    s.u = THREE.MathUtils.clamp(camU + ahead / len, 0, 1);
    s.lateral = (Math.random() - 0.5) * 14;
    this.field.pointAt(s.u, this.p);
    this.field.tangentAt(s.u, this.t);
    const x = this.p.x - this.t.z * s.lateral;
    const z = this.p.z + this.t.x * s.lateral;
    s.base.set(x, this.terrain.heightAt(x, z) - 0.2, z);
    const width = 1.2 + Math.random() * 1.6;
    s.mesh.scale.set(width, LENGTH, 1);
    s.strength = 0.6 + Math.random() * 0.4;
    s.fadeIn = initial ? 1 : 0;
  }
}

function distanceToSegment(p: THREE.Vector3, a: THREE.Vector3, dir: THREE.Vector3, len: number): number {
  const f = THREE.MathUtils.clamp((p.x - a.x) * dir.x + (p.y - a.y) * dir.y + (p.z - a.z) * dir.z, 0, len);
  return Math.hypot(p.x - (a.x + dir.x * f), p.y - (a.y + dir.y * f), p.z - (a.z + dir.z * f));
}
