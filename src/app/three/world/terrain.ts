import * as THREE from 'three';
import type { QualityProfile } from './quality';
import type { TrailField } from './trail-field';
import { distanceToPolyline, type LandmarkAnchor } from './landmark-plan';
import { floorTexture, loadTextureWithFallback, mudFallbackTexture, noiseTexture } from './textures';

/**
 * Rolling forest-floor heightfield with the trail worn into it.
 *
 * - Low-frequency hills (about +/-1.9 m) plus fine bumps away from the trail.
 * - Flattened crosswise within 1.4-5.5 m of the trail centre (path sunk 0.08 m).
 * - Flat pads under every landmark anchor, and a carved bed for the stream.
 * - `heightAt()` interpolates the very triangles that are rendered, so every
 *   placement sits exactly on the visible surface.
 *
 * Trail and floor are one mesh: the fragment shader blends a leaf-litter floor
 * into trodden mud using a per-vertex `trailDist` attribute and a value-noise
 * ragged edge, all tiled in world XZ.
 */
export const TRAIL_HALF_WIDTH = 1.4;
const FLATTEN_OUTER = 5.5;
const TRAIL_SINK = 0.08;
const EDGE_MARGIN = 120;
const MIN_SIZE = 360;

export class Terrain {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly size: number;

  private readonly x0: number;
  private readonly z0: number;
  private readonly segs: number;
  private readonly step: number;
  private readonly heights: Float32Array;
  private readonly floorUniforms = {
    uMud: { value: mudFallbackTexture() as THREE.Texture },
    uNoise: { value: noiseTexture() as THREE.Texture },
    uTrailWidth: { value: TRAIL_HALF_WIDTH },
    uMudTint: { value: new THREE.Color(0.92, 0.86, 0.8) },
  };
  private readonly loaded: THREE.Texture[] = [];
  private readonly cancels: (() => void)[] = [];

  constructor(field: TrailField, anchors: readonly LandmarkAnchor[], profile: QualityProfile) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < field.count; i++) {
      minX = Math.min(minX, field.xs[i]); maxX = Math.max(maxX, field.xs[i]);
      minZ = Math.min(minZ, field.zs[i]); maxZ = Math.max(maxZ, field.zs[i]);
    }
    this.size = Math.max(MIN_SIZE, Math.max(maxX - minX, maxZ - minZ) + EDGE_MARGIN * 2);
    this.segs = profile.terrainSegments;
    this.step = this.size / this.segs;
    this.x0 = (minX + maxX) / 2 - this.size / 2;
    this.z0 = (minZ + maxZ) / 2 - this.size / 2;

    const n = this.segs + 1;
    this.heights = new Float32Array(n * n);
    const trailDist = new Float32Array(n * n);

    // Pad heights are the trail-blended surface at each anchor centre.
    const padHeight = anchors.map((a) => this.surfaceHeight(field, a.x, a.z).h);

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = this.x0 + i * this.step;
        const z = this.z0 + j * this.step;
        const s = this.surfaceHeight(field, x, z);
        let h = s.h;
        for (let k = 0; k < anchors.length; k++) {
          const a = anchors[k];
          const dA = Math.hypot(x - a.x, z - a.z);
          if (dA < a.padRadius + 2.5) {
            h = THREE.MathUtils.lerp(padHeight[k], h, smoothstep(a.padRadius, a.padRadius + 2.5, dA));
          }
          if (a.stream && dA < 18) {
            const c = distanceToPolyline(a.stream, x, z);
            const endTaper = smoothstep(0, 0.12, c.f) * smoothstep(1, 0.88, c.f);
            h -= 0.55 * (1 - smoothstep(1.1, 3.4, c.d)) * endTaper;
          }
        }
        // Keep the walking surface exactly where the camera expects it.
        if (s.d < 2.6) h = THREE.MathUtils.lerp(s.trailH, h, smoothstep(TRAIL_HALF_WIDTH, 2.6, s.d));
        this.heights[j * n + i] = h;
        trailDist[j * n + i] = Math.min(s.d, 20);
      }
    }
    for (const a of anchors) a.y = this.heightAt(a.x, a.z);

    this.mesh = new THREE.Mesh(this.buildGeometry(trailDist), this.buildMaterial());
    this.mesh.receiveShadow = profile.shadows;
    this.mesh.name = 'terrain';
  }

  /** Height of the rendered surface at world (x, z). */
  heightAt(x: number, z: number): number {
    const n = this.segs + 1;
    const fx = THREE.MathUtils.clamp((x - this.x0) / this.step, 0, this.segs - 1e-6);
    const fz = THREE.MathUtils.clamp((z - this.z0) / this.step, 0, this.segs - 1e-6);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const h00 = this.heights[j * n + i];
    const h10 = this.heights[j * n + i + 1];
    const h01 = this.heights[(j + 1) * n + i];
    const h11 = this.heights[(j + 1) * n + i + 1];
    // Same diagonal split as the index buffer below.
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  setTier(profile: QualityProfile): void {
    this.mesh.receiveShadow = profile.shadows;
  }

  dispose(): void {
    this.cancels.forEach((c) => c());
    this.loaded.forEach((t) => t.dispose());
    this.loaded.length = 0;
  }

  // ------------------------------------------------------------------ shape
  private surfaceHeight(field: TrailField, x: number, z: number): { h: number; trailH: number; d: number } {
    const near = field.nearest(x, z, FLATTEN_OUTER + 0.5);
    const natural = baseHeight(x, z);
    if (!near) return { h: natural + fineHeight(x, z), trailH: natural, d: 99 };
    const trailH = baseHeight(near.x, near.z) - TRAIL_SINK;
    const d = near.distance;
    const rough = natural + fineHeight(x, z) * smoothstep(1.0, 4.0, d);
    return { h: THREE.MathUtils.lerp(trailH, rough, smoothstep(TRAIL_HALF_WIDTH, FLATTEN_OUTER, d)), trailH, d };
  }

  private buildGeometry(trailDist: Float32Array): THREE.BufferGeometry {
    const n = this.segs + 1;
    const pos = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = this.x0 + i * this.step, z = this.z0 + j * this.step;
        pos[k * 3] = x;
        pos[k * 3 + 1] = this.heights[k];
        pos[k * 3 + 2] = z;
        // World-space UVs: one floor tile per 3 m, no visible repeat grid.
        uv[k * 2] = x / 3;
        uv[k * 2 + 1] = z / 3;
      }
    }
    const index = new Uint32Array(this.segs * this.segs * 6);
    let o = 0;
    for (let j = 0; j < this.segs; j++) {
      for (let i = 0; i < this.segs; i++) {
        const a = j * n + i, b = (j + 1) * n + i, c = j * n + i + 1, d = (j + 1) * n + i + 1;
        index[o++] = a; index[o++] = b; index[o++] = c;
        index[o++] = b; index[o++] = d; index[o++] = c;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('trailDist', new THREE.BufferAttribute(trailDist, 1));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }

  // --------------------------------------------------------------- material
  private buildMaterial(): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      map: floorTexture(),
      roughness: 1,
      metalness: 0,
      color: 0xffffff,
    });
    const uniforms = this.floorUniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
attribute float trailDist;
varying float vTrailDist;
varying vec2 vGroundXZ;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vTrailDist = trailDist;
vGroundXZ = position.xz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D uMud;
uniform sampler2D uNoise;
uniform float uTrailWidth;
uniform vec3 uMudTint;
varying float vTrailDist;
varying vec2 vGroundXZ;`)
        .replace('#include <map_fragment>', `
#ifdef USE_MAP
  float nLarge = texture2D(uNoise, vGroundXZ * 0.019).r;
  float nEdge = texture2D(uNoise, vGroundXZ * 0.12 + vec2(0.37, 0.11)).r;
  // Two scales of the floor texture blended by noise hide any tiling.
  vec4 floorA = texture2D(map, vMapUv);
  vec4 floorB = texture2D(map, vMapUv * 0.37 + vec2(0.31, 0.77));
  vec4 floorCol = mix(floorA, floorB, smoothstep(0.38, 0.62, nLarge));
  floorCol.rgb *= 0.78 + 0.4 * nLarge;
  vec4 mudCol = texture2D(uMud, vMapUv * 0.8);
  mudCol.rgb *= uMudTint;
  float edge = uTrailWidth + (nEdge - 0.5) * 1.2;
  float trailMask = 1.0 - smoothstep(edge - 0.5, edge + 0.3, vTrailDist);
  // A few leaves scattered onto the path.
  trailMask *= 1.0 - 0.35 * smoothstep(0.6, 0.85, texture2D(uNoise, vGroundXZ * 0.5).r);
  diffuseColor *= mix(floorCol, mudCol, trailMask);
#endif`);
    };
    mat.customProgramCacheKey = () => 'forest-terrain-v1';

    const base = 'assets/forest/';
    const repeat = (t: THREE.Texture, srgb: boolean) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    };
    const keep = (t: THREE.Texture) => { this.loaded.push(t); return t; };
    this.cancels.push(
      loadTextureWithFallback(base + 'floor/forest_leaves_02_diff_1k.jpg', (t) => repeat(t, true), (t) => {
        mat.map = keep(t);
        mat.needsUpdate = true;
      }),
      loadTextureWithFallback(base + 'ground/mud_forest_diff_1k.jpg', (t) => repeat(t, true), (t) => {
        uniforms.uMud.value = keep(t);
      }),
      loadTextureWithFallback(base + 'ground/mud_forest_nor_gl_1k.jpg', (t) => repeat(t, false), (t) => {
        mat.normalMap = keep(t);
        mat.normalScale.set(0.7, 0.7);
        mat.needsUpdate = true;
      }),
      loadTextureWithFallback(base + 'ground/mud_forest_arm_1k.jpg', (t) => repeat(t, false), (t) => {
        // three r0.184 reads aoMap from uv channel 0 here (the old ground set uv2,
        // which this version ignores).
        t.channel = 0;
        mat.aoMap = keep(t);
        mat.aoMapIntensity = 0.8;
        mat.roughnessMap = t;
        mat.needsUpdate = true;
      }),
    );
    return mat;
  }
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Low-frequency hills, roughly +/-1.9 m. */
function baseHeight(x: number, z: number): number {
  return 0.95 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.4)
    + 0.55 * Math.sin(x * 0.043 - z * 0.031 + 2.1)
    + 0.38 * Math.sin(z * 0.052 + x * 0.014 + 0.7);
}

/** Small bumps and hummocks, only away from the trail. */
function fineHeight(x: number, z: number): number {
  return 0.13 * Math.sin(x * 0.37 + z * 0.21) * Math.sin(z * 0.41 - x * 0.17)
    + 0.06 * Math.sin(x * 0.83 - z * 0.61 + 1.7);
}
