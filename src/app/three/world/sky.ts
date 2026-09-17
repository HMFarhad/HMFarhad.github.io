import * as THREE from 'three';

/**
 * Soft warm key light + low ambient. The HDRI environment does most of
 * the heavy lifting via PMREM + scene.environment.
 */
export function buildLighting(scene: THREE.Scene): THREE.DirectionalLight {
  const key = new THREE.DirectionalLight(0xffe0ae, 1.15);
  key.position.set(40, 50, 18);
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xd4e4d3, 0x303629, 0.65));
  return key;
}
