import * as THREE from 'three';
import { applyEnvironment }    from './world/environment';
import { buildLighting }       from './world/sky';
import { buildGround }         from './world/ground';
import { Forest }              from './world/forest';
import { GodRays }             from './world/godrays';
import { buildStationLandmarks, type StationLandmarksHandle } from './world/landmarks';
import { ACTIVE_ZONES }        from '../core/content/zones';
import { isMobileLayout }      from '../core/device';

const SCROLL_EASE    = 5;
const SNAP_THRESHOLD = 0.009;
const SNAP_IDLE_MS   = 350;
const FOG_PALETTE = [0x7a8973, 0x718477, 0x687e78, 0x687984, 0x7d846f, 0x6f8078, 0x817a6d]
  .map((hex) => new THREE.Color(hex));
const LIGHT_PALETTE = [0xffe0ae, 0xcfe9d7, 0xbde4dd, 0xc6d9f2, 0xffe3ad, 0xc8e9dd, 0xffd5a0]
  .map((hex) => new THREE.Color(hex));

export class ForestScene {
  // public callbacks (wired by ExperienceComponent)
  onActiveZoneChange: ((idx: number) => void) | null = null;
  onLandmarkHover:    ((idx: number | null) => void) | null = null;
  onStationSettled: ((settled: boolean) => void) | null = null;
  onCarouselChange: ((state: { index: number; count: number } | null) => void) | null = null;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private curve!: THREE.CatmullRomCurve3;
  private trailLen = 1;
  private stationProgress: number[] = [];
  private stationCount: number;

  private forest!: Forest;
  private godRays!: GodRays;
  private landmarks!: StationLandmarksHandle;
  private keyLight!: THREE.DirectionalLight;

  // scroll state
  private targetProgress  = 0;
  private currentProgress = 0;
  private lastScrollAt    = 0;
  private activeIndex     = -1;
  private travel: { from: number; to: number; elapsed: number; duration: number } | null = null;
  private motion = true;
  private settled = false;
  private lastHover: number | null = null;
  private lastCarousel = '';
  private viewMatrix = new THREE.Matrix4();
  private viewQuaternion = new THREE.Quaternion();
  private previousProgress = 0;
  private smoothedSpeed = 0;
  private renderPixelRatio = 1;
  private qualityElapsed = 0;
  private qualityFrames = 0;
  private qualityAdjusted = false;
  private disposeEnvironment: (() => void) | null = null;

  // pointer + raycaster
  private pointer = new THREE.Vector2(10, 10);
  private raycaster = new THREE.Raycaster();

  private rafId = 0;
  private lastFrame = performance.now();
  private resizeHandler: () => void;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;
  private paused = false;
  private mobile = false;

  constructor(private canvas: HTMLCanvasElement, stationCount: number) {
    this.stationCount = stationCount;
    this.mobile = isMobileLayout();

    this.initRenderer();
    this.initScene();
    this.initCamera();

    this.buildTrail();
    // Synchronous fallback colour BEFORE async HDRI:
    this.scene.background = new THREE.Color(0x6a7468);
    this.renderer.setClearColor(0x6a7468, 1);

    void applyEnvironment(this.scene, this.renderer, () => this.disposed).then((dispose) => {
      if (this.disposed) dispose?.();
      else this.disposeEnvironment = dispose;
    });
    this.keyLight = buildLighting(this.scene);

    this.landmarks = buildStationLandmarks(ACTIVE_ZONES, this.stationProgress, this.curve);
    this.scene.add(this.landmarks.group);
    this.applyViewportLayout();

    this.scene.add(buildGround(400));

    const forestCfg = this.mobile ? { trunkCount: 200, bushCount: 100 } : undefined;
    this.forest = new Forest(this.curve, this.trailLen, forestCfg);
    this.scene.add(this.forest.group);

    this.godRays = new GodRays(this.curve);
    this.scene.add(this.godRays.group);

    this.placeCameraAtProgress(0);

    this.resizeHandler = () => this.onResize();
    window.addEventListener('resize', this.resizeHandler);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.visualViewport?.addEventListener('resize', this.resizeHandler);
    this.resizeObserver = new ResizeObserver(this.resizeHandler);
    this.resizeObserver.observe(this.canvas);

    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  // ---------------- public API ----------------
  addScrollDelta(d: number): void {
    this.travel = null;
    d = THREE.MathUtils.clamp(d, -0.04, 0.04);
    // If the user is parked at a zone whose panel owns a carousel,
    // feed the scroll into the
    // carousel first. Only the leftover delta — once the carousel has
    // hit its last (or first) card — moves the walker along the trail.
    if (
      this.activeIndex >= 0 &&
      this.landmarks &&
      Math.abs(this.currentProgress - this.stationProgress[this.activeIndex]) < 0.006
    ) {
      d = this.landmarks.nudgeCarousel(this.activeIndex, d);
      if (d === 0) {
        this.lastScrollAt = performance.now();
        return;
      }
    }
    this.targetProgress = THREE.MathUtils.clamp(this.targetProgress + d, 0, 1);
    if (!this.motion) this.currentProgress = this.targetProgress;
    this.lastScrollAt = performance.now();
  }
  setPointer(x: number, y: number): void {
    this.pointer.set(x, y);
  }
  pickStation(): number | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.panelHits();
    if (!hits.length) return null;
    const idx = hits[0].object.userData['stationIndex'];
    return typeof idx === 'number' ? idx : null;
  }
  /**
   * Hit-test the holo-panel under the current pointer for a clickable
   * region (currently just the project "Visit Site" pills). Returns the
   * URL to open or null if no link sits under the pointer.
   */
  pickLink(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.panelHits();
    for (const h of hits) {
      if (!h.object.userData['isPanel']) continue;
      const idx = h.object.userData['stationIndex'];
      const uv = h.uv;
      if (typeof idx !== 'number' || !uv) return null;
      return this.landmarks.pickLink(idx, uv.x, uv.y);
    }
    return null;
  }
  jumpToStation(idx: number): void {
    if (idx < 0 || idx >= this.stationProgress.length) return;
    this.settled = false;
    this.lastCarousel = '';
    this.onStationSettled?.(false);
    this.targetProgress = this.stationProgress[idx];
    if (this.motion) {
      this.travel = {
        from: this.currentProgress, to: this.targetProgress, elapsed: 0,
        duration: 1.2 + Math.abs(this.targetProgress - this.currentProgress) * 3.8,
      };
    } else {
      this.currentProgress = this.targetProgress;
      this.travel = null;
    }
    this.lastScrollAt = performance.now();
  }

  private panelHits(): THREE.Intersection[] {
    return this.raycaster.intersectObject(this.landmarks.group, true).filter((hit) => {
      const mesh = hit.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      return mesh.visible && mesh.userData['isPanel'] && mesh.material.opacity > 0.2;
    });
  }

  setMotion(enabled: boolean): void {
    this.motion = enabled;
    if (!enabled) {
      this.currentProgress = this.targetProgress;
      this.travel = null;
    }
  }

  stepCarousel(direction: number): boolean {
    return this.settled ? this.landmarks.stepCarousel(this.activeIndex, direction) : false;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.onVisibilityChange();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resizeHandler);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.visualViewport?.removeEventListener('resize', this.resizeHandler);
    this.resizeObserver?.disconnect();
    this.disposeEnvironment?.();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) geometries.add(m.geometry);
      if (m.material) {
        const mat = m.material as THREE.Material | THREE.Material[];
        for (const material of Array.isArray(mat) ? mat : [mat]) {
          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
        }
      }
    });
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
    geometries.forEach((g) => g.dispose());
    this.renderer.dispose();
  }

  // ---------------- init ----------------
  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.mobile,
      powerPreference: this.mobile ? 'low-power' : 'high-performance',
    });
    const maxDpr = this.mobile ? 1.5 : 2;
    this.renderPixelRatio = Math.min(window.devicePixelRatio, maxDpr);
    this.renderer.setPixelRatio(this.renderPixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.outputColorSpace      = THREE.SRGBColorSpace;
    this.renderer.toneMapping           = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure   = 1.05;
  }
  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x7a8973, 18, 120);
  }
  private initCamera(): void {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    this.camera = new THREE.PerspectiveCamera(this.fovForAspect(aspect), aspect, 0.1, 500);
  }

  /** Wider FOV on small screens so holo panels stay in frame. */
  private fovForAspect(aspect: number): number {
    if (aspect < 0.85) return 68;
    if (aspect < 1.15) return 60;
    if (this.mobile && aspect < 1.6) return 58;
    return 55;
  }

  private applyViewportLayout(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w < 1 || h < 1) return;
    this.landmarks.setViewport(w, h);
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
  private placeCameraAtProgress(p: number, dt = 1): void {
    const pos = this.curve.getPointAt(p);

    // Pick a forward look-target. Near the end of the trail (p ≈ 1) the
    // naive `getPointAt(p + 0.02)` clamps to the same point as `pos`, so
    // the lookAt collapses to a straight-down vector. Instead, when we
    // are near the end, look BACK along the tangent (extrapolate forward
    // using the tangent at the end) so the camera stays level.
    let lookAt: THREE.Vector3;
    const lookAhead = 0.016 + Math.min(0.018, Math.abs(this.smoothedSpeed) * 0.012);
    if (p < 1 - lookAhead) {
      lookAt = this.curve.getPointAt(Math.min(1, p + lookAhead));
    } else {
      const tan = this.curve.getTangentAt(1).clone().normalize();
      lookAt = pos.clone().add(tan.multiplyScalar(2));
    }

    // The ground is level: keep eye height stable through the original route.
    pos.y = 1.65;
    lookAt.y = 1.5;
    this.camera.position.copy(pos);
    this.viewMatrix.lookAt(pos, lookAt, this.camera.up);
    this.viewQuaternion.setFromRotationMatrix(this.viewMatrix);
    this.camera.quaternion.slerp(this.viewQuaternion, this.motion ? 1 - Math.exp(-12 * dt) : 1);

    const baseFov = this.fovForAspect(this.camera.aspect);
    const targetFov = baseFov + Math.min(2.2, Math.abs(this.smoothedSpeed) * 1.5);
    const nextFov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-5 * dt));
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private updateAtmosphere(activeIdx: number, dt: number): void {
    const idx = THREE.MathUtils.clamp(activeIdx, 0, FOG_PALETTE.length - 1);
    const blend = this.motion ? 1 - Math.exp(-0.65 * dt) : 1;
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) fog.color.lerp(FOG_PALETTE[idx], blend);
    this.keyLight.color.lerp(LIGHT_PALETTE[idx], blend);
    this.keyLight.intensity = THREE.MathUtils.lerp(this.keyLight.intensity, idx === 6 ? 1.28 : 1.15, blend);
  }

  private monitorQuality(rawDt: number): void {
    if (this.qualityAdjusted || document.hidden) return;
    this.qualityElapsed += rawDt;
    if (this.qualityElapsed < 1) return;
    this.qualityFrames++;
    if (this.qualityElapsed < 4) return;
    const measuredSeconds = this.qualityElapsed - 1;
    const fps = this.qualityFrames / Math.max(0.1, measuredSeconds);
    if (fps < 48 && this.renderPixelRatio > 1) {
      this.renderPixelRatio = Math.max(1, this.renderPixelRatio * 0.8);
      this.renderer.setPixelRatio(this.renderPixelRatio);
      this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    }
    this.qualityAdjusted = true;
  }

  // ---------------- tick ----------------
  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = Math.max(0, (now - this.lastFrame) / 1000);
    const dt = Math.min(0.05, rawDt);
    this.lastFrame = now;

    // ease progress
    if (this.travel) {
      this.travel.elapsed += dt;
      const t = Math.min(1, this.travel.elapsed / this.travel.duration);
      const ease = t * t * t * (t * (6 * t - 15) + 10);
      this.currentProgress = THREE.MathUtils.lerp(this.travel.from, this.travel.to, ease);
      if (t === 1) this.travel = null;
    } else {
      this.currentProgress += (this.targetProgress - this.currentProgress) * (1 - Math.exp(-SCROLL_EASE * dt));
    }

    // snap when idle — but only once we're already close to our intended
    // target. Otherwise a long jump (e.g. mini-map click) gets short-circuited
    // and snaps to whichever station the ease happens to be passing.
    if (
      !this.travel && now - this.lastScrollAt > SNAP_IDLE_MS &&
      Math.abs(this.currentProgress - this.targetProgress) < SNAP_THRESHOLD
    ) {
      let nearest = this.stationProgress[0];
      let bestD = Infinity;
      for (const sp of this.stationProgress) {
        const d = Math.abs(sp - this.currentProgress);
        if (d < bestD) { bestD = d; nearest = sp; }
      }
      if (bestD < SNAP_THRESHOLD) this.targetProgress = nearest;
    }

    const speed = dt > 0 ? (this.currentProgress - this.previousProgress) / dt : 0;
    this.smoothedSpeed = THREE.MathUtils.lerp(this.smoothedSpeed, speed, 1 - Math.exp(-7 * dt));
    this.previousProgress = this.currentProgress;
    this.placeCameraAtProgress(this.currentProgress, dt);

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
    this.updateAtmosphere(nearestIdx, dt);

    const settled = !this.travel && bestAD < 0.003 && Math.abs(this.targetProgress - this.currentProgress) < 0.001;
    if (settled !== this.settled) {
      this.settled = settled;
      this.onStationSettled?.(settled);
    }
    if (this.motion) {
      this.forest.update(dt);
      this.godRays.update(dt);
    }
    this.landmarks.update(dt, this.activeIndex, this.currentProgress, this.motion);
    const carousel = settled ? this.landmarks.carouselState(this.activeIndex) : null;
    const key = carousel ? `${this.activeIndex}:${carousel.index}:${carousel.count}` : '';
    if (key !== this.lastCarousel) {
      this.lastCarousel = key;
      this.onCarouselChange?.(carousel);
    }

    // hover detect
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.panelHits();
    const hoverIdx = hits.length ? (hits[0].object.userData['stationIndex'] ?? null) : null;
    const hover = typeof hoverIdx === 'number' ? hoverIdx : null;
    if (hover !== this.lastHover) {
      this.lastHover = hover;
      this.onLandmarkHover?.(hover);
    }

    this.renderer.render(this.scene, this.camera);
    this.monitorQuality(rawDt);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private onVisibilityChange = (): void => {
    cancelAnimationFrame(this.rafId);
    if (!document.hidden && !this.disposed && !this.paused) {
      this.lastFrame = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private onResize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const aspect = w / Math.max(1, h);
    this.mobile = isMobileLayout();
    this.camera.fov = this.fovForAspect(aspect);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.applyViewportLayout();
  }
}
