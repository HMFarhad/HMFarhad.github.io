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
  renderer: THREE.WebGLRenderer,
  isDisposed: () => boolean = () => false,
): Promise<(() => void) | null> {
  try {
    const url = new URL('assets/forest/env/forest_slope_1k.hdr', document.baseURI).toString();
    const tex = await new HDRLoader().loadAsync(url);
    if (isDisposed()) { tex.dispose(); return null; }
    tex.mapping = THREE.EquirectangularReflectionMapping;
    // Do NOT set tex.colorSpace — leave the loader default. Forcing it
    // produces near-black output under ACES tone mapping.

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const environment = pmrem.fromEquirectangular(tex);

    scene.background  = tex;
    scene.environment = environment.texture;
    scene.backgroundIntensity = 0.85;
    scene.environmentIntensity = 0.8;
    scene.backgroundBlurriness = 0.04;
    pmrem.dispose();
    return () => { tex.dispose(); environment.dispose(); };
  } catch (err) {
    console.warn('[environment] HDRI failed, using fallback colour', err);
    if (!isDisposed()) scene.background = new THREE.Color(0x6a7468);
    return null;
  }
}
