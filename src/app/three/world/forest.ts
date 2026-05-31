import * as THREE from 'three';

/**
 * Photoreal-leaning forest using:
 *   - Instanced PBR tree trunks (bark texture from Poly Haven `bark_brown_02`)
 *   - Instanced angled branches sharing the same bark material
 *   - Cross-plane billboard canopies with a procedurally-rendered DENSE
 *     leaf-cluster alpha card; 6 puffs per tree clustered around upper trunk
 *     + branch tips to read as a real foliage volume
 *   - Undergrowth: smaller cross-plane bushes
 *
 * IBL from the HDRI does the heavy lifting; the leaf cards use
 *   THREE.MeshStandardMaterial with alphaTest so they receive PBR shading.
 */

interface ForestConfig {
  trunkCount: number;
  bushCount: number;
  clearance: number;
  lateralMin: number;
  lateralMax: number;
}

const DEFAULTS: ForestConfig = {
  trunkCount: 360,
  bushCount: 180,
  clearance: 5.0,
  lateralMin: 6.5,
  lateralMax: 34.5
};

export class Forest {
  group = new THREE.Group();

  private trunks!: THREE.InstancedMesh;
  private branches!: THREE.InstancedMesh;
  private canopies: THREE.InstancedMesh[] = [];
  private bushes!: THREE.InstancedMesh;

  /** Per-tree metadata reused by branches + canopies so all three layers align. */
  private trees: {
    pos: THREE.Vector3;
    height: number;
    sx: number;
    sz: number;
    /** Branch tip positions in world space (computed once, reused by canopies). */
    branchTips: THREE.Vector3[];
  }[] = [];

  private uTime = { value: 0 };

  /** Shared bark material so trunks and branches stay visually consistent. */
  private barkMat!: THREE.MeshStandardMaterial;

  constructor(curve: THREE.CatmullRomCurve3, _trailLen: number, cfg: Partial<ForestConfig> = {}) {
    const c = { ...DEFAULTS, ...cfg };
    const samples = this.sampleCurve(curve, 240);

    this.buildTrunks(curve, samples, c);
    this.buildBranches();
    this.buildCanopies();
    this.buildUndergrowth(curve, samples, c);
  }

  update(dt: number): void {
    this.uTime.value += dt;
  }

  // ---------------- helpers ----------------
  private sampleCurve(curve: THREE.CatmullRomCurve3, n: number): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) out.push(curve.getPointAt(i / n));
    return out;
  }

  private minDistToTrailXZ(samples: THREE.Vector3[], x: number, z: number): number {
    let best = Infinity;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const dx = x - s.x, dz = z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }

  /**
   * Sample candidate placement points along the trail (lateral offset, both sides),
   * gated by polyline distance check. Returns a list of world positions.
   */
  private placeAlongTrail(
    curve: THREE.CatmullRomCurve3,
    samples: THREE.Vector3[],
    target: number,
    cfg: ForestConfig
  ): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    const tmpTan = new THREE.Vector3();
    const upY = new THREE.Vector3(0, 1, 0);
    const sideV = new THREE.Vector3();
    let safety = target * 6;
    while (out.length < target && safety-- > 0) {
      const t = Math.random();
      const p = curve.getPointAt(t);
      curve.getTangentAt(t, tmpTan);
      sideV.crossVectors(tmpTan, upY).normalize();
      const sign = Math.random() < 0.5 ? -1 : 1;
      const lat  = cfg.lateralMin + Math.random() * (cfg.lateralMax - cfg.lateralMin);
      const x = p.x + sideV.x * sign * lat;
      const z = p.z + sideV.z * sign * lat;
      if (this.minDistToTrailXZ(samples, x, z) < cfg.clearance) continue;
      // Tiny jitter so they don't form perfect rings.
      out.push(new THREE.Vector3(x + (Math.random() - 0.5) * 0.6, 0, z + (Math.random() - 0.5) * 0.6));
    }
    return out;
  }

  // ---------------- trunks ----------------
  private buildTrunks(
    curve: THREE.CatmullRomCurve3,
    samples: THREE.Vector3[],
    cfg: ForestConfig
  ): void {
    const positions = this.placeAlongTrail(curve, samples, cfg.trunkCount, cfg);

    const geom = new THREE.CylinderGeometry(0.18, 0.32, 1, 8, 1, true);
    geom.translate(0, 0.5, 0); // base at y=0

    const bark = makeBarkTexture();
    this.barkMat = new THREE.MeshStandardMaterial({
      map: bark,
      roughness: 0.95,
      metalness: 0,
      color: 0xffffff
    });

    // Try to upgrade to a real photo-bark texture (Poly Haven). Failure is silent
    // — the procedural fallback is already in place.
    const barkUrl    = new URL('assets/forest/bark/bark_brown_02_diff_1k.jpg',   document.baseURI).toString();
    const barkNormal = new URL('assets/forest/bark/bark_brown_02_nor_gl_1k.jpg', document.baseURI).toString();
    const tl = new THREE.TextureLoader();
    tl.load(barkUrl, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 4);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      this.barkMat.map = t;
      this.barkMat.needsUpdate = true;
    });
    tl.load(barkNormal, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 4);
      this.barkMat.normalMap = t;
      this.barkMat.needsUpdate = true;
    });

    this.trunks = new THREE.InstancedMesh(geom, this.barkMat, positions.length);
    this.trunks.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const colour = new THREE.Color();

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const h = 6 + Math.random() * 7; // 6..13
      const wx = 0.85 + Math.random() * 0.4;
      const wz = 0.85 + Math.random() * 0.4;
      e.set((Math.random() - 0.5) * 0.06, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.06);
      q.setFromEuler(e);
      s.set(wx, h, wz);
      m.compose(p, q, s);
      this.trunks.setMatrixAt(i, m);

      // warm browns ↔ cool greys
      const hue = 0.07 + Math.random() * 0.03;
      const sat = 0.18 + Math.random() * 0.18;
      const lum = 0.32 + Math.random() * 0.18;
      colour.setHSL(hue, sat, lum);
      this.trunks.setColorAt?.(i, colour);

      // Record per-tree metadata for branches + canopies.
      this.trees.push({ pos: p.clone(), height: h, sx: wx, sz: wz, branchTips: [] });
    }
    this.trunks.instanceMatrix.needsUpdate = true;
    if (this.trunks.instanceColor) this.trunks.instanceColor.needsUpdate = true;

    this.group.add(this.trunks);
  }

  // ---------------- branches ----------------
  /**
   * 4 branches per tree, angled 35–60° from vertical, length scales with tree
   * height. They share the bark material with trunks and stash their tip
   * world-positions on tree metadata so the canopy puffs can hang off them.
   */
  private buildBranches(): void {
    const branchesPerTree = 4;
    const total = this.trees.length * branchesPerTree;

    // Tapered cylinder pointing up the +Y axis from origin (length = 1).
    const geom = new THREE.CylinderGeometry(0.05, 0.12, 1, 6, 1, true);
    geom.translate(0, 0.5, 0);

    this.branches = new THREE.InstancedMesh(geom, this.barkMat, total);
    this.branches.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const baseDir = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const tipLocal = new THREE.Vector3(0, 1, 0); // tip in geometry's local space (y=1 after translate)
    const tipWorld = new THREE.Vector3();
    const col = new THREE.Color();
    const trunkColor = new THREE.Color();

    let inst = 0;
    for (let i = 0; i < this.trees.length; i++) {
      const t = this.trees[i];
      this.trunks.getColorAt?.(i, trunkColor);

      for (let b = 0; b < branchesPerTree; b++) {
        // Branch attaches at 60–95% of trunk height, with even azimuth spread + jitter.
        const yFrac = 0.60 + (b / branchesPerTree) * 0.30 + Math.random() * 0.06;
        const azimuth = (b / branchesPerTree) * Math.PI * 2 + Math.random() * 0.9;
        const tilt = THREE.MathUtils.degToRad(35 + Math.random() * 25); // from +Y
        const len  = 1.2 + Math.random() * 1.6 + t.height * 0.10;

        // Direction of the branch (unit).
        dir.set(
          Math.sin(tilt) * Math.cos(azimuth),
          Math.cos(tilt),
          Math.sin(tilt) * Math.sin(azimuth)
        ).normalize();

        // Anchor at trunk surface, slight inset.
        const anchorR = 0.20 * Math.max(t.sx, t.sz);
        const ax = t.pos.x + Math.cos(azimuth) * anchorR;
        const ay = t.pos.y + t.height * yFrac;
        const az = t.pos.z + Math.sin(azimuth) * anchorR;

        // Quaternion that rotates +Y onto `dir`.
        q.setFromUnitVectors(baseDir, dir);
        // Slight thickness variance.
        const thick = 0.7 + Math.random() * 0.6;
        s.set(thick, len, thick);
        m.compose(new THREE.Vector3(ax, ay, az), q, s);
        this.branches.setMatrixAt(inst, m);

        // Inherit trunk colour, slightly darker.
        col.copy(trunkColor).multiplyScalar(0.85);
        this.branches.setColorAt?.(inst, col);

        // World-space tip = anchor + dir * len. tipLocal already accounts for translate.
        tipWorld.set(ax + dir.x * len, ay + dir.y * len, az + dir.z * len);
        t.branchTips.push(tipWorld.clone());

        inst++;
      }
    }
    this.branches.instanceMatrix.needsUpdate = true;
    if (this.branches.instanceColor) this.branches.instanceColor.needsUpdate = true;

    this.group.add(this.branches);

    // Suppress unused-symbol lint on tipLocal (kept for clarity).
    void tipLocal;
  }

  // ---------------- canopies ----------------
  /**
   * 6 puffs per tree: 1 crown puff at the top + 1 puff at each of the 4
   * branch tips + 1 mid-canopy filler. Two material variants (light/dark)
   * alternate per puff so the volume reads as layered foliage rather than a
   * single sphere.
   */
  private buildCanopies(): void {
    const treeCount = this.trees.length;
    const puffsPerTree = 6;
    const total = treeCount * puffsPerTree;

    const planeGeom = new THREE.PlaneGeometry(1, 1);
    const cross = mergeCrossPlanes(planeGeom);

    const leafTex = makeLeafCanopyTexture();

    const variants: { color: number; alphaTest: number }[] = [
      { color: 0xffffff, alphaTest: 0.14 }, // bright top
      { color: 0xb8c697, alphaTest: 0.18 }  // shadowed underside
    ];

    // Build one InstancedMesh per variant, splitting puffs evenly between them.
    const counts = [Math.ceil(total / 2), Math.floor(total / 2)];

    const ms: THREE.InstancedMesh[] = [];
    for (let v = 0; v < variants.length; v++) {
      const variant = variants[v];
      const mat = new THREE.MeshStandardMaterial({
        map: leafTex,
        alphaMap: leafTex,
        transparent: false,
        alphaTest: variant.alphaTest,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0,
        color: variant.color
      });
      // Wind sway: bend top of plane based on world position + time.
      mat.onBeforeCompile = (shader) => {
        shader.uniforms['uTime'] = this.uTime;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `
            #include <common>
            uniform float uTime;
          `)
          .replace('#include <begin_vertex>', `
            vec3 transformed = vec3( position );
            float topMask = max(0.0, position.y);
            float phase = float(gl_InstanceID) * 0.731 + (modelMatrix[3].x + modelMatrix[3].z) * 0.07;
            float swayX = sin(uTime * 1.1 + phase) * 0.10;
            float swayZ = cos(uTime * 0.9 + phase * 0.7) * 0.08;
            transformed.x += swayX * topMask;
            transformed.z += swayZ * topMask;
          `);
      };

      const im = new THREE.InstancedMesh(cross.clone(), mat, counts[v]);
      im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      ms.push(im);
      this.canopies.push(im);
      this.group.add(im);
    }

    // Distribute the 6 puffs of each tree across the two variant meshes.
    const cursor = [0, 0];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sV = new THREE.Vector3();
    const pV = new THREE.Vector3();
    const col = new THREE.Color();

    for (let i = 0; i < treeCount; i++) {
      const t = this.trees[i];
      const crown = new THREE.Vector3(t.pos.x, t.pos.y + t.height * 0.92, t.pos.z);

      for (let pIdx = 0; pIdx < puffsPerTree; pIdx++) {
        // Decide which variant this puff goes to: even = bright (0), odd = dark (1).
        const v = pIdx % 2;
        const im = ms[v];

        // Choose anchor point.
        let anchor: THREE.Vector3;
        let radius: number;
        if (pIdx === 0) {
          anchor = crown;            // top crown
          radius = 4.2 + Math.random() * 1.5;
        } else if (pIdx === 5) {
          // mid-filler between crown and a branch tip
          const tip = t.branchTips[(pIdx + i) % t.branchTips.length] ?? crown;
          anchor = new THREE.Vector3().lerpVectors(crown, tip, 0.55);
          radius = 3.4 + Math.random() * 1.2;
        } else {
          const tip = t.branchTips[(pIdx - 1) % t.branchTips.length];
          anchor = tip ?? crown;
          radius = 2.8 + Math.random() * 1.4;
        }

        // Small horizontal jitter (≤0.6 m) so puffs don't drift into the trail corridor.
        pV.set(
          anchor.x + (Math.random() - 0.5) * 0.6,
          anchor.y + (Math.random() - 0.5) * 0.4,
          anchor.z + (Math.random() - 0.5) * 0.6
        );

        // Puffs are slightly squashed vertically to read as foliage clusters.
        sV.set(radius, radius * (0.85 + Math.random() * 0.30), radius);
        e.set(0, Math.random() * Math.PI * 2, 0);
        q.setFromEuler(e);
        m.compose(pV, q, sV);
        im.setMatrixAt(cursor[v], m);

        // Colour drift over olive / sage / pine / forest / moss.
        // Underside (variant 1) biases darker so depth reads.
        const hue = 0.22 + Math.random() * 0.10;
        const sat = 0.45 + Math.random() * 0.25;
        const lum = (v === 1 ? 0.30 : 0.46) + Math.random() * 0.12;
        col.setHSL(hue, sat, lum);
        im.setColorAt?.(cursor[v], col);

        cursor[v]++;
      }
    }

    for (const im of ms) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  // ---------------- undergrowth ----------------
  private buildUndergrowth(
    curve: THREE.CatmullRomCurve3,
    samples: THREE.Vector3[],
    cfg: ForestConfig
  ): void {
    const target = cfg.bushCount;
    const positions: THREE.Vector3[] = [];
    const tmpTan = new THREE.Vector3();
    const upY = new THREE.Vector3(0, 1, 0);
    const sideV = new THREE.Vector3();
    let safety = target * 6;
    while (positions.length < target && safety-- > 0) {
      const t = Math.random();
      const p = curve.getPointAt(t);
      curve.getTangentAt(t, tmpTan);
      sideV.crossVectors(tmpTan, upY).normalize();
      const sign = Math.random() < 0.5 ? -1 : 1;
      const lat = 3 + Math.random() * 2.5; // tight to trail edge
      const x = p.x + sideV.x * sign * lat;
      const z = p.z + sideV.z * sign * lat;
      if (this.minDistToTrailXZ(samples, x, z) < 2.2) continue;
      positions.push(new THREE.Vector3(x, 0, z));
    }

    const planeGeom = new THREE.PlaneGeometry(1, 1);
    const cross = mergeCrossPlanes(planeGeom);
    const tex = makeBushTexture();

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      alphaMap: tex,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
      color: 0xc6d8a8
    });

    this.bushes = new THREE.InstancedMesh(cross, mat, positions.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const col = new THREE.Color();

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i].clone();
      p.y = 0.3;
      const r = 0.6 + Math.random() * 0.7;
      s.set(r, r * (0.7 + Math.random() * 0.5), r);
      e.set(0, Math.random() * Math.PI * 2, 0);
      q.setFromEuler(e);
      m.compose(p, q, s);
      this.bushes.setMatrixAt(i, m);

      const hue = 0.25 + Math.random() * 0.06;
      const sat = 0.35 + Math.random() * 0.25;
      const lum = 0.3  + Math.random() * 0.12;
      col.setHSL(hue, sat, lum);
      this.bushes.setColorAt?.(i, col);
    }
    this.bushes.instanceMatrix.needsUpdate = true;
    if (this.bushes.instanceColor) this.bushes.instanceColor.needsUpdate = true;

    this.group.add(this.bushes);
  }

  dispose(): void {
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        (m.geometry as THREE.BufferGeometry).dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
  }
}

// =================== procedural textures ===================

function mergeCrossPlanes(plane: THREE.PlaneGeometry): THREE.BufferGeometry {
  // Two PlaneGeometries crossed at 90°, so billboards look believable
  // from any horizontal angle without per-frame look-at math.
  const a = plane.clone();
  const b = plane.clone();
  b.rotateY(Math.PI / 2);
  // BufferGeometryUtils not strictly required if we just merge attribute arrays.
  // But for simplicity we stack them with a Group via BufferGeometryUtils-equivalent.
  // Simpler: manually merge attributes.
  return mergeTwo(a, b);
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const ap = a.getAttribute('position') as THREE.BufferAttribute;
  const bp = b.getAttribute('position') as THREE.BufferAttribute;
  const an = a.getAttribute('normal')   as THREE.BufferAttribute;
  const bn = b.getAttribute('normal')   as THREE.BufferAttribute;
  const au = a.getAttribute('uv')       as THREE.BufferAttribute;
  const bu = b.getAttribute('uv')       as THREE.BufferAttribute;
  const ai = a.getIndex()!;
  const bi = b.getIndex()!;

  const pos = new Float32Array(ap.array.length + bp.array.length);
  pos.set(ap.array as Float32Array, 0);
  pos.set(bp.array as Float32Array, ap.array.length);

  const nrm = new Float32Array(an.array.length + bn.array.length);
  nrm.set(an.array as Float32Array, 0);
  nrm.set(bn.array as Float32Array, an.array.length);

  const uv = new Float32Array(au.array.length + bu.array.length);
  uv.set(au.array as Float32Array, 0);
  uv.set(bu.array as Float32Array, au.array.length);

  const offset = ap.count;
  const idx = new Uint16Array(ai.count + bi.count);
  for (let i = 0; i < ai.count; i++) idx[i] = ai.array[i];
  for (let i = 0; i < bi.count; i++) idx[ai.count + i] = bi.array[i] + offset;

  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal',   new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv',       new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.translate(0, 0.5, 0); // base at origin so canopy attaches above trunk
  return out;
}

/**
 * Dense, photoreal-leaning leaf canopy texture, drawn once into a 512×512
 * canvas. Three overlapping passes of small almond leaves (≈5500 leaves
 * total) with HSL drift, then a tight radial mask so silhouette goes mostly
 * to the edges. Looks like a real foliage cluster under HDRI lighting.
 */
function makeLeafCanopyTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Three palettes for layered depth: shadow, mid, highlight.
  const palettes = [
    ['#283d1c', '#34501f', '#3a5a25', '#456a2c'],                                  // shadow
    ['#3b5a2c', '#4f6e34', '#5e7e38', '#67833d', '#7c9a47'],                       // mid
    ['#7c9a47', '#8aa84d', '#94b352', '#aac265', '#c0d27a']                        // highlight
  ];
  // Per-pass leaf counts (shadow heavy → silhouette reads as a volume).
  const passes = [2200, 2200, 1100];
  const passRadius = [0.50, 0.48, 0.42]; // highlights cluster more centrally

  for (let pi = 0; pi < passes.length; pi++) {
    const pal = palettes[pi];
    const N   = passes[pi];
    const R   = passRadius[pi] * size;

    for (let i = 0; i < N; i++) {
      // Bias positions into a roughly circular cloud (sqrt for area-uniform).
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.55) * R;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.96;

      const w = 3.5 + Math.random() * 8.0;
      const h = w * (0.40 + Math.random() * 0.55);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.random() * Math.PI * 2);

      ctx.fillStyle = pal[(Math.random() * pal.length) | 0];
      ctx.globalAlpha = 0.65 + Math.random() * 0.32;

      // Almond/leaf shape.
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.quadraticCurveTo(0, -h, w / 2, 0);
      ctx.quadraticCurveTo(0,  h, -w / 2, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  // Tiny specular highlights.
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 360; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.6) * size * 0.40;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.96;
    ctx.fillStyle = 'rgba(220, 230, 170, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + Math.random() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // Soft circular alpha mask: keep the centre fully opaque, fade only the
  // outermost ring so the silhouette reads as a dense puff (not a faded blob).
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, size * 0.50);
  mask.addColorStop(0,    'rgba(0,0,0,1)');
  mask.addColorStop(0.78, 'rgba(0,0,0,1)');
  mask.addColorStop(0.95, 'rgba(0,0,0,0.55)');
  mask.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function makeBushTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size * 0.7;
  const palette = ['#3b5a2c', '#4f6e34', '#67833d', '#7c9a47'];
  for (let i = 0; i < 700; i++) {
    const a = (Math.random() * 0.9 + 0.05) * Math.PI;
    const r = Math.pow(Math.random(), 0.7) * size * 0.42;
    const x = cx + Math.cos(a) * r;
    const y = cy - Math.abs(Math.sin(a)) * r;
    const w = 3 + Math.random() * 6;
    const h = w * (0.4 + Math.random() * 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI * 2);
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
    ctx.globalAlpha = 0.55 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(0, -h, w / 2, 0);
    ctx.quadraticCurveTo(0, h, -w / 2, 0);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Simple bark-like seamless texture: vertical noise streaks over a brown base.
 * Replaced at runtime if `assets/forest/bark/bark_brown_02_diff_1k.jpg` is
 * fetched; this serves as an SSR-safe fallback.
 */
function makeBarkTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 2) {
    const lightness = 30 + Math.random() * 30;
    ctx.fillStyle = `hsl(28, 30%, ${lightness}%)`;
    ctx.fillRect(x, 0, 1 + Math.random() * 1.5, size);
  }
  // vertical streaks
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const h = 30 + Math.random() * 80;
    ctx.fillStyle = 'rgba(20,12,5,0.4)';
    ctx.fillRect(x, y, 0.6 + Math.random(), h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
