import * as THREE from 'three';
import { applyEnvironment }    from './world/environment';
import { buildLighting }       from './world/sky';
import { buildGround }         from './world/ground';
import { Forest }              from './world/forest';
import { GodRays }             from './world/godrays';
import { buildStationLandmarks } from './world/landmarks';
import { ACTIVE_ZONES }        from '../core/content/zones';

const SCROLL_EASE    = 1.6;
const SNAP_THRESHOLD = 0.025;
const SNAP_IDLE_MS   = 350;

export class ForestScene {
  // public callbacks (wired by ExperienceComponent)
  onActiveZoneChange: ((idx: number) => void) | null = null;
  onLandmarkHover:    ((idx: number | null) => void) | null = null;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private curve!: THREE.CatmullRomCurve3;
  private trailLen = 1;
  private stationProgress: number[] = [];
  private stationCount: number;

  private forest!: Forest;
  private godRays!: GodRays;
  private landmarks!: THREE.Group;

  // scroll state
  private targetProgress  = 0;
  private currentProgress = 0;
  private lastScrollAt    = 0;
  private activeIndex     = -1;

  // pointer + raycaster
  private pointer = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();

  private rafId = 0;
  private lastFrame = performance.now();
  private resizeHandler: () => void;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement, stationCount: number) {
    this.stationCount = stationCount;

    this.initRenderer();
    this.initScene();
    this.initCamera();

    this.buildTrail();
    // Synchronous fallback colour BEFORE async HDRI:
    this.scene.background = new THREE.Color(0x6a7468);
    this.renderer.setClearColor(0x6a7468, 1);

    void applyEnvironment(this.scene, this.renderer);
    buildLighting(this.scene);

    this.landmarks = buildStationLandmarks(ACTIVE_ZONES, this.stationProgress, this.curve);
    this.scene.add(this.landmarks);

    this.scene.add(buildGround(400));

    this.forest = new Forest(this.curve, this.trailLen);
    this.scene.add(this.forest.group);

    this.godRays = new GodRays(this.curve);
    this.scene.add(this.godRays.group);

    this.placeCameraAtProgress(0);

    this.resizeHandler = () => this.onResize();
    window.addEventListener('resize', this.resizeHandler);

    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  // ---------------- public API ----------------
  addScrollDelta(d: number): void {
    this.targetProgress = THREE.MathUtils.clamp(this.targetProgress + d, 0, 1);
    this.lastScrollAt = performance.now();
  }
  setPointer(x: number, y: number): void {
    this.pointer.set(x, y);
  }
  pickStation(): number | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.landmarks, true);
    if (!hits.length) return null;
    const idx = hits[0].object.userData['stationIndex'];
    return typeof idx === 'number' ? idx : null;
  }
  jumpToStation(idx: number): void {
    if (idx < 0 || idx >= this.stationProgress.length) return;
    this.targetProgress = this.stationProgress[idx];
    this.lastScrollAt = performance.now();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resizeHandler);
    this.forest?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as any).geometry?.dispose) m.geometry.dispose();
      if ((m as any).material) {
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
    this.renderer.dispose();
  }

  // ---------------- init ----------------
  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.outputColorSpace      = THREE.SRGBColorSpace;
    this.renderer.toneMapping           = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure   = 1.05;
  }
  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x6a7468, 25, 180);
  }
  private initCamera(): void {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 500);
  }

  // ---------------- trail ----------------
  private buildTrail(): void {
    const SCALE = 6;
    const wp = [
      { x:   0, z:   0 },
      { x:   1, z:   5 },
      { x:   7, z:  11 },
      { x:  -4, z:   4 },
      { x: -20, z: -20 },
      { x:  -6, z:   0 },
      { x:   0, z:   0 }
    ];
    const points = wp.map((p, i) =>
      new THREE.Vector3(p.x * SCALE, Math.sin(i * 1.3) * 0.6, p.z * SCALE)
    );
    // 'centripetal' avoids the overshoot/loop you get with default 'catmullrom'
    // at the (-20,-20) → (-6,0) sharp turn.
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);

    const lengths = this.curve.getLengths(200);
    this.trailLen = lengths[lengths.length - 1];

    // Distribute one station per waypoint (or evenly across if mismatch).
    const n = this.stationCount;
    this.stationProgress = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      const s = t * (lengths.length - 1);
      const lo = Math.floor(s);
      const hi = Math.min(lengths.length - 1, lo + 1);
      const f  = s - lo;
      this.stationProgress.push((lengths[lo] * (1 - f) + lengths[hi] * f) / this.trailLen);
    }
  }

  // ---------------- camera ----------------
  private placeCameraAtProgress(p: number): void {
    const pos    = this.curve.getPointAt(p);
    const lookAt = this.curve.getPointAt(Math.min(1, p + 0.02));
    pos.y    += 1.65;
    lookAt.y += 1.5;
    this.camera.position.copy(pos);
    this.camera.lookAt(lookAt);
  }

  // ---------------- tick ----------------
  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    // ease progress
    this.currentProgress += (this.targetProgress - this.currentProgress) * (1 - Math.exp(-SCROLL_EASE * dt));

    // snap when idle
    if (now - this.lastScrollAt > SNAP_IDLE_MS) {
      let nearest = this.stationProgress[0];
      let bestD = Infinity;
      for (const sp of this.stationProgress) {
        const d = Math.abs(sp - this.currentProgress);
        if (d < bestD) { bestD = d; nearest = sp; }
      }
      if (bestD < SNAP_THRESHOLD) this.targetProgress = nearest;
    }

    this.placeCameraAtProgress(this.currentProgress);

    // active zone
    let nearestIdx = 0;
    let bestAD = Infinity;
    for (let i = 0; i < this.stationProgress.length; i++) {
      const d = Math.abs(this.stationProgress[i] - this.currentProgress);
      if (d < bestAD) { bestAD = d; nearestIdx = i; }
    }
    if (nearestIdx !== this.activeIndex) {
      this.activeIndex = nearestIdx;
      this.onActiveZoneChange?.(nearestIdx);
    }

    this.forest.update(dt);
    this.godRays.update(dt);

    // hover detect
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.landmarks, true);
    const hoverIdx = hits.length ? (hits[0].object.userData['stationIndex'] ?? null) : null;
    this.onLandmarkHover?.(typeof hoverIdx === 'number' ? hoverIdx : null);

    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private onResize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
}
