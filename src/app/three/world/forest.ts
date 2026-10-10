import * as THREE from 'three';
import type { QualityProfile } from './quality';
import { scatterNearTrail, type TrailField } from './trail-field';
import type { Terrain } from './terrain';
import { landmarkClearance, type LandmarkAnchor } from './landmark-plan';
import { applyWindSway, makeCrossPlanes, type WorldClock } from './cards';
import { barkFallbackTexture, leafCanopyTexture, loadTextureWithFallback } from './textures';

/**
 * The trees: instanced trunks and branches sharing one bark material, and
 * crossed-plane leaf puffs at the crown and branch tips. Trees crowd up to
 * 2.2 m from the trail centre (a narrow worn path, not a corridor), vary a lot
 * in height and girth, lean slightly and sit on the terrain. Each station also
 * gets "hero" trees on the side opposite its landmark.
 *
 * Instances are ordered hero-first, then randomly along the trail, so a tier
 * drop just lowers `count` on each InstancedMesh (any prefix is evenly spread).
 */
const CLEARANCE = 2.2;
const LATERAL_MIN = 3;
const LATERAL_MAX = 30;
const BRANCHES_PER_TREE = 4;
const BASE_TRUNK_RADIUS = 0.32;

interface TreeSpec {
  base: THREE.Vector3;
  axis: THREE.Vector3;
  quat: THREE.Quaternion;
  height: number;
  radius: number;
  hero: boolean;
  tint: THREE.Color;
}

export class Forest {
  readonly group = new THREE.Group();
  /** Shared bark (landmarks reuse it so their wood matches). */
  readonly barkMat: THREE.MeshStandardMaterial;

  private trunks!: THREE.InstancedMesh;
  private branches!: THREE.InstancedMesh;
  private puffs: THREE.InstancedMesh[] = [];
  private readonly trees: TreeSpec[] = [];
  private heroCount = 0;
  /** puffEnd[v][i]: number of variant-v puffs used by trees 0..i. */
  private puffEnd: number[][] = [[], []];
  private readonly cancels: (() => void)[] = [];
  private readonly loaded: THREE.Texture[] = [];

  constructor(
    field: TrailField,
    terrain: Terrain,
    anchors: readonly LandmarkAnchor[],
    profile: QualityProfile,
    clock: WorldClock,
  ) {
    this.group.name = 'forest';
    this.barkMat = this.makeBark();
    this.placeHeroTrees(field, terrain, anchors, profile);
    this.placeTrees(field, terrain, anchors, profile);
    const tips = this.buildTrunksAndBranches(profile);
    this.buildPuffs(tips, profile, clock);
    this.setTier(profile);
  }

  /** Lower instance counts and toggle shadows without rebuilding. */
  setTier(profile: QualityProfile): void {
    const total = Math.min(this.trees.length, this.heroCount + profile.trees);
    this.trunks.count = total;
    this.branches.count = total * BRANCHES_PER_TREE;
    for (let v = 0; v < this.puffs.length; v++) {
      this.puffs[v].count = total > 0 ? this.puffEnd[v][total - 1] : 0;
    }
    for (const m of [this.trunks, this.branches, ...this.puffs]) m.castShadow = profile.shadows;
    this.trunks.receiveShadow = profile.shadows;
  }

  /** Crown centres of trees standing within `maxLateral` m of the trail. */
  crownsNear(field: TrailField, maxLateral: number): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (const t of this.trees) {
      if (field.distance(t.base.x, t.base.z, maxLateral) <= maxLateral) {
        out.push(t.base.clone().addScaledVector(t.axis, t.height * 0.9));
      }
    }
    return out;
  }

  dispose(): void {
    this.cancels.forEach((c) => c());
    this.loaded.forEach((t) => t.dispose());
  }

  // ------------------------------------------------------------ placement
  private placeHeroTrees(field: TrailField, terrain: Terrain, anchors: readonly LandmarkAnchor[], profile: QualityProfile): void {
    const p = { x: 0, z: 0 };
    const t = { x: 0, z: 1 };
    for (let k = 0; k < profile.heroTreesPerStation; k++) {
      for (const a of anchors) {
        const offset = (k === 0 ? -4 : 8) + Math.random() * 3;
        const u = THREE.MathUtils.clamp(a.t + offset / field.length, 0, 1);
        field.pointAt(u, p);
        field.tangentAt(u, t);
        const side = -a.side;
        for (let attempt = 0; attempt < 6; attempt++) {
          const lat = 7 + Math.random() * 3 + attempt;
          const x = p.x - t.z * side * lat;
          const z = p.z + t.x * side * lat;
          if (field.distance(x, z, 8) < 5.5) continue;
          if (landmarkClearance(anchors, x, z) < 2) continue;
          this.addTree(terrain, x, z, 15 + Math.random() * 4, (1.2 + Math.random() * 0.5) * 2.2, true);
          this.heroCount++;
          break;
        }
      }
    }
  }

  private placeTrees(field: TrailField, terrain: Terrain, anchors: readonly LandmarkAnchor[], profile: QualityProfile): void {
    // Spatial hash so trunks never overlap.
    const cell = 3;
    const grid = new Map<string, TreeSpec[]>();
    const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    const insert = (t: TreeSpec) => {
      const k = key(t.base.x, t.base.z);
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(t);
    };
    this.trees.forEach(insert);
    const crowded = (x: number, z: number, r: number) => {
      const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (const o of grid.get(`${cx + dx},${cz + dz}`) ?? []) {
            const gap = (o.radius + r) * BASE_TRUNK_RADIUS + 0.9;
            if (Math.hypot(o.base.x - x, o.base.z - z) < gap) return true;
          }
        }
      }
      return false;
    };

    let radius = 1;
    // Trees are created inside `accept`, so the returned points are not needed.
    scatterNearTrail(field, profile.trees, {
      latMin: LATERAL_MIN,
      latMax: LATERAL_MAX,
      bias: 1.6,
      maxTries: profile.trees * 12,
      accept: (x, z, lateral) => {
        radius = 0.6 + 1.2 * Math.pow(Math.random(), lateral < 6 ? 2.2 : 1.2);
        if (lateral < CLEARANCE + radius * BASE_TRUNK_RADIUS) return false;
        if (landmarkClearance(anchors, x, z) < 0.5) return false;
        if (crowded(x, z, radius)) return false;
        const h = lateral < 6 ? 8 + Math.random() * 8 : 5 + Math.random() * 11;
        insert(this.addTree(terrain, x, z, h, radius, false));
        return true;
      },
    });
  }

  private addTree(terrain: Terrain, x: number, z: number, height: number, radius: number, hero: boolean): TreeSpec {
    const lean = Math.random() * 0.09;
    const dir = Math.random() * Math.PI * 2;
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.cos(dir) * lean, Math.random() * Math.PI * 2, Math.sin(dir) * lean),
    );
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const sink = 0.3 + radius * 0.1;
    const base = new THREE.Vector3(x, terrain.heightAt(x, z) - sink, z);
    const tint = new THREE.Color();
    if (Math.random() < 0.62) {
      tint.setHSL(0.07 + Math.random() * 0.03, 0.2 + Math.random() * 0.15, 0.32 + Math.random() * 0.16);
    } else {
      // Cool grey-green, lichen-covered bark.
      tint.setHSL(0.18 + Math.random() * 0.07, 0.08 + Math.random() * 0.08, 0.36 + Math.random() * 0.14);
    }
    const t: TreeSpec = { base, axis, quat, height: height + sink, radius, hero, tint };
    this.trees.push(t);
    return t;
  }

  // ------------------------------------------------------------ geometry
  private makeBark(): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      map: barkFallbackTexture(),
      roughness: 0.95,
      metalness: 0,
      color: 0xffffff,
    });
    const setup = (t: THREE.Texture, srgb: boolean) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 4);
      t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    };
    this.cancels.push(
      loadTextureWithFallback('assets/forest/bark/bark_brown_02_diff_1k.jpg', (t) => setup(t, true), (t) => {
        this.loaded.push(t);
        mat.map = t;
        mat.needsUpdate = true;
      }),
      loadTextureWithFallback('assets/forest/bark/bark_brown_02_nor_gl_1k.jpg', (t) => setup(t, false), (t) => {
        this.loaded.push(t);
        mat.normalMap = t;
        mat.needsUpdate = true;
      }),
    );
    return mat;
  }

  private buildTrunksAndBranches(profile: QualityProfile): THREE.Vector3[][] {
    const n = this.trees.length;
    const trunkGeom = new THREE.CylinderGeometry(0.18, BASE_TRUNK_RADIUS, 1, 10, 4, true);
    trunkGeom.translate(0, 0.5, 0);
    // Root flare: widen the bottom ring a little.
    const tp = trunkGeom.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) {
      const y = tp.getY(i);
      if (y < 0.01) { tp.setX(i, tp.getX(i) * 1.35); tp.setZ(i, tp.getZ(i) * 1.35); }
    }
    trunkGeom.computeVertexNormals();
    this.trunks = new THREE.InstancedMesh(trunkGeom, this.barkMat, Math.max(1, n));
    this.trunks.name = 'trunks';

    const branchGeom = new THREE.CylinderGeometry(0.05, 0.12, 1, 6, 1, true);
    branchGeom.translate(0, 0.5, 0);
    this.branches = new THREE.InstancedMesh(branchGeom, this.barkMat, Math.max(1, n * BRANCHES_PER_TREE));
    this.branches.name = 'branches';

    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const anchor = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const tips: THREE.Vector3[][] = [];

    this.trees.forEach((t, i) => {
      s.set(t.radius, t.height, t.radius);
      m.compose(t.base, t.quat, s);
      this.trunks.setMatrixAt(i, m);
      this.trunks.setColorAt(i, t.tint);

      const treeTips: THREE.Vector3[] = [];
      for (let b = 0; b < BRANCHES_PER_TREE; b++) {
        const yFrac = 0.58 + (b / BRANCHES_PER_TREE) * 0.3 + Math.random() * 0.06;
        const az = (b / BRANCHES_PER_TREE) * Math.PI * 2 + Math.random() * 0.9;
        const tilt = THREE.MathUtils.degToRad(35 + Math.random() * 25);
        const len = (1.2 + Math.random() * 1.6 + t.height * 0.1) * (t.hero ? 1.6 : 1);
        dir.set(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)).normalize();
        const r = 0.2 * t.radius;
        anchor.copy(t.base).addScaledVector(t.axis, t.height * yFrac);
        anchor.x += Math.cos(az) * r;
        anchor.z += Math.sin(az) * r;
        q.setFromUnitVectors(up, dir);
        const thick = (0.7 + Math.random() * 0.6) * (t.hero ? 2.4 : Math.max(1, t.radius * 0.8));
        s.set(thick, len, thick);
        m.compose(anchor, q, s);
        this.branches.setMatrixAt(i * BRANCHES_PER_TREE + b, m);
        col.copy(t.tint).multiplyScalar(0.85);
        this.branches.setColorAt(i * BRANCHES_PER_TREE + b, col);
        treeTips.push(anchor.clone().addScaledVector(dir, len));
      }
      tips.push(treeTips);
    });
    for (const im of [this.trunks, this.branches]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = profile.shadows;
      this.group.add(im);
    }
    return tips;
  }

  private buildPuffs(tips: THREE.Vector3[][], profile: QualityProfile, clock: WorldClock): void {
    const geom = makeCrossPlanes(2, 'bottom');
    const leafTex = leafCanopyTexture();
    // Bright tops, and darker undersides: the pale fog backlights the crowns.
    const variants = [0xffffff, 0x8fa37a];
    const plans: { v: number; anchor: THREE.Vector3; radius: number }[][] = this.trees.map((t, i) => {
      const crown = t.base.clone().addScaledVector(t.axis, t.height * 0.92);
      const list: { v: number; anchor: THREE.Vector3; radius: number }[] = [];
      const puffCount = t.hero ? 9 : 6;
      const scale = t.hero ? 1.5 : 1;
      for (let p = 0; p < puffCount; p++) {
        const v = p % 2;
        let anchor: THREE.Vector3;
        let radius: number;
        if (p === 0) {
          anchor = crown.clone();
          radius = 4.2 + Math.random() * 1.5;
        } else if (p <= BRANCHES_PER_TREE) {
          anchor = tips[i][(p - 1) % tips[i].length].clone();
          radius = 2.8 + Math.random() * 1.4;
        } else {
          const tip = tips[i][(p + i) % tips[i].length];
          anchor = new THREE.Vector3().lerpVectors(crown, tip, 0.35 + Math.random() * 0.4);
          anchor.y += Math.random() * 1.5;
          radius = 3.2 + Math.random() * 1.4;
        }
        anchor.x += (Math.random() - 0.5) * 0.6;
        anchor.y += (Math.random() - 0.5) * 0.4 - radius * 0.25;
        anchor.z += (Math.random() - 0.5) * 0.6;
        list.push({ v, anchor, radius: radius * scale });
      }
      return list;
    });

    const counts = [0, 0];
    plans.forEach((list) => list.forEach((p) => counts[p.v]++));
    this.puffs = variants.map((colour, v) => {
      const mat = new THREE.MeshStandardMaterial({
        map: leafTex,
        alphaTest: 0.4,
        alphaToCoverage: profile.alphaToCoverage,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0,
        color: colour,
      });
      applyWindSway(mat, clock, { amp: 0.05, freq: 1.0, anchor: 'bottom' });
      const im = new THREE.InstancedMesh(geom, mat, Math.max(1, counts[v]));
      im.name = `canopy-puffs-${v}`;
      return im;
    });

    const cursor = [0, 0];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const col = new THREE.Color();
    plans.forEach((list) => {
      for (const p of list) {
        s.set(p.radius, p.radius * (0.85 + Math.random() * 0.3), p.radius);
        e.set(0, Math.random() * Math.PI * 2, 0);
        q.setFromEuler(e);
        m.compose(p.anchor, q, s);
        const im = this.puffs[p.v];
        im.setMatrixAt(cursor[p.v], m);
        col.setHSL(0.22 + Math.random() * 0.1, 0.38 + Math.random() * 0.25, (p.v === 1 ? 0.3 : 0.44) + Math.random() * 0.12);
        im.setColorAt(cursor[p.v], col);
        cursor[p.v]++;
      }
      this.puffEnd[0].push(cursor[0]);
      this.puffEnd[1].push(cursor[1]);
    });
    for (const im of this.puffs) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.group.add(im);
    }
  }
}
