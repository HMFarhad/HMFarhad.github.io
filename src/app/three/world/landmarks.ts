import * as THREE from 'three';
import type { Zone } from '../../core/content/zone.model';

/**
 * One stylised primitive group per zone, positioned at the station progress
 * along the curve. Every descendant gets `userData.stationIndex` so the
 * raycaster can attribute hits.
 */
export function buildStationLandmarks(
  zones: Zone[],
  stationProgress: number[],
  curve: THREE.CatmullRomCurve3
): THREE.Group {
  const root = new THREE.Group();

  zones.forEach((zone, idx) => {
    const p  = curve.getPointAt(stationProgress[idx] ?? idx / Math.max(1, zones.length - 1));
    const tan = curve.getTangentAt(stationProgress[idx] ?? idx / Math.max(1, zones.length - 1));
    const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    // park the landmark on the right side, off the trail
    const offset = side.clone().multiplyScalar(3.5);

    const group = makeLandmark(zone.id);
    group.position.set(p.x + offset.x, 0, p.z + offset.z);
    group.lookAt(p.x, group.position.y, p.z); // face the trail

    group.traverse((o) => { o.userData['stationIndex'] = idx; });
    root.add(group);
  });

  return root;
}

function makeLandmark(id: string): THREE.Group {
  const g = new THREE.Group();
  const mat = (color: number, rough = 0.6) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });

  switch (id) {
    case 'about': {
      // dais
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.3, 24), mat(0x9aa28a));
      base.position.y = 0.15;
      g.add(base);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), mat(0xe6dcb6, 0.3));
      orb.position.y = 0.85;
      g.add(orb);
      break;
    }
    case 'education': {
      // stacked slabs
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(1.4 - i * 0.2, 0.18, 0.9 - i * 0.1), mat(0xb0a586));
        s.position.y = 0.09 + i * 0.20;
        g.add(s);
      }
      break;
    }
    case 'skills': {
      // pillar + geode
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 12), mat(0x8a8e7a));
      pillar.position.y = 0.8;
      g.add(pillar);
      const geo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), mat(0x7fb6c7, 0.25));
      geo.position.y = 1.85;
      g.add(geo);
      break;
    }
    case 'experience': {
      // big tree (tall)
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 10), mat(0x5a4632, 0.95));
      trunk.position.y = 1.5;
      g.add(trunk);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), mat(0x547035, 0.85));
      leaves.position.y = 3.4;
      g.add(leaves);
      break;
    }
    case 'projects': {
      // three lamps
      for (let i = -1; i <= 1; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), mat(0x444444));
        post.position.set(i * 0.7, 0.8, 0);
        g.add(post);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12),
          new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffd070, emissiveIntensity: 1.2, roughness: 0.4 }));
        lamp.position.set(i * 0.7, 1.65, 0);
        g.add(lamp);
      }
      break;
    }
    case 'blogs': {
      // book slabs
      for (let i = 0; i < 4; i++) {
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.5), mat(0x8a5a3a));
        book.position.y = 0.04 + i * 0.10;
        book.rotation.y = (Math.random() - 0.5) * 0.4;
        g.add(book);
      }
      break;
    }
    case 'contact': {
      // cantilever beacon
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), mat(0x444444));
      post.position.y = 1.2;
      g.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), mat(0x444444));
      arm.position.set(0.4, 2.3, 0);
      g.add(arm);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xff8a55, emissive: 0xff7040, emissiveIntensity: 1.4 }));
      beacon.position.set(0.85, 2.3, 0);
      g.add(beacon);
      break;
    }
    default: {
      const fallback = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(0xaaaaaa));
      fallback.position.y = 0.5;
      g.add(fallback);
    }
  }
  return g;
}
