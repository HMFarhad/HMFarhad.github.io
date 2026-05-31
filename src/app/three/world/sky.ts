import * as THREE from 'three';

/**
 * Soft warm key light + low ambient. The HDRI environment does most of
 * the heavy lifting via PMREM + scene.environment.
 */
export function buildLighting(scene: THREE.Scene): THREE.DirectionalLight {
  const key = new THREE.DirectionalLight(0xfff1d4, 0.7);
  key.position.set(40, 50, 18);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x6a7268, 0.18));
  return key;
}
