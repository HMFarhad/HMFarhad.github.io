import * as THREE from 'three';
import type { QualityProfile } from './quality';
import type { TrailField } from './trail-field';
import type { LandmarkAnchor } from './landmark-plan';
import { butterflyWingTexture } from './textures';

/**
 * Occasional life: dark bird silhouettes crossing high over the trail ahead,
 * and butterflies hovering around each landmark. Birds hide and butterflies
 * stay parked (frozen mid-hover) when motion is reduced.
 */
interface Bird {
  root: THREE.Group;
  left: THREE.Mesh;
  right: THREE.Mesh;
  wait: number;
  flying: boolean;
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  elapsed: number;
  duration: number;
  phase: number;
}

const BUTTERFLY_RANGE = 70;
const BUTTERFLY_COLOURS = [0xf3e6a0, 0xf4f1e6, 0xe9a35a, 0xb9d0e8, 0xf0d27a];

export class Wildlife {
  readonly group = new THREE.Group();
  private readonly birds: Bird[] = [];
  private activeBirds = 0;
  private readonly butterflies: THREE.InstancedMesh;
  private readonly perStationBuilt: number;
  private perStation: number;
  private readonly seeds: { a: number; b: number; c: number; p: number; r: number }[] = [];
  private time = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly m = new THREE.Matrix4();
  private readonly wing = new THREE.Matrix4();
  private readonly wingOut = new THREE.Matrix4();
  private readonly mirror = new THREE.Matrix4().makeScale(-1, 1, 1);
  private readonly q = new THREE.Quaternion();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly prev: THREE.Vector3[] = [];
  private readonly p = { x: 0, z: 0 };
  private readonly t = { x: 0, z: 1 };

  constructor(private field: TrailField, private anchors: readonly LandmarkAnchor[], profile: QualityProfile) {
    this.group.name = 'wildlife';

    // ---- birds
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x2c332f, side: THREE.DoubleSide });
    const bodyGeom = new THREE.BufferGeometry();
    bodyGeom.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0.42, -0.07, 0, -0.2, 0.07, 0, -0.2,
      -0.07, 0, -0.2, 0.07, 0, -0.2, 0, 0, -0.42,
    ], 3));
    const wingGeom = new THREE.BufferGeometry();
    wingGeom.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0.16, 0, 0, -0.14, 0.78, 0, -0.08,
    ], 3));
    for (let i = 0; i < profile.birds; i++) {
      const root = new THREE.Group();
      const body = new THREE.Mesh(bodyGeom, birdMat);
      const right = new THREE.Mesh(wingGeom, birdMat);
      const left = new THREE.Mesh(wingGeom, birdMat);
      left.scale.x = -1;
      root.add(body, right, left);
      root.visible = false;
      root.scale.setScalar(1.3);
      this.group.add(root);
      this.birds.push({
        root, left, right, wait: 3 + Math.random() * 12, flying: false,
        p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(),
        elapsed: 0, duration: 8, phase: Math.random() * 6.28,
      });
    }
    this.activeBirds = this.birds.length;

    // ---- butterflies: two wing instances each, slot-major so a prefix is a lower tier
    const wingGeomB = new THREE.PlaneGeometry(0.12, 0.1);
    wingGeomB.translate(0.06, 0, 0);
    wingGeomB.rotateX(-Math.PI / 2);
    const wingMat = new THREE.MeshStandardMaterial({
      map: butterflyWingTexture(),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.8,
    });
    this.perStationBuilt = profile.butterfliesPerStation;
    this.perStation = this.perStationBuilt;
    const total = anchors.length * this.perStationBuilt;
    this.butterflies = new THREE.InstancedMesh(wingGeomB, wingMat, Math.max(1, total * 2));
    this.butterflies.name = 'butterflies';
    this.butterflies.frustumCulled = false;
    const c = new THREE.Color();
    for (let k = 0; k < total; k++) {
      this.seeds.push({
        a: 0.5 + Math.random() * 0.5, b: 0.8 + Math.random() * 0.6, c: 0.4 + Math.random() * 0.5,
        p: Math.random() * 6.28, r: 1.2 + Math.random() * 1.2,
      });
      c.setHex(BUTTERFLY_COLOURS[(Math.random() * BUTTERFLY_COLOURS.length) | 0]);
      this.butterflies.setColorAt(k * 2, c);
      this.butterflies.setColorAt(k * 2 + 1, c);
      this.prev.push(new THREE.Vector3());
    }
    if (this.butterflies.instanceColor) this.butterflies.instanceColor.needsUpdate = true;
    this.group.add(this.butterflies);
    this.updateButterflies(new THREE.Vector3(1e6, 0, 1e6), true);
    this.setTier(profile);
  }

  update(dt: number, camPos: THREE.Vector3, camU: number, motion: boolean): void {
    if (!motion) {
      // Reduced motion: no birds; butterflies stay where they are.
      for (const b of this.birds) { b.root.visible = false; b.flying = false; }
      return;
    }
    this.time += dt;
    this.updateBirds(dt, camU);
    this.updateButterflies(camPos, false);
  }

  setTier(profile: QualityProfile): void {
    this.activeBirds = Math.min(this.birds.length, profile.birds);
    this.birds.forEach((b, i) => { if (i >= this.activeBirds) { b.root.visible = false; b.flying = false; } });
    this.perStation = Math.min(this.perStationBuilt, profile.butterfliesPerStation);
    this.butterflies.count = this.anchors.length * this.perStation * 2;
  }

  dispose(): void { /* released by the scene traversal */ }

  // ------------------------------------------------------------ birds
  private updateBirds(dt: number, camU: number): void {
    for (let i = 0; i < this.activeBirds; i++) {
      const b = this.birds[i];
      if (!b.flying) {
        b.wait -= dt;
        if (b.wait <= 0) this.launch(b, camU);
        continue;
      }
      b.elapsed += dt;
      const f = b.elapsed / b.duration;
      if (f >= 1) {
        b.flying = false;
        b.root.visible = false;
        b.wait = 8 + Math.random() * 12;
        continue;
      }
      bezier(b.p0, b.p1, b.p2, f, this.tmp);
      bezier(b.p0, b.p1, b.p2, Math.min(1, f + 0.01), this.tmp2);
      b.root.position.copy(this.tmp);
      b.root.lookAt(this.tmp2);
      const flapping = Math.sin(this.time * 0.9 + b.phase) > -0.35;
      const angle = flapping ? Math.sin(this.time * 11 + b.phase) * 0.65 : 0.12;
      b.right.rotation.z = angle;
      b.left.rotation.z = -angle;
    }
  }

  private launch(b: Bird, camU: number): void {
    const len = this.field.length;
    const u = THREE.MathUtils.clamp(camU + (20 + Math.random() * 40) / len, 0, 1);
    this.field.pointAt(u, this.p);
    this.field.tangentAt(u, this.t);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const sx = -this.t.z * dir, sz = this.t.x * dir;
    const height = 14 + Math.random() * 6;
    const span = 32 + Math.random() * 10;
    b.p0.set(this.p.x - sx * span, height + Math.random() * 3, this.p.z - sz * span);
    b.p2.set(this.p.x + sx * span, height + Math.random() * 3, this.p.z + sz * span);
    b.p1.set(
      this.p.x + this.t.x * (Math.random() - 0.5) * 30,
      height + 2 + Math.random() * 4,
      this.p.z + this.t.z * (Math.random() - 0.5) * 30,
    );
    b.elapsed = 0;
    b.duration = 6 + Math.random() * 4;
    b.flying = true;
    b.root.visible = true;
  }

  // ------------------------------------------------------- butterflies
  private updateButterflies(camPos: THREE.Vector3, force: boolean): void {
    const n = this.anchors.length;
    const active = n * this.perStation;
    let dirty = false;
    for (let k = 0; k < active; k++) {
      const a = this.anchors[k % n];
      const dx = a.x - camPos.x, dz = a.z - camPos.z;
      if (!force && dx * dx + dz * dz > BUTTERFLY_RANGE * BUTTERFLY_RANGE) continue;
      const s = this.seeds[k];
      const t = this.time;
      this.tmp.set(
        a.x + Math.sin(t * s.a + s.p) * s.r,
        a.y + 1.1 + Math.sin(t * s.b + s.p * 2) * 0.45,
        a.z + Math.sin(t * s.c + s.p * 3) * s.r,
      );
      const prev = this.prev[k];
      this.tmp2.subVectors(this.tmp, prev);
      const heading = this.tmp2.lengthSq() > 1e-8 ? Math.atan2(this.tmp2.x, this.tmp2.z) : s.p;
      prev.copy(this.tmp);
      const flap = 0.25 + 1.0 * Math.abs(Math.sin(t * 13 + s.p * 5));
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, heading);
      this.m.compose(this.tmp, this.q, this.one);
      this.wing.makeRotationZ(flap);
      this.wingOut.multiplyMatrices(this.m, this.wing);
      this.butterflies.setMatrixAt(k * 2, this.wingOut);
      this.wingOut.multiplyMatrices(this.m, this.mirror).multiply(this.wing);
      this.butterflies.setMatrixAt(k * 2 + 1, this.wingOut);
      dirty = true;
    }
    if (dirty) this.butterflies.instanceMatrix.needsUpdate = true;
  }
}

function bezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
}
