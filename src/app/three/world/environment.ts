import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

/**
 * Async-load HDRI from /assets/forest/env. Sets scene.background AND
 * scene.environment (after PMREM). Falls back to a solid colour on error.
 *
 * The fallback in scene.background should already be set synchronously by
 * the caller before this is awaited so the canvas is never literally black.
 */
export async function applyEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): Promise<void> {
  try {
    const url = new URL('assets/forest/env/forest_slope_1k.hdr', document.baseURI).toString();
    const tex = await new HDRLoader().loadAsync(url);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    // Do NOT set tex.colorSpace — leave the loader default. Forcing it
    // produces near-black output under ACES tone mapping.

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envMap = pmrem.fromEquirectangular(tex).texture;

    scene.background  = tex;
    scene.environment = envMap;
    pmrem.dispose();
  } catch (err) {
    console.warn('[environment] HDRI failed, using fallback colour', err);
    scene.background = new THREE.Color(0x4a5a55);
  }
}
