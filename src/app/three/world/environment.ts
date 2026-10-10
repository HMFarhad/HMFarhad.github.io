import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

/**
 * Async-load the forest HDRI and use it ONLY as image-based lighting
 * (`scene.environment`, low intensity). It is never the background: the sky is
 * the fog colour, so there is no horizon line or blurry photo backdrop.
 *
 * The caller skips this below the high tier, which also saves the 1.9 MB HDR
 * download on phones.
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
    // Do NOT set tex.colorSpace: leave the loader default (forcing it renders
    // near-black under ACES tone mapping).
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const environment = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    tex.dispose();
    if (isDisposed()) { environment.dispose(); return null; }
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.35;
    return () => {
      if (scene.environment === environment.texture) scene.environment = null;
      environment.dispose();
    };
  } catch (err) {
    console.warn('[environment] HDRI failed; lighting without IBL', err);
    return null;
  }
}
