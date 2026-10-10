import * as THREE from 'three';
import type { QualityProfile } from './quality';
import type { TrailField } from './trail-field';
import type { Terrain } from './terrain';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWindSway, makeCrossPlanes, type WorldClock } from './cards';
import { leafCanopyTexture, vineTexture } from './textures';

/**
 * What is overhead: broad, dark leaf cards spanning the trail (so the path is
 * a tunnel under the canopy, and on the high tier they throw dappled shade on
 * it) and vines hanging from them.
 *
 * Clearances: card centres are high enough that the lowest corner of a tilted
 * card stays >= 6.5 m above the trail; vine tips stay >= 3 m above the ground.
 * Instances are ordered by a golden-ratio sequence along the trail so any
 * prefix (a lower tier) is still evenly spread.
 */
const GOLDEN = 0.618033988749895;

export class Canopy {
  readonly group = new THREE.Group();
  private readonly cards: THREE.InstancedMesh;
  private readonly vines: THREE.InstancedMesh;

  /**
   * @param crowns crown centres of trees near the trail; each overhang layer
   *   reaches out from the nearest one so it reads as that tree's foliage.
   */
  constructor(field: TrailField, terrain: Terrain, profile: QualityProfile, clock: WorldClock, crowns: readonly THREE.Vector3[] = []) {
    this.group.name = 'canopy';
    const p = { x: 0, z: 0 };
    const t = { x: 0, z: 1 };
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const c = new THREE.Color();

    // ---- overhang cards
    // A horizontal leaf layer plus two crossed vertical half-height planes, so
    // the overhang has body from any angle instead of reading as a flat raft
    // when seen edge-on from below.
    const flat = new THREE.PlaneGeometry(1, 1);
    flat.rotateX(-Math.PI / 2);
    const vA = new THREE.PlaneGeometry(1, 0.45);
    const vB = new THREE.PlaneGeometry(1, 0.45);
    vB.rotateY(Math.PI / 2);
    const cardGeom = mergeGeometries([flat, vA, vB], false)!;
    [flat, vA, vB].forEach((g) => g.dispose());
    const cardMat = new THREE.MeshStandardMaterial({
      map: leafCanopyTexture(),
      // Dark (0x6b7d59 family) because it is seen from below, but close
      // enough to the crown puffs that it reads as the same foliage.
      color: 0x7d8f68,
      alphaTest: 0.45,
      alphaToCoverage: profile.alphaToCoverage,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
    });
    applyWindSway(cardMat, clock, { amp: 0.025, freq: 0.7, anchor: 'uniform' });
    const nCards = profile.canopyCards;
    this.cards = new THREE.InstancedMesh(cardGeom, cardMat, Math.max(1, nCards));
    this.cards.name = 'canopy-cards';
    for (let i = 0; i < nCards; i++) {
      const u = (i * GOLDEN + 0.13) % 1;
      field.pointAt(u, p);
      field.tangentAt(u, t);
      const lat = (Math.random() - 0.5) * 7;
      let x = p.x - t.z * lat, z = p.z + t.x * lat;
      // Lean the layer toward the nearest crown beside the trail.
      let crownY = NaN;
      let best = 12 * 12;
      for (const c of crowns) {
        const d2 = (c.x - p.x) ** 2 + (c.z - p.z) ** 2;
        if (d2 < best) { best = d2; crownY = c.y; x = p.x + (c.x - p.x) * 0.45; z = p.z + (c.z - p.z) * 0.45; }
      }
      const w = 5 + Math.random() * 4, d = 4 + Math.random() * 3;
      const tilt = (Math.random() - 0.5) * 0.3;
      const roll = (Math.random() - 0.5) * 0.3;
      const vh = 2.2 + Math.random() * 1.4;
      // Lowest point: a tilted corner, or the bottom of the vertical planes.
      const lowest = 0.5 * Math.max(w, d) * Math.sin(Math.max(Math.abs(tilt), Math.abs(roll))) + vh * 0.225;
      const trailY = terrain.heightAt(p.x, p.z);
      const wanted = Number.isFinite(crownY) ? crownY - trailY - 0.5 + Math.random() : 7.5 + Math.random() * 5;
      const up = Math.max(wanted, 6.5 + lowest + 0.15);
      pos.set(x, trailY + up, z);
      e.set(tilt, Math.random() * Math.PI * 2, roll);
      q.setFromEuler(e);
      s.set(w, vh, d);
      m.compose(pos, q, s);
      this.cards.setMatrixAt(i, m);
      c.setHSL(0.22 + Math.random() * 0.1, 0.38 + Math.random() * 0.22, 0.36 + Math.random() * 0.14);
      this.cards.setColorAt(i, c);
    }
    this.finish(this.cards);

    // ---- hanging vines
    const vineMat = new THREE.MeshStandardMaterial({
      map: vineTexture(),
      alphaTest: 0.45,
      alphaToCoverage: profile.alphaToCoverage,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
    });
    applyWindSway(vineMat, clock, { amp: 0.6, freq: 0.9, anchor: 'top' });
    const nVines = profile.vines;
    this.vines = new THREE.InstancedMesh(makeCrossPlanes(2, 'top'), vineMat, Math.max(1, nVines));
    this.vines.name = 'vines';
    for (let i = 0; i < nVines; i++) {
      const u = (i * GOLDEN + 0.41) % 1;
      field.pointAt(u, p);
      field.tangentAt(u, t);
      const side = Math.random() < 0.5 ? -1 : 1;
      const lat = 1.4 + Math.random() * 3.6;
      const x = p.x - t.z * side * lat, z = p.z + t.x * side * lat;
      const ground = terrain.heightAt(x, z);
      const top = 7 + Math.random() * 3;
      const len = 1.5 + Math.random() * Math.max(0.1, top - 3 - 1.5);
      pos.set(x, ground + top, z);
      e.set(0, Math.random() * Math.PI, 0);
      q.setFromEuler(e);
      s.set(0.45, len, 0.45);
      m.compose(pos, q, s);
      this.vines.setMatrixAt(i, m);
      c.setHSL(0.24 + Math.random() * 0.05, 0.3 + Math.random() * 0.15, 0.4 + Math.random() * 0.12);
      this.vines.setColorAt(i, c);
    }
    this.finish(this.vines);
    this.setTier(profile);
  }

  setTier(profile: QualityProfile): void {
    this.cards.count = Math.min(this.cards.instanceMatrix.count, profile.canopyCards);
    this.vines.count = Math.min(this.vines.instanceMatrix.count, profile.vines);
    this.cards.castShadow = profile.shadows;
  }

  dispose(): void { /* released by the scene traversal */ }

  private finish(im: THREE.InstancedMesh): void {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.receiveShadow = false;
    this.group.add(im);
  }
}
