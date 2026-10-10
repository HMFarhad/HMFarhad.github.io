import * as THREE from 'three';
import type { QualityProfile } from './quality';
import { scatterNearTrail, type TrailField } from './trail-field';
import type { Terrain } from './terrain';
import { landmarkClearance, type LandmarkAnchor } from './landmark-plan';
import { applyWindSway, makeCrossPlanes, type WorldClock } from './cards';
import { bushTexture, fernTexture, grassTexture } from './textures';

/**
 * Ground cover lining the trail: arching fern rosettes, pale tall grass right
 * at the path edge, and a sparser band of leafy shrubs further out. Everything
 * sways; nothing casts or receives shadows (cutout cards acne badly).
 * Bases stay >= 1.3 m from the trail centre so nothing brushes the camera.
 */
const FERN_HEIGHT = 0.55;

export class Undergrowth {
  readonly group = new THREE.Group();
  private readonly ferns: THREE.InstancedMesh;
  private readonly grass: THREE.InstancedMesh;
  private readonly shrubs: THREE.InstancedMesh;

  constructor(
    field: TrailField,
    terrain: Terrain,
    anchors: readonly LandmarkAnchor[],
    profile: QualityProfile,
    clock: WorldClock,
  ) {
    this.group.name = 'undergrowth';
    const clear = (pad: number) => (x: number, z: number) => landmarkClearance(anchors, x, z) > pad;

    // ---- ferns
    const fernPts = scatterNearTrail(field, profile.ferns, {
      latMin: 1.5, latMax: 7, bias: 1.8, accept: clear(-1.5),
    });
    this.ferns = this.instanced(makeFernRosette(), this.cardMaterial(fernTexture(), profile, clock, {
      amp: 0.05, freq: 1.4, anchor: 'bottom', height: FERN_HEIGHT,
    }), fernPts.length, 'ferns');
    this.fill(this.ferns, fernPts, terrain, (p, s, c) => {
      // Smaller near the path so fronds never sprawl across it.
      const size = Math.min(0.7 + Math.random() * 0.7, Math.max(0.55, (p.lateral - 0.6) / 0.9));
      s.set(size, size * (0.85 + Math.random() * 0.35), size);
      c.setHSL(0.22 + Math.random() * 0.08, 0.35 + Math.random() * 0.2, 0.25 + Math.random() * 0.17);
    });

    // ---- grass
    const grassPts = scatterNearTrail(field, profile.grass, {
      latMin: 1.3, latMax: 5, bias: 1.7, accept: clear(-1.0),
    });
    this.grass = this.instanced(makeCrossPlanes(2, 'bottom'), this.cardMaterial(grassTexture(), profile, clock, {
      amp: 0.08, freq: 1.8, anchor: 'bottom',
    }), grassPts.length, 'grass');
    this.fill(this.grass, grassPts, terrain, (_p, s, c) => {
      const h = 0.5 + Math.random() * 0.5;
      const w = 0.6 + Math.random() * 0.45;
      s.set(w, h, w);
      c.setHSL(0.16 + Math.random() * 0.06, 0.25 + Math.random() * 0.15, 0.45 + Math.random() * 0.17);
    });

    // ---- shrubs
    const shrubPts = scatterNearTrail(field, profile.shrubs, {
      latMin: 3.5, latMax: 20, bias: 1.2, accept: clear(0.5),
    });
    this.shrubs = this.instanced(makeCrossPlanes(3, 'bottom'), this.cardMaterial(bushTexture(), profile, clock, {
      amp: 0.03, freq: 1.1, anchor: 'bottom',
    }), shrubPts.length, 'shrubs');
    this.fill(this.shrubs, shrubPts, terrain, (_p, s, c) => {
      const r = 1.2 + Math.random() * 1.4;
      s.set(r, r * (0.6 + Math.random() * 0.35), r);
      c.setHSL(0.24 + Math.random() * 0.06, 0.3 + Math.random() * 0.2, 0.32 + Math.random() * 0.12);
    });

    this.setTier(profile);
  }

  setTier(profile: QualityProfile): void {
    this.ferns.count = Math.min(built(this.ferns), profile.ferns);
    this.grass.count = Math.min(built(this.grass), profile.grass);
    this.shrubs.count = Math.min(built(this.shrubs), profile.shrubs);
  }

  dispose(): void { /* geometry/materials are released by the scene traversal */ }

  private cardMaterial(
    map: THREE.Texture,
    profile: QualityProfile,
    clock: WorldClock,
    sway: Parameters<typeof applyWindSway>[2],
  ): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      map,
      alphaTest: 0.45,
      alphaToCoverage: profile.alphaToCoverage,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
    });
    return applyWindSway(mat, clock, sway);
  }

  private instanced(geom: THREE.BufferGeometry, mat: THREE.Material, count: number, name: string): THREE.InstancedMesh {
    const im = new THREE.InstancedMesh(geom, mat, Math.max(1, count));
    im.count = count;
    im.userData['built'] = count;
    im.name = name;
    im.castShadow = false;
    im.receiveShadow = false;
    this.group.add(im);
    return im;
  }

  private fill(
    im: THREE.InstancedMesh,
    pts: { x: number; z: number; lateral: number }[],
    terrain: Terrain,
    shape: (p: { lateral: number }, scale: THREE.Vector3, colour: THREE.Color) => void,
  ): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const c = new THREE.Color();
    pts.forEach((p, i) => {
      shape(p, s, c);
      pos.set(p.x, terrain.heightAt(p.x, p.z) - 0.04, p.z);
      e.set((Math.random() - 0.5) * 0.12, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.12);
      q.setFromEuler(e);
      m.compose(pos, q, s);
      im.setMatrixAt(i, m);
      im.setColorAt(i, c);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
}

const built = (im: THREE.InstancedMesh): number => (im.userData['built'] as number | undefined) ?? im.count;

/** Seven arching fronds radiating from the base (unit size, ~0.55 tall, ~0.9 reach). */
export function makeFernRosette(fronds = 7): THREE.BufferGeometry {
  const rows = 5;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let f = 0; f < fronds; f++) {
    const theta = (f / fronds) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const reach = 0.75 + Math.random() * 0.25;
    const lift = 0.8 + Math.random() * 0.35;
    const dx = Math.cos(theta), dz = Math.sin(theta);
    const px = -dz, pz = dx;
    const halfW = 0.17;
    const base = positions.length / 3;
    for (let r = 0; r < rows; r++) {
      const s = r / (rows - 1);
      const horiz = reach * 0.9 * s;
      const y = FERN_HEIGHT * lift * Math.sin(Math.min(Math.PI, s * Math.PI * 0.78));
      // Slight roll so fronds do not all face straight up.
      const roll = 0.25 * s;
      for (const side of [-1, 1]) {
        positions.push(dx * horiz + px * halfW * side, y + roll * side * halfW, dz * horiz + pz * halfW * side);
        uvs.push(side < 0 ? 0 : 1, s);
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      const a = base + r * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
