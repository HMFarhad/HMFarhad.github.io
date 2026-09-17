import * as THREE from 'three';

/**
 * PBR ground plane using mud_forest set from Poly Haven. Built lazily so the
 * scene has a valid floor immediately even before textures resolve.
 */
export function buildGround(size = 400): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(size, size);
  geom.rotateX(-Math.PI / 2);
  // aoMap requires uv2.
  geom.setAttribute('uv2', geom.getAttribute('uv'));

  const mat = new THREE.MeshStandardMaterial({
    color: 0x9d9b77,
    roughness: 1,
    metalness: 0
  });

  const loader = new THREE.TextureLoader();
  let disposed = false;
  mat.addEventListener('dispose', () => { disposed = true; });
  const base   = 'assets/forest/ground/';

  const setupTex = (
    file: string,
    target: 'map' | 'normalMap' | 'arm',
    onReady: (t: THREE.Texture) => void
  ) => {
    const url = new URL(base + file, document.baseURI).toString();
    loader.load(url, (t) => {
      if (disposed) { t.dispose(); return; }
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(54, 54);
      t.anisotropy = 8;
      if (target === 'map') t.colorSpace = THREE.SRGBColorSpace;
      onReady(t);
    });
  };

  setupTex('mud_forest_diff_1k.jpg',   'map',       (t) => { mat.map         = t; mat.needsUpdate = true; });
  setupTex('mud_forest_nor_gl_1k.jpg', 'normalMap', (t) => { mat.normalMap   = t; mat.needsUpdate = true; });
  setupTex('mud_forest_arm_1k.jpg',    'arm',       (t) => {
    mat.aoMap        = t;
    mat.roughnessMap = t;
    mat.metalnessMap = t;
    mat.needsUpdate  = true;
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.y = -0.05;
  mesh.receiveShadow = true;
  return mesh;
}
