import * as THREE from 'three';
import type { QualityProfile } from './quality';

/**
 * Misty-morning light: a pale, low sun slanting through the canopy plus a cool
 * hemisphere fill. On the high tier the sun casts a 2048 shadow map from an
 * orthographic camera that follows the viewer, snapped to whole shadow texels
 * in light space so the shadows do not shimmer as you walk.
 */
const SHADOW_HALF = 22;
const SUN_DISTANCE = 80;

export class Lighting {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  /** Direction the sunlight travels (from the sun toward the ground). */
  readonly sunDir = new THREE.Vector3(0.38, -0.3, -0.87).normalize();
  readonly baseSunIntensity = 1.4;

  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly centre = new THREE.Vector3();
  private shadowSize = 0;

  constructor(scene: THREE.Scene, profile: QualityProfile) {
    this.sun = new THREE.DirectionalLight(0xdfe9f3, this.baseSunIntensity);
    this.sun.name = 'sun';
    this.hemi = new THREE.HemisphereLight(0xcfd9dc, 0x46503f, profile.environment ? 0.6 : 0.85);
    scene.add(this.sun, this.sun.target, this.hemi);

    // Light-space basis for texel snapping.
    this.right.crossVectors(this.sunDir, new THREE.Vector3(0, 1, 0)).normalize();
    this.up.crossVectors(this.right, this.sunDir).normalize();

    const cam = this.sun.shadow.camera;
    cam.left = -SHADOW_HALF; cam.right = SHADOW_HALF;
    cam.top = SHADOW_HALF; cam.bottom = -SHADOW_HALF;
    cam.near = 1; cam.far = SUN_DISTANCE + 60;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.radius = 2;
    this.setShadows(profile.shadows, profile.shadowMapSize);
    this.follow(new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
  }

  /** Keep the shadow frustum centred ~10 m ahead of the camera. */
  follow(camPos: THREE.Vector3, forward: THREE.Vector3): void {
    this.centre.copy(camPos).addScaledVector(forward, 10);
    if (this.shadowSize > 0) {
      const texel = (SHADOW_HALF * 2) / this.shadowSize;
      const a = Math.round(this.centre.dot(this.right) / texel) * texel;
      const b = Math.round(this.centre.dot(this.up) / texel) * texel;
      const c = this.centre.dot(this.sunDir);
      this.centre.set(0, 0, 0)
        .addScaledVector(this.right, a)
        .addScaledVector(this.up, b)
        .addScaledVector(this.sunDir, c);
    }
    this.sun.target.position.copy(this.centre);
    this.sun.position.copy(this.centre).addScaledVector(this.sunDir, -SUN_DISTANCE);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }

  setShadows(enabled: boolean, mapSize: number): void {
    this.sun.castShadow = enabled && mapSize > 0;
    this.shadowSize = this.sun.castShadow ? mapSize : 0;
    if (this.sun.castShadow) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
    } else if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
  }

  dispose(): void {
    this.sun.shadow.map?.dispose();
    this.sun.shadow.dispose();
  }
}
