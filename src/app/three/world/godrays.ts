import * as THREE from 'three';

/**
 * 6 additive billboard "shaft" planes scattered along the curve. Each shaft
 * has a unique phase; opacity drifts subtly per frame.
 */
export class GodRays {
  group = new THREE.Group();
  private shafts: { mesh: THREE.Mesh; phase: number; baseRotY: number }[] = [];

  constructor(curve: THREE.CatmullRomCurve3) {
    const tex = makeShaftTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xfff2d9,
      side: THREE.DoubleSide
    });

    const W = 6;
    const H = 22;
    const geom = new THREE.PlaneGeometry(W, H);
    geom.translate(0, H * 0.5, 0); // anchor at base

    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      const p = curve.getPointAt(t);
      // small lateral offset
      const off = new THREE.Vector3((Math.random() - 0.5) * 8, 14 + Math.random() * 4, (Math.random() - 0.5) * 8);
      const mesh = new THREE.Mesh(geom.clone(), mat.clone());
      mesh.position.set(p.x + off.x, off.y, p.z + off.z);
      mesh.rotation.set(THREE.MathUtils.degToRad(12), Math.random() * Math.PI * 2, 0);
      this.shafts.push({ mesh, phase: Math.random() * Math.PI * 2, baseRotY: mesh.rotation.y });
      this.group.add(mesh);
    }
  }

  update(dt: number): void {
    const t = (performance.now() / 1000);
    for (const s of this.shafts) {
      const m = s.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = 0.35 + 0.12 * Math.sin(t * 0.6 + s.phase);
      s.mesh.rotation.y = s.baseRotY + Math.sin(t * 0.2 + s.phase) * 0.04;
    }
    void dt;
  }
}

function makeShaftTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size * 4;
  const ctx = canvas.getContext('2d')!;
  // vertical white→transparent
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0,    'rgba(255,255,255,0.95)');
  grad.addColorStop(0.6,  'rgba(255,255,255,0.35)');
  grad.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // horizontal soft mask
  ctx.globalCompositeOperation = 'destination-in';
  const hg = ctx.createLinearGradient(0, 0, canvas.width, 0);
  hg.addColorStop(0,    'rgba(0,0,0,0)');
  hg.addColorStop(0.5,  'rgba(0,0,0,1)');
  hg.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
