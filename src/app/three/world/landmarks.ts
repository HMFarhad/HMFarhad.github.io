import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Zone, ZoneId } from '../../core/content/zone.model';
import type { QualityProfile } from './quality';
import type { Terrain } from './terrain';
import type { LandmarkAnchor } from './landmark-plan';
import { applyWindSway, makeCrossPlanes, type WorldClock } from './cards';
import { makeFernRosette } from './undergrowth';
import {
  bambooLeafTexture, bambooTexture, fernTexture, flameFramesTexture, leafCanopyTexture,
  mudFallbackTexture, softBlobTexture, stoneTexture, treeRingTexture, waterNormalTexture,
} from './textures';

/**
 * One natural landmark beside the trail at every station, built procedurally
 * and keyed by zone id (never by position in the zone list):
 *
 *   about      ancient giant tree with buttress roots and a hanging lantern
 *   skills     bamboo grove
 *   experience huge fallen log with shelf fungi
 *   projects   shallow stream with stepping stones
 *   education  stack of mossy boulders
 *   blogs      fairy ring of softly glowing mushrooms
 *   contact    campfire ring with log seats
 *
 * The only things raycast are `hitProxies`: invisible spheres carrying
 * `userData.stationIndex`. Each landmark has a soft light that brightens on
 * approach; a small pool of point lights is handed to the nearest landmarks
 * each frame so the number of lights (and so every shader) never changes.
 */
export interface StationLandmarksHandle {
  readonly group: THREE.Group;
  readonly hitProxies: THREE.Mesh[];
  readonly anchors: readonly LandmarkAnchor[];
  update(dt: number, activeIdx: number, progress: number, motion: boolean): void;
  setTier(profile: QualityProfile): void;
  dispose(): void;
}

interface LightSpec {
  /** Moves with the landmark (e.g. the swaying lantern). */
  anchor: THREE.Object3D;
  colour: number;
  intensity: number;
  distance: number;
  flicker?: (time: number) => number;
}

interface FrameState {
  time: number;
  dt: number;
  /** 0 far away .. 1 parked at this station. */
  approach: number;
  /** Manual distance fade for fog-less additive effects. */
  fade: number;
  motion: boolean;
}

interface Built {
  light: LightSpec;
  proxy: { centre: THREE.Vector3; radius: number };
  update?: (s: FrameState) => void;
}

interface Ctx {
  anchor: LandmarkAnchor;
  /** Positioned at the anchor, local +Z facing the trail. */
  root: THREE.Group;
  /** World-space group (identity transform). */
  world: THREE.Group;
  terrain: Terrain;
  clock: WorldClock;
  time: { value: number };
  profile: QualityProfile;
  camera: THREE.Camera;
  bark: (params?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  solid: <T extends THREE.Mesh>(mesh: T) => T;
  /** Terrain height at a local (x, z), relative to the anchor height. */
  groundY: (lx: number, lz: number) => number;
}

type Builder = (ctx: Ctx) => Built;

const BUILDERS: Record<ZoneId, Builder> = {
  about: buildGiantTree,
  skills: buildBambooGrove,
  experience: buildFallenLog,
  projects: buildStream,
  education: buildBoulders,
  blogs: buildMushroomRing,
  contact: buildCampfire,
};

export function buildStationLandmarks(
  zones: readonly Zone[],
  anchors: readonly LandmarkAnchor[],
  stationProgress: readonly number[],
  terrain: Terrain,
  barkMat: THREE.MeshStandardMaterial,
  clock: WorldClock,
  profile: QualityProfile,
  camera: THREE.Camera,
): StationLandmarksHandle {
  const group = new THREE.Group();
  group.name = 'landmarks';
  const time = { value: 0 };
  const barkVariants: THREE.MeshStandardMaterial[] = [];
  const solids: THREE.Mesh[] = [];
  const hitProxies: THREE.Mesh[] = [];
  const stations: { built: Built; root: THREE.Group; centre: THREE.Vector3 }[] = [];
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

  zones.forEach((zone, i) => {
    const anchor = anchors[i];
    const root = new THREE.Group();
    root.name = `landmark-${zone.id}`;
    root.position.set(anchor.x, anchor.y, anchor.z);
    root.rotation.y = anchor.facing;
    root.updateMatrixWorld(true);
    group.add(root);
    const tmp = new THREE.Vector3();
    const ctx: Ctx = {
      anchor, root, world: group, terrain, clock, time, profile, camera,
      bark: (params) => {
        const m = new THREE.MeshStandardMaterial({
          map: barkMat.map, normalMap: barkMat.normalMap,
          roughness: 0.95, metalness: 0, vertexColors: true, ...params,
        });
        barkVariants.push(m);
        return m;
      },
      solid: (mesh) => {
        mesh.castShadow = profile.shadows;
        mesh.receiveShadow = profile.shadows;
        solids.push(mesh);
        return mesh;
      },
      groundY: (lx, lz) => {
        tmp.set(lx, 0, lz);
        root.localToWorld(tmp);
        return terrain.heightAt(tmp.x, tmp.z) - anchor.y;
      },
    };
    const built = BUILDERS[zone.id](ctx);
    root.updateMatrixWorld(true);

    const proxy = new THREE.Mesh(new THREE.SphereGeometry(built.proxy.radius, 12, 8), proxyMat);
    proxy.position.copy(root.localToWorld(built.proxy.centre.clone()));
    proxy.userData['stationIndex'] = i;
    proxy.name = `landmark-proxy-${zone.id}`;
    group.add(proxy);
    hitProxies.push(proxy);
    stations.push({ built, root, centre: proxy.position.clone() });
  });

  // Pooled lights handed to the nearest landmarks.
  const pool = Array.from({ length: Math.max(1, profile.landmarkLights) }, (_, k) => {
    const l = new THREE.PointLight(0xffffff, 0, 12, 2);
    l.name = `landmark-light-${k}`;
    group.add(l);
    return l;
  });
  const lightPos = stations.map(() => new THREE.Vector3());
  const order = stations.map((_, i) => i);
  const camDist = new Float32Array(stations.length);
  const approachOf = new Float32Array(stations.length);

  return {
    group,
    hitProxies,
    anchors,
    update(dt, activeIdx, progress, motion) {
      if (motion) time.value += dt;
      for (const m of barkVariants) {
        if (m.map !== barkMat.map || m.normalMap !== barkMat.normalMap) {
          m.map = barkMat.map;
          m.normalMap = barkMat.normalMap;
          m.needsUpdate = true;
        }
      }
      const cam = camera.position;
      stations.forEach((s, i) => {
        const dP = Math.abs(progress - (stationProgress[i] ?? 0));
        const approach = 1 - THREE.MathUtils.smoothstep(dP, 0.004, 0.06);
        const dist = cam.distanceTo(s.centre);
        approachOf[i] = approach;
        s.built.update?.({
          time: time.value, dt, approach, motion,
          fade: 1 - THREE.MathUtils.smoothstep(dist, 30, 75),
        });
        s.built.light.anchor.getWorldPosition(lightPos[i]);
        camDist[i] = cam.distanceTo(lightPos[i]);
      });
      order.sort((a, b) => camDist[a] - camDist[b]);
      pool.forEach((light, k) => {
        const i = order[k];
        if (i === undefined) { light.intensity = 0; return; }
        const spec = stations[i].built.light;
        light.position.copy(lightPos[i]);
        light.color.setHex(spec.colour);
        light.distance = spec.distance;
        const flicker = spec.flicker ? spec.flicker(time.value) : 1;
        const far = 1 - THREE.MathUtils.smoothstep(camDist[i], 30, 60);
        light.intensity = spec.intensity * (0.25 + 0.75 * approachOf[i]) * (i === activeIdx ? 1 : 0.7) * flicker * far;
      });
    },
    setTier(p) {
      for (const m of solids) { m.castShadow = p.shadows; m.receiveShadow = p.shadows; }
    },
    dispose() {
      proxyMat.dispose();
    },
  };
}

// =================================================================== helpers
function seeded(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/** Lumpy rock: smooth-shaded, displaced icosphere with box-projected UVs. */
function makeRock(seed: number, detail = 2, rough = 0.22): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1
      + rough * Math.sin(x * 2.9 + seed) * Math.sin(y * 2.3 + seed * 1.3) * Math.sin(z * 3.1 + seed * 0.7)
      + 0.07 * Math.sin(x * 7.1 + y * 5.3 + seed) + 0.04 * Math.sin(z * 9.7 - y * 6.1 + seed * 2);
    const flat = y < -0.4 ? 0.75 : 1; // flatter underside sits on the ground
    pos.setXYZ(i, x * k, y * k * flat, z * k);
    uv[i * 2] = (x + z) * 0.6;
    uv[i * 2 + 1] = y * 0.6;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Vertex colours: moss on upward-facing surfaces, `base` elsewhere. */
function paintMoss(
  g: THREE.BufferGeometry,
  opts: { base?: THREE.Color; moss?: THREE.Color; threshold?: number; extra?: (p: THREE.Vector3, n: THREE.Vector3) => number },
): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  const base = opts.base ?? new THREE.Color(1, 1, 1);
  const moss = opts.moss ?? new THREE.Color(0.42, 0.56, 0.27);
  const th = opts.threshold ?? 0.35;
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);
    const noise = 0.5 + 0.5 * Math.sin(p.x * 4.1 + p.z * 3.3) * Math.sin(p.y * 3.7 - p.x * 1.9);
    let m = THREE.MathUtils.smoothstep(n.y + (noise - 0.5) * 0.5, th, th + 0.35);
    if (opts.extra) m = Math.max(m, opts.extra(p, n));
    c.copy(base).lerp(moss, THREE.MathUtils.clamp(m, 0, 1));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function glowSprite(colour: number, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softBlobTexture(),
    color: colour,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
    opacity: 0,
  }));
  s.scale.setScalar(size);
  s.renderOrder = 6;
  return s;
}

function leafCardMaterial(map: THREE.Texture, profile: QualityProfile, colour = 0xffffff): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map, color: colour, alphaTest: 0.45, alphaToCoverage: profile.alphaToCoverage,
    side: THREE.DoubleSide, roughness: 0.85, metalness: 0,
  });
}

function placeInstances(
  im: THREE.InstancedMesh,
  items: { pos: THREE.Vector3; quat?: THREE.Quaternion; scale: THREE.Vector3; colour?: THREE.Color }[],
): void {
  const m = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  items.forEach((it, i) => {
    m.compose(it.pos, it.quat ?? q0, it.scale);
    im.setMatrixAt(i, m);
    if (it.colour) im.setColorAt(i, it.colour);
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
}

function addFerns(ctx: Ctx, parent: THREE.Object3D, spots: { x: number; y: number; z: number; s: number }[]): void {
  if (!spots.length) return;
  const mat = leafCardMaterial(fernTexture(), ctx.profile);
  applyWindSway(mat, ctx.clock, { amp: 0.05, freq: 1.4, anchor: 'bottom', height: 0.55 });
  const im = new THREE.InstancedMesh(makeFernRosette(), mat, spots.length);
  const rnd = seeded(spots.length * 7 + 3);
  placeInstances(im, spots.map((p) => ({
    pos: new THREE.Vector3(p.x, p.y - 0.04, p.z),
    quat: new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * Math.PI * 2),
    scale: new THREE.Vector3(p.s, p.s, p.s),
    colour: new THREE.Color().setHSL(0.22 + rnd() * 0.08, 0.4, 0.28 + rnd() * 0.12),
  })));
  parent.add(im);
}

// ======================================================== about: giant tree
function buildGiantTree(ctx: Ctx): Built {
  const { root, profile } = ctx;
  const rnd = seeded(11);
  const trunkZ = -1.6;
  const H = 24;
  const trunkGeom = new THREE.CylinderGeometry(1.0, 1.7, H, 22, 18, true);
  trunkGeom.translate(0, H / 2, 0);
  const pos = trunkGeom.getAttribute('position') as THREE.BufferAttribute;
  const uv = trunkGeom.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    let k = 1 + 0.09 * Math.sin(a * 5 + y * 0.25) + 0.05 * Math.sin(a * 11 - y * 0.6) + 0.03 * Math.sin(y * 1.7 + a * 3);
    if (y < 3.5) k *= 1 + Math.pow((3.5 - y) / 3.5, 2) * 0.5;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
    uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 2);
  }
  trunkGeom.computeVertexNormals();
  paintMoss(trunkGeom, { threshold: 0.6, extra: (p) => THREE.MathUtils.clamp((5 - p.y) / 5, 0, 1) * (0.45 + 0.35 * Math.sin(Math.atan2(p.z, p.x) * 3 + p.y)) });
  const bark = ctx.bark();
  const trunk = ctx.solid(new THREE.Mesh(trunkGeom, bark));
  trunk.position.set(0, -0.4, trunkZ);
  root.add(trunk);

  // Buttress roots.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(2.6, 0);
  shape.quadraticCurveTo(0.9, 0.35, 0, 2.9);
  shape.lineTo(0, 0);
  const finGeom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, curveSegments: 10,
  });
  finGeom.translate(1.05, 0, -0.17);
  finGeom.computeVertexNormals();
  paintMoss(finGeom, { threshold: 0.45, extra: (p) => 0.35 * THREE.MathUtils.clamp(1 - p.y / 2.5, 0, 1) });
  for (let k = 0; k < 6; k++) {
    const fin = ctx.solid(new THREE.Mesh(finGeom, bark));
    const s = 0.8 + rnd() * 0.35;
    fin.scale.set(s, 0.85 + rnd() * 0.3, 1);
    fin.rotation.y = (k / 6) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
    fin.position.set(0, -0.35, trunkZ);
    root.add(fin);
  }

  // Thick limbs and a broad crown.
  const limbGeom = new THREE.CylinderGeometry(0.12, 0.3, 1, 8, 1, true);
  limbGeom.translate(0, 0.5, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const crownSpots: THREE.Vector3[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rnd();
    const y = 10 + rnd() * 6;
    const dir = new THREE.Vector3(Math.cos(a), 0.6 + rnd() * 0.5, Math.sin(a)).normalize();
    const len = 5 + rnd() * 3;
    const limb = ctx.solid(new THREE.Mesh(limbGeom, bark));
    limb.position.set(0, y, trunkZ);
    limb.quaternion.setFromUnitVectors(up, dir);
    limb.scale.set(1.6, len, 1.6);
    root.add(limb);
    crownSpots.push(new THREE.Vector3(0, y, trunkZ).addScaledVector(dir, len));
  }
  const crownMat = leafCardMaterial(leafCanopyTexture(), profile, 0xa9bb8f);
  applyWindSway(crownMat, ctx.clock, { amp: 0.03, freq: 0.6, anchor: 'bottom' });
  const crown = new THREE.InstancedMesh(makeCrossPlanes(2, 'bottom'), crownMat, 8);
  crown.castShadow = profile.shadows;
  placeInstances(crown, Array.from({ length: 8 }, (_, k) => {
    const base = k < crownSpots.length ? crownSpots[k] : new THREE.Vector3((rnd() - 0.5) * 4, 19 + rnd() * 3, trunkZ + (rnd() - 0.5) * 4);
    const r = 6 + rnd() * 2.5;
    return {
      pos: base.clone().add(new THREE.Vector3(0, -r * 0.3, 0)),
      quat: new THREE.Quaternion().setFromAxisAngle(up, rnd() * Math.PI),
      scale: new THREE.Vector3(r, r * 0.8, r),
      colour: new THREE.Color().setHSL(0.24 + rnd() * 0.05, 0.4, 0.38 + rnd() * 0.1),
    };
  }));
  root.add(crown);

  // Low limb reaching over toward the trail, with a lantern hanging from it.
  const branchStart = new THREE.Vector3(0, 4.2, trunkZ + 1.0);
  const branchDir = new THREE.Vector3(0.15, 0.22, 1).normalize();
  const branchLen = 3.1;
  const branch = ctx.solid(new THREE.Mesh(limbGeom, bark));
  branch.position.copy(branchStart);
  branch.quaternion.setFromUnitVectors(up, branchDir);
  branch.scale.set(0.75, branchLen, 0.75);
  root.add(branch);
  const tip = branchStart.clone().addScaledVector(branchDir, branchLen - 0.2);

  const pivot = new THREE.Group();
  pivot.position.copy(tip);
  root.add(pivot);
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.6, metalness: 0.6 });
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25, 4), new THREE.MeshStandardMaterial({ color: 0x6b5a40, roughness: 1 }));
  rope.position.y = -0.62;
  const body = new THREE.Group();
  body.position.y = -1.45;
  const glass = new THREE.MeshStandardMaterial({
    color: 0xffe2b0, emissive: 0xffb46b, emissiveIntensity: 2.2, roughness: 0.3, transparent: true, opacity: 0.92, depthWrite: false,
  });
  // Thin corner posts so the glowing glass stays visible from every side.
  const frame = new THREE.Group();
  const postGeom = new THREE.BoxGeometry(0.022, 0.4, 0.022);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const post = new THREE.Mesh(postGeom, metal);
    post.position.set(Math.cos(a) * 0.185, 0, Math.sin(a) * 0.185);
    frame.add(post);
  }
  const pane = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.36, 6), glass);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.18, 6), metal);
  cap.position.y = 0.29;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 6), metal);
  foot.position.y = -0.21;
  const glow = glowSprite(0xffc27a, 1.8);
  const lightAnchor = new THREE.Object3D();
  body.add(frame, pane, cap, foot, glow, lightAnchor);
  pivot.add(rope, body);

  return {
    light: {
      anchor: lightAnchor, colour: 0xffb46b, intensity: 6, distance: 16,
      flicker: (t) => 0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 7.3),
    },
    proxy: { centre: new THREE.Vector3(0, 2.6, trunkZ + 0.6), radius: 3.4 },
    update: (s) => {
      pivot.rotation.z = Math.sin(s.time * 1.1) * 0.07;
      pivot.rotation.x = Math.sin(s.time * 0.8 + 1) * 0.05;
      const f = 0.9 + 0.1 * Math.sin(s.time * 13) * Math.sin(s.time * 7.3);
      glass.emissiveIntensity = 2.2 * f;
      glow.material.opacity = 0.5 * f * s.fade * (0.5 + 0.5 * s.approach);
    },
  };
}

// ======================================================= skills: bamboo
function buildBambooGrove(ctx: Ctx): Built {
  const { root, profile } = ctx;
  const rnd = seeded(23);
  const culmGeom = new THREE.CylinderGeometry(0.045, 0.055, 1, 7, 1, true);
  culmGeom.translate(0, 0.5, 0);
  const culmMat = new THREE.MeshStandardMaterial({ map: bambooTexture(), roughness: 0.55, metalness: 0 });
  applyWindSway(culmMat, ctx.clock, { amp: 0.022, freq: 0.9, anchor: 'bottom' });
  const clumps = [new THREE.Vector2(-1.7, -1.3), new THREE.Vector2(1.0, -1.9), new THREE.Vector2(0.1, -0.2)];
  const N = 48;
  const culms = new THREE.InstancedMesh(culmGeom, culmMat, N);
  const tufts: { pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3; colour: THREE.Color }[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const items = Array.from({ length: N }, (_, k) => {
    const c = clumps[k % clumps.length];
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 1.25;
    const x = c.x + Math.cos(a) * r;
    const z = Math.min(1.0, c.y + Math.sin(a) * r);
    const h = 6 + rnd() * 5;
    const lean = 0.03 + rnd() * 0.09;
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * lean, 0, -Math.cos(a) * lean));
    const thick = 0.9 + rnd() * 0.5;
    const pos = new THREE.Vector3(x, ctx.groundY(x, z) - 0.1, z);
    const axis = up.clone().applyQuaternion(quat);
    for (const f of [0.74, 0.93]) {
      const s = 1.5 + rnd() * 0.9;
      tufts.push({
        pos: pos.clone().addScaledVector(axis, h * f),
        quat: new THREE.Quaternion().setFromAxisAngle(up, rnd() * Math.PI),
        scale: new THREE.Vector3(s, s * 0.9, s),
        colour: new THREE.Color().setHSL(0.2 + rnd() * 0.05, 0.4, 0.4 + rnd() * 0.12),
      });
    }
    return { pos, quat, scale: new THREE.Vector3(thick, h, thick), colour: new THREE.Color().setHSL(0.2 + rnd() * 0.04, 0.3, 0.55 + rnd() * 0.2) };
  });
  placeInstances(culms, items);
  ctx.solid(culms);
  root.add(culms);

  const leafMat = leafCardMaterial(bambooLeafTexture(), profile);
  applyWindSway(leafMat, ctx.clock, { amp: 0.09, freq: 0.9, anchor: 'uniform' });
  const leaves = new THREE.InstancedMesh(makeCrossPlanes(2, 'center'), leafMat, tufts.length);
  placeInstances(leaves, tufts);
  leaves.castShadow = profile.shadows;
  root.add(leaves);

  const lightAnchor = new THREE.Object3D();
  lightAnchor.position.set(0, 2.2, 0.6);
  root.add(lightAnchor);
  return {
    light: { anchor: lightAnchor, colour: 0xe2f0d2, intensity: 3, distance: 12 },
    proxy: { centre: new THREE.Vector3(-0.2, 2.4, -1.1), radius: 3.2 },
  };
}

// ================================================= experience: fallen log
function buildFallenLog(ctx: Ctx): Built {
  const { root } = ctx;
  const rnd = seeded(37);
  const L = 9;
  const logGroup = new THREE.Group();
  logGroup.position.set(0, ctx.groundY(0, -0.8) + 0.55, -0.8);
  logGroup.rotation.y = 0.12;
  root.add(logGroup);

  const geom = new THREE.CylinderGeometry(0.62, 0.78, L, 18, 12, false);
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const uv = geom.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.06 * Math.sin(a * 6 + y * 0.8) + 0.04 * Math.sin(y * 2.3 + a * 2);
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
    uv.setXY(i, uv.getX(i) * 1.5, uv.getY(i));
  }
  geom.rotateZ(Math.PI / 2);
  geom.computeVertexNormals();
  paintMoss(geom, { threshold: 0.3 });
  const ends = new THREE.MeshStandardMaterial({ map: treeRingTexture(), roughness: 0.9 });
  const log = ctx.solid(new THREE.Mesh(geom, [ctx.bark(), ends, ends]));
  logGroup.add(log);

  // Root plate at the thick end (+x).
  let plateGeom: THREE.BufferGeometry = new THREE.SphereGeometry(1, 16, 12);
  plateGeom.deleteAttribute('normal');
  plateGeom = mergeVertices(plateGeom);
  const pp = plateGeom.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
    const k = 1 + 0.18 * Math.sin(y * 5 + z * 3) * Math.sin(z * 4 - y * 2);
    pp.setXYZ(i, x * 0.4, y * 1.75 * k, z * 1.85 * k);
  }
  plateGeom.computeVertexNormals();
  const soil = new THREE.MeshStandardMaterial({ map: mudFallbackTexture(), color: 0xb19a7a, roughness: 1 });
  const plate = ctx.solid(new THREE.Mesh(plateGeom, soil));
  plate.position.set(L / 2 + 0.2, 0.55, 0);
  logGroup.add(plate);
  const rootGeom = new THREE.CylinderGeometry(0.03, 0.08, 1, 5, 1, true);
  rootGeom.translate(0, 0.5, 0);
  const rootMat = ctx.bark({ vertexColors: false, color: 0x6a5642 });
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + rnd() * 0.5;
    const r = new THREE.Mesh(rootGeom, rootMat);
    r.position.set(L / 2 + 0.3, 0.55 + Math.sin(a) * 1.25, Math.cos(a) * 1.35);
    // Roots curl back toward the log rather than spiking outward.
    const dir = new THREE.Vector3(0.55 + rnd() * 0.4, Math.sin(a) * 0.6, Math.cos(a) * 0.6).normalize();
    r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    r.scale.set(0.8, 0.45 + rnd() * 0.5, 0.8);
    logGroup.add(r);
  }

  // Shelf fungi on the trail-facing flank.
  const fungusGeom = new THREE.CylinderGeometry(1, 1, 0.14, 16, 1, false, 0, Math.PI);
  fungusGeom.rotateY(-Math.PI / 2);
  const fungi = new THREE.InstancedMesh(fungusGeom, new THREE.MeshStandardMaterial({ roughness: 0.75 }), 10);
  const fungusCols = [0xe2d3ae, 0xcdb88a, 0xd9a865, 0xeadfc4];
  const fungusItems = Array.from({ length: 10 }, (_, k) => {
    const x = -3.6 + (k / 9) * 7 + (rnd() - 0.5) * 0.4;
    const r = THREE.MathUtils.lerp(0.62, 0.78, (x + L / 2) / L);
    const phi = -0.3 + rnd() * 0.85 + (k % 3 === 1 ? 0.25 : 0);
    const s = 0.14 + rnd() * 0.16;
    return {
      pos: new THREE.Vector3(x, r * Math.sin(phi), r * Math.cos(phi) - 0.04),
      scale: new THREE.Vector3(s, 0.6 + rnd() * 0.5, s * 0.9),
      colour: new THREE.Color(fungusCols[k % fungusCols.length]),
    };
  });
  placeInstances(fungi, fungusItems);
  ctx.solid(fungi);
  logGroup.add(fungi);

  addFerns(ctx, root, [
    { x: -3.2, y: ctx.groundY(-3.2, -2.2), z: -2.2, s: 1.1 },
    { x: 2.4, y: ctx.groundY(2.4, -2.3), z: -2.3, s: 1.0 },
    { x: -4.8, y: ctx.groundY(-4.8, 0.2), z: 0.2, s: 0.8 },
  ]);

  const lightAnchor = new THREE.Object3D();
  lightAnchor.position.set(0, 2.2, 0.9);
  root.add(lightAnchor);
  return {
    light: { anchor: lightAnchor, colour: 0xffe6c4, intensity: 3.5, distance: 12 },
    proxy: { centre: new THREE.Vector3(0, 1.0, -0.8), radius: 3.6 },
  };
}

// ==================================================== projects: stream
function buildStream(ctx: Ctx): Built {
  const { root, world, terrain, anchor } = ctx;
  const rnd = seeded(41);
  const pts = (anchor.stream ?? []).map((p) => new THREE.Vector3(p.x, 0, p.z));
  const lightAnchor = new THREE.Object3D();
  lightAnchor.position.set(0, 2.5, 0.5);
  root.add(lightAnchor);
  if (pts.length < 2) {
    return { light: { anchor: lightAnchor, colour: 0xd6ecff, intensity: 2.5, distance: 12 }, proxy: { centre: new THREE.Vector3(0, 0.8, 0), radius: 3.2 } };
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const S = 80;
  const samples = curve.getSpacedPoints(S);
  const across = [0, 0.2, 0.5, 0.8, 1];
  const edgeAlpha = [0, 0.85, 1, 0.85, 0];
  const positions: number[] = [];
  const colours: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const tan = new THREE.Vector3();
  let arc = 0;
  const waterY: number[] = [];
  for (let i = 0; i <= S; i++) {
    const c = samples[i];
    const f = i / S;
    curve.getTangentAt(f, tan);
    const nx = -tan.z, nz = tan.x;
    const taper = THREE.MathUtils.smoothstep(f, 0, 0.1) * (1 - THREE.MathUtils.smoothstep(f, 0.9, 1));
    const halfW = 1.3 * (0.35 + 0.65 * taper);
    const y = terrain.heightAt(c.x, c.z) + 0.16;
    waterY.push(y);
    if (i > 0) arc += c.distanceTo(samples[i - 1]);
    across.forEach((v, k) => {
      const o = (v - 0.5) * 2 * halfW;
      positions.push(c.x + nx * o, y, c.z + nz * o);
      colours.push(1, 1, 1, edgeAlpha[k] * taper);
      uvs.push(arc / 2.5, v);
    });
  }
  const row = across.length;
  for (let i = 0; i < S; i++) {
    for (let k = 0; k < row - 1; k++) {
      const a = i * row + k, b = a + 1, c = a + row, d = c + 1;
      // Counter-clockwise seen from above (normal +Y; the front face is up).
      indices.push(a, b, c, b, d, c);
    }
  }
  const waterGeom = new THREE.BufferGeometry();
  waterGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  waterGeom.setAttribute('color', new THREE.Float32BufferAttribute(colours, 4));
  waterGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  waterGeom.setIndex(indices);
  waterGeom.computeVertexNormals();
  const ripple = waterNormalTexture();
  ripple.repeat.set(1, 1);
  const water = new THREE.Mesh(waterGeom, new THREE.MeshStandardMaterial({
    color: 0x56706c,
    // A faint pale sheen stands in for sky reflection on tiers without IBL.
    emissive: 0x9fb3b4,
    emissiveIntensity: 0.22,
    roughness: 0.1,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
    vertexColors: true,
    normalMap: ripple,
    normalScale: new THREE.Vector2(0.45, 0.45),
    depthWrite: false,
    envMapIntensity: 1.4,
  }));
  water.renderOrder = 1;
  water.name = 'stream-water';
  world.add(water);

  // Stepping stones across the middle, and a few rocks along the banks.
  const mid = Math.round(S / 2);
  const c = samples[mid];
  curve.getTangentAt(mid / S, tan);
  const nx = -tan.z, nz = tan.x;
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTexture(), vertexColors: true, roughness: 0.9 });
  const stoneGeom = paintMoss(makeRock(5, 1, 0.18), { threshold: 0.7, moss: new THREE.Color(0.5, 0.6, 0.35) });
  const stoneItems: { pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 }[] = [];
  for (let k = 0; k < 5; k++) {
    const o = -1.55 + k * 0.78;
    const x = c.x + nx * o + tan.x * (rnd() - 0.5) * 0.35;
    const z = c.z + nz * o + tan.z * (rnd() - 0.5) * 0.35;
    stoneItems.push({
      pos: new THREE.Vector3(x, Math.max(waterY[mid], terrain.heightAt(x, z)) + 0.02, z),
      quat: new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * Math.PI),
      scale: new THREE.Vector3(0.32 + rnd() * 0.08, 0.16 + rnd() * 0.05, 0.27 + rnd() * 0.06),
    });
  }
  for (let k = 0; k < 7; k++) {
    const i = Math.floor(8 + rnd() * (S - 16));
    curve.getTangentAt(i / S, tan);
    const side = rnd() < 0.5 ? -1 : 1;
    const o = side * (1.35 + rnd() * 0.5);
    const x = samples[i].x - tan.z * o, z = samples[i].z + tan.x * o;
    const s = 0.2 + rnd() * 0.35;
    stoneItems.push({
      pos: new THREE.Vector3(x, terrain.heightAt(x, z) + s * 0.25, z),
      quat: new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * Math.PI),
      scale: new THREE.Vector3(s, s * 0.6, s * 0.9),
    });
  }
  const stones = new THREE.InstancedMesh(stoneGeom, stoneMat, stoneItems.length);
  placeInstances(stones, stoneItems);
  ctx.solid(stones);
  world.add(stones);

  // Ferns on the banks.
  const fernSpots: { x: number; y: number; z: number; s: number }[] = [];
  for (let k = 0; k < 12; k++) {
    const i = Math.floor(4 + rnd() * (S - 8));
    curve.getTangentAt(i / S, tan);
    const side = rnd() < 0.5 ? -1 : 1;
    const o = side * (2.1 + rnd() * 1.2);
    const x = samples[i].x - tan.z * o, z = samples[i].z + tan.x * o;
    // Never on the trail side within the path.
    const toTrail = Math.hypot(x - anchor.x, z - anchor.z);
    if (toTrail > 12) continue;
    fernSpots.push({ x, y: terrain.heightAt(x, z), z, s: 0.8 + rnd() * 0.5 });
  }
  addFerns(ctx, world, fernSpots);

  return {
    light: { anchor: lightAnchor, colour: 0xd6ecff, intensity: 2.5, distance: 12 },
    proxy: { centre: new THREE.Vector3(0, 0.8, 0), radius: 3.2 },
    update: (s) => {
      ripple.offset.x = -s.time * 0.16;
      ripple.offset.y = Math.sin(s.time * 0.3) * 0.05;
    },
  };
}

// ================================================= education: boulders
function buildBoulders(ctx: Ctx): Built {
  const { root } = ctx;
  const rnd = seeded(53);
  const mat = new THREE.MeshStandardMaterial({ map: stoneTexture(), vertexColors: true, roughness: 0.95, metalness: 0 });
  const stack: [number, number, number, number, number, number][] = [
    [0, 0.55, -0.6, 1.5, 1.1, 1.35],
    [1.75, 0.35, -1.3, 1.1, 0.85, 1.0],
    [-1.6, 0.4, -1.1, 1.2, 0.9, 1.1],
    [0.35, 1.75, -0.85, 0.95, 0.75, 0.9],
    [-0.7, 1.35, -1.55, 0.8, 0.65, 0.8],
    [0.15, 2.55, -0.95, 0.55, 0.45, 0.5],
  ];
  stack.forEach(([x, y, z, sx, sy, sz], k) => {
    const g = paintMoss(makeRock(k * 3.7 + 1, 3, 0.2), { threshold: 0.25 });
    const m = ctx.solid(new THREE.Mesh(g, mat));
    m.position.set(x, ctx.groundY(x, z) + y - 0.15, z);
    m.scale.set(sx, sy, sz);
    m.rotation.y = rnd() * Math.PI * 2;
    root.add(m);
  });
  // Small scattered rocks.
  const small = new THREE.InstancedMesh(paintMoss(makeRock(99, 1, 0.2), { threshold: 0.4 }), mat, 6);
  placeInstances(small, Array.from({ length: 6 }, () => {
    const a = rnd() * Math.PI * 2, r = 2.6 + rnd() * 1.2;
    const x = Math.cos(a) * r, z = Math.min(1.2, -0.8 + Math.sin(a) * r);
    const s = 0.18 + rnd() * 0.25;
    return { pos: new THREE.Vector3(x, ctx.groundY(x, z) + s * 0.2, z), scale: new THREE.Vector3(s, s * 0.7, s) };
  }));
  ctx.solid(small);
  root.add(small);
  addFerns(ctx, root, [
    { x: 2.6, y: ctx.groundY(2.6, -0.2), z: -0.2, s: 1.0 },
    { x: -2.7, y: ctx.groundY(-2.7, -0.1), z: -0.1, s: 1.2 },
    { x: 0.9, y: ctx.groundY(0.9, -2.8), z: -2.8, s: 0.9 },
  ]);
  const lightAnchor = new THREE.Object3D();
  lightAnchor.position.set(0.8, 2.3, 0.9);
  root.add(lightAnchor);
  return {
    light: { anchor: lightAnchor, colour: 0xe6eef8, intensity: 2.5, distance: 11 },
    proxy: { centre: new THREE.Vector3(0, 1.4, -0.9), radius: 2.8 },
  };
}

// ================================================ blogs: mushroom ring
function buildMushroomRing(ctx: Ctx): Built {
  const { root } = ctx;
  const rnd = seeded(67);
  const centre = new THREE.Vector3(0, 0, -0.6);
  const spots: { x: number; z: number; h: number; r: number }[] = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + (rnd() - 0.5) * 0.2;
    const rr = 2.4 + (rnd() - 0.5) * 0.35;
    spots.push({ x: centre.x + Math.cos(a) * rr, z: centre.z + Math.sin(a) * rr, h: 0.16 + rnd() * 0.2, r: 0.1 + rnd() * 0.09 });
    if (rnd() < 0.5) {
      spots.push({ x: centre.x + Math.cos(a + 0.08) * (rr + 0.18), z: centre.z + Math.sin(a + 0.08) * (rr + 0.18), h: 0.09 + rnd() * 0.08, r: 0.05 + rnd() * 0.04 });
    }
  }
  const stemGeom = new THREE.CylinderGeometry(0.035, 0.05, 1, 7);
  stemGeom.translate(0, 0.5, 0);
  const stems = new THREE.InstancedMesh(stemGeom, new THREE.MeshStandardMaterial({
    color: 0xe8e4d6, emissive: 0x2f5a4c, emissiveIntensity: 0.6, roughness: 0.7,
  }), spots.length);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xdfe8d6, emissive: 0x7fe0c0, emissiveIntensity: 1.2, roughness: 0.55 });
  capMat.onBeforeCompile = (shader) => {
    shader.uniforms['uLTime'] = ctx.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uLTime;
varying float vPulse;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec2 pulseOrigin = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
#else
  vec2 pulseOrigin = vec2(modelMatrix[3].x, modelMatrix[3].z);
#endif
vPulse = 0.55 + 0.45 * sin(uLTime * 1.4 + dot(pulseOrigin, vec2(3.1, 2.3)));`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vPulse;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance *= vPulse;`);
  };
  capMat.customProgramCacheKey = () => 'mushroom-pulse-v1';
  const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), capMat, spots.length);
  const capCols = [0xdfe8d6, 0xe9e2c8, 0xd2e6dc];
  placeInstances(stems, spots.map((s) => ({
    pos: new THREE.Vector3(s.x, ctx.groundY(s.x, s.z) - 0.02, s.z),
    scale: new THREE.Vector3(s.r * 6, s.h, s.r * 6),
  })));
  placeInstances(caps, spots.map((s, k) => ({
    pos: new THREE.Vector3(s.x, ctx.groundY(s.x, s.z) - 0.03 + s.h, s.z),
    quat: new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3)),
    scale: new THREE.Vector3(s.r, s.r * 0.6, s.r),
    colour: new THREE.Color(capCols[k % capCols.length]),
  })));
  root.add(stems, caps);

  const glow = glowSprite(0x8fe8cc, 6);
  glow.position.set(centre.x, ctx.groundY(centre.x, centre.z) + 0.4, centre.z);
  root.add(glow);
  const lightAnchor = new THREE.Object3D();
  lightAnchor.position.set(centre.x, 0.6, centre.z);
  root.add(lightAnchor);
  const pulse = (t: number) => 0.75 + 0.25 * Math.sin(t * 1.4);
  return {
    light: { anchor: lightAnchor, colour: 0x8fe8cc, intensity: 4, distance: 10, flicker: pulse },
    proxy: { centre: new THREE.Vector3(centre.x, 0.6, centre.z), radius: 2.9 },
    update: (s) => {
      glow.material.opacity = 0.16 * pulse(s.time) * s.fade * (0.4 + 0.6 * s.approach);
    },
  };
}

// ================================================== contact: campfire
function buildCampfire(ctx: Ctx): Built {
  const { root } = ctx;
  const rnd = seeded(79);
  const cz = -0.4;
  const g0 = ctx.groundY(0, cz);
  const fire = new THREE.Group();
  fire.position.set(0, g0, cz);
  root.add(fire);

  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0xb9b6ad, roughness: 0.95 });
  const ring = new THREE.InstancedMesh(makeRock(13, 1, 0.2), stoneMat, 11);
  placeInstances(ring, Array.from({ length: 11 }, (_, k) => {
    const a = (k / 11) * Math.PI * 2;
    const s = 0.2 + rnd() * 0.08;
    return {
      pos: new THREE.Vector3(Math.cos(a) * 0.74, s * 0.35, Math.sin(a) * 0.74),
      quat: new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * Math.PI),
      scale: new THREE.Vector3(s * 1.2, s * 0.8, s),
    };
  }));
  ctx.solid(ring);
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.64, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
    color: 0x2b2622, emissive: 0x3a1204, emissiveIntensity: 0.6, roughness: 1,
  }));
  ash.position.y = 0.03;
  fire.add(ring, ash);

  // Teepee of sticks.
  const stickGeom = new THREE.CylinderGeometry(0.045, 0.06, 1, 6);
  stickGeom.translate(0, 0.5, 0);
  const charred = new THREE.MeshStandardMaterial({ color: 0x3b2f25, roughness: 1, emissive: 0x5a1e05, emissiveIntensity: 0.5 });
  const apex = new THREE.Vector3(0, 0.82, 0);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rnd() * 0.3;
    const base = new THREE.Vector3(Math.cos(a) * 0.42, 0.02, Math.sin(a) * 0.42);
    const dir = apex.clone().sub(base);
    const len = dir.length() * 1.08;
    const stick = new THREE.Mesh(stickGeom, charred);
    stick.position.copy(base);
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    stick.scale.set(1, len, 1);
    fire.add(stick);
  }

  // Log seats, leaving the trail-facing side open.
  const ends = new THREE.MeshStandardMaterial({ map: treeRingTexture(), roughness: 0.9 });
  const seatGeom = new THREE.CylinderGeometry(0.24, 0.26, 1.7, 14, 1, false);
  const sp = seatGeom.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) sp.setX(i, sp.getX(i) * 1.5);
  seatGeom.rotateZ(Math.PI / 2);
  paintMoss(seatGeom, { threshold: 0.75 });
  const seatBark = ctx.bark();
  for (const deg of [112, 180, 248]) {
    const th = THREE.MathUtils.degToRad(deg);
    const x = Math.sin(th) * 2.1, z = cz + Math.cos(th) * 2.1;
    const seat = ctx.solid(new THREE.Mesh(seatGeom, [seatBark, ends, ends]));
    seat.position.set(x, ctx.groundY(x, z) + 0.2, z);
    seat.rotation.y = th + (rnd() - 0.5) * 0.2;
    root.add(seat);
  }

  // Flames: two crossed flipbook cards, additive, fog-less, faded by hand.
  const flameGeom = makeCrossPlanes(2, 'bottom');
  const flames = [0, 1].map((k) => {
    const tex = flameFramesTexture().clone();
    tex.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, fog: false, toneMapped: false, opacity: 0,
    });
    const mesh = new THREE.Mesh(flameGeom, mat);
    mesh.position.y = 0.08;
    mesh.rotation.y = k * Math.PI / 4;
    mesh.scale.set(k ? 0.7 : 0.95, k ? 1.0 : 1.35, k ? 0.7 : 0.95);
    mesh.renderOrder = 7;
    fire.add(mesh);
    return { mesh, tex, mat, phase: k * 2 };
  });
  const glow = glowSprite(0xffa45c, 3.2);
  glow.position.y = 0.6;
  fire.add(glow);

  // Rising embers.
  const EMBERS = 40;
  const seeds = new Float32Array(EMBERS * 3);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
  const emberGeom = new THREE.BufferGeometry();
  emberGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3));
  emberGeom.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const emberMat = new THREE.ShaderMaterial({
    uniforms: { uTime: ctx.time, uFade: { value: 0 } },
    vertexShader: EMBER_VERT,
    fragmentShader: EMBER_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const embers = new THREE.Points(emberGeom, emberMat);
  embers.frustumCulled = false;
  embers.renderOrder = 8;
  embers.position.y = 0.3;
  fire.add(embers);

  const lightAnchor = new THREE.Object3D();
  lightAnchor.position.set(0, 0.75, 0);
  fire.add(lightAnchor);
  const flicker = (t: number) => 0.82 + 0.18 * (Math.sin(t * 17) * 0.5 + Math.sin(t * 9.7 + 1) * 0.3 + Math.sin(t * 23.3) * 0.2);
  return {
    light: { anchor: lightAnchor, colour: 0xff9a4a, intensity: 10, distance: 14, flicker },
    proxy: { centre: new THREE.Vector3(0, 0.8, cz), radius: 2.6 },
    update: (s) => {
      const f = flicker(s.time);
      for (const fl of flames) {
        const frame = Math.floor(s.time * 11 + fl.phase) % 4;
        fl.tex.offset.x = frame / 4;
        fl.mat.opacity = s.fade * (0.8 + 0.2 * f);
      }
      glow.material.opacity = 0.35 * f * s.fade;
      emberMat.uniforms['uFade'].value = s.fade;
    },
  };
}

const EMBER_VERT = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform float uFade;
varying float vAlpha;
void main() {
  float life = fract(aSeed.x + uTime * 0.3 * (0.6 + aSeed.y));
  vec3 p = vec3(
    sin(life * 6.0 + aSeed.z * 6.28) * 0.28 * life,
    life * 3.2,
    cos(life * 5.0 + aSeed.y * 6.28) * 0.28 * life);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((1.0 - life) * 60.0 / max(-mv.z, 0.5), 1.0, 6.0);
  vAlpha = (1.0 - life) * uFade;
}`;

const EMBER_FRAG = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(1.0, 0.62, 0.3, a);
}`;
