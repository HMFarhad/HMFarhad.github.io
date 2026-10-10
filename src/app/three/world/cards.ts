import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Shared helpers for alpha-cutout "card" foliage: crossed-plane geometry and
 * a wind-sway vertex patch driven by one world clock.
 */

/** Shared time uniform; reduced motion simply stops advancing it. */
export interface WorldClock { time: { value: number }; }

export function createWorldClock(): WorldClock {
  return { time: { value: 0 } };
}

export type CardAnchor = 'bottom' | 'top' | 'center';

/**
 * `count` unit planes crossed around the Y axis. 'bottom' puts the base at
 * y = 0 (y in 0..1), 'top' hangs the card from y = 0 (y in -1..0).
 */
export function makeCrossPlanes(count: 2 | 3, anchor: CardAnchor = 'bottom'): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateY((i * Math.PI) / count);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  if (anchor === 'bottom') merged.translate(0, 0.5, 0);
  if (anchor === 'top') merged.translate(0, -0.5, 0);
  return merged;
}

export type SwayMode = 'bottom' | 'top' | 'uniform';

export interface SwayOptions {
  /** Displacement amplitude in the geometry's local units. */
  amp: number;
  /** Angular speed multiplier. */
  freq: number;
  /** 'bottom': base fixed, tip moves; 'top': hangs from the top; 'uniform': whole card drifts. */
  anchor: SwayMode;
  /** Local height over which the mask ramps from 0 to 1 (default 1). */
  height?: number;
}

/**
 * Patch a built-in material with a wind sway. The per-instance phase comes
 * from `instanceMatrix[3].xz` (the instance's own position) under
 * USE_INSTANCING; `modelMatrix` is only used for plain meshes, because for an
 * InstancedMesh it is the same for every instance. Chains any existing
 * onBeforeCompile. The shadow depth pass does not sway (accepted).
 */
export function applyWindSway<T extends THREE.Material>(material: T, clock: WorldClock, opts: SwayOptions): T {
  const prev = material.onBeforeCompile;
  // Capture the previous key now: once onBeforeCompile is replaced the default
  // key (its source text) would no longer identify the earlier patch.
  const prevKey = material.customProgramCacheKey();
  const uniforms = {
    uSwayAmp: { value: opts.amp },
    uSwayFreq: { value: opts.freq },
    uSwayHeight: { value: opts.height ?? 1 },
  };
  const mask =
    opts.anchor === 'bottom' ? 'pow(clamp(position.y / uSwayHeight, 0.0, 1.0), 2.0)' :
    opts.anchor === 'top' ? 'pow(clamp(-position.y / uSwayHeight, 0.0, 1.0), 1.6)' :
    '1.0';
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.uniforms['uWindTime'] = clock.time;
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uWindTime;
uniform float uSwayAmp;
uniform float uSwayFreq;
uniform float uSwayHeight;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
#ifdef USE_INSTANCING
  vec2 swayOrigin = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
#else
  vec2 swayOrigin = vec2(modelMatrix[3].x, modelMatrix[3].z);
#endif
  float swayPhase = dot(swayOrigin, vec2(0.173, 0.119));
  float swayMask = ${mask};
  float swayT = uWindTime * uSwayFreq;
  transformed.x += (sin(swayT + swayPhase) + 0.35 * sin(swayT * 2.3 + swayPhase * 1.7)) * uSwayAmp * swayMask;
  transformed.z += cos(swayT * 0.83 + swayPhase * 1.3) * uSwayAmp * 0.7 * swayMask;
}`);
  };
  material.customProgramCacheKey = () => `sway-${opts.anchor}|${prevKey}`;
  return material;
}

/** Fill instance colours from an HSL generator. */
export function setInstanceColours(
  mesh: THREE.InstancedMesh,
  colour: (i: number, out: THREE.Color) => void,
): void {
  const c = new THREE.Color();
  for (let i = 0; i < mesh.count; i++) {
    colour(i, c);
    mesh.setColorAt(i, c);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
