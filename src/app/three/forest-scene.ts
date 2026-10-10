import * as THREE from 'three';
import { ACTIVE_ZONES } from '../core/content/zones';
import { isMobileLayout } from '../core/device';
import { QUALITY, initialTier, lowerTier, type QualityProfile, type QualityTier } from './world/quality';
import { TrailField } from './world/trail-field';
import { planLandmarkAnchors, type LandmarkAnchor } from './world/landmark-plan';
import { Terrain } from './world/terrain';
import { Lighting } from './world/lighting';
import { applyEnvironment } from './world/environment';
import { createWorldClock, type WorldClock } from './world/cards';
import { Forest } from './world/forest';
import { Undergrowth } from './world/undergrowth';
import { Canopy } from './world/canopy';
import { buildStationLandmarks, type StationLandmarksHandle } from './world/landmarks';
import { Mist } from './world/mist';
import { LightShafts } from './world/lightshafts';
import { Particles } from './world/particles';
import { Wildlife } from './world/wildlife';
import { clearTextureCache } from './world/textures';

const SCROLL_EASE    = 5;
const SNAP_THRESHOLD = 0.009;
const SNAP_IDLE_MS   = 350;
const EYE_HEIGHT     = 1.62;
const MAX_QUALITY_ADJUSTMENTS = 2;
/** Below this aspect the view is re-centred above the mobile bottom sheet. */
const PORTRAIT_ASPECT = 0.85;
/** Fraction of the view height the horizon is raised by on portrait screens. */
const PORTRAIT_SHIFT = 0.2;

/** Pale, cool morning fog per station; it is also the sky (no horizon). */
const MIST_PALETTE = [0xc4ccc6, 0xbfcbc9, 0xc2c9cf, 0xbcc9d0, 0xc6cbc3, 0xbcc6c4, 0xd0c8be]
  .map((hex) => new THREE.Color(hex));
/** Sun tint per station; the last stop runs slightly warm for the campfire. */
const LIGHT_PALETTE = [0xe4edf4, 0xdfeaf0, 0xdde8f2, 0xd8e6f2, 0xe6ecef, 0xd9ebe6, 0xf2dcc3]
  .map((hex) => new THREE.Color(hex));

export class ForestScene {
  // public callbacks (wired by ExperienceComponent)
  onActiveZoneChange: ((idx: number) => void) | null = null;
  onLandmarkHover:    ((idx: number | null) => void) | null = null;
  onStationSettled:   ((settled: boolean) => void) | null = null;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private fog!: THREE.FogExp2;

  private tier: QualityTier;
  private profile: QualityProfile;
  private readonly clock: WorldClock = createWorldClock();

  private curve!: THREE.CatmullRomCurve3;
  private trailLen = 1;
  private stationProgress: number[] = [];
  private stationCount: number;
  private field!: TrailField;
  private anchors: LandmarkAnchor[] = [];

  private terrain!: Terrain;
  private lighting!: Lighting;
  private forest!: Forest;
  private undergrowth!: Undergrowth;
  private canopy!: Canopy;
  private landmarks!: StationLandmarksHandle;
  private mist!: Mist;
  private shafts!: LightShafts;
  private particles!: Particles;
  private wildlife!: Wildlife;

  // scroll state
  private targetProgress  = 0;
  private currentProgress = 0;
  private lastScrollAt    = 0;
  private activeIndex     = -1;
  private travel: { from: number; to: number; elapsed: number; duration: number } | null = null;
  private motion = true;
  private settled = false;
  private lastHover: number | null = null;
  private viewMatrix = new THREE.Matrix4();
  private viewQuaternion = new THREE.Quaternion();
  private previousProgress = 0;
  private smoothedSpeed = 0;
  private cameraY = NaN;
  private viewAspect = 1;
  private readonly focus = new THREE.Vector3();
  private lookY = NaN;
  private readonly camPos = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private renderPixelRatio = 1;
  private qualityElapsed = 0;
  private qualityFrames = 0;
  private qualityAdjustments = 0;
  private qualitySettled = false;
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
    this.tier = initialTier(this.mobile);
    this.profile = QUALITY[this.tier];

    this.initRenderer();
    this.initScene();
    this.initCamera();

    // Trail first: everything else is placed relative to it.
    this.buildTrail();
    const tmp = new THREE.Vector3();
    this.field = TrailField.fromSampler((u) => this.curve.getPointAt(u, tmp), 1200);
    const zones = ACTIVE_ZONES.slice(0, this.stationCount);
    this.anchors = planLandmarkAnchors(zones, this.stationProgress, this.curve, this.field);

    // Terrain fills anchor.y, so it must exist before anything is placed on it.
    this.terrain = new Terrain(this.field, this.anchors, this.profile);
    this.scene.add(this.terrain.mesh);

    this.lighting = new Lighting(this.scene, this.profile);
    if (this.profile.environment) {
      void applyEnvironment(this.scene, this.renderer, () => this.disposed).then((dispose) => {
        if (this.disposed) dispose?.();
        else this.disposeEnvironment = dispose;
      });
    }

    this.forest = new Forest(this.field, this.terrain, this.anchors, this.profile, this.clock);
    this.scene.add(this.forest.group);
    this.undergrowth = new Undergrowth(this.field, this.terrain, this.anchors, this.profile, this.clock);
    this.scene.add(this.undergrowth.group);
    this.canopy = new Canopy(this.field, this.terrain, this.profile, this.clock, this.forest.crownsNear(this.field, 9));
    this.scene.add(this.canopy.group);

    this.landmarks = buildStationLandmarks(
      zones, this.anchors, this.stationProgress, this.terrain,
      this.forest.barkMat, this.clock, this.profile, this.camera,
    );
    this.scene.add(this.landmarks.group);

    this.mist = new Mist(this.field, this.terrain, this.profile);
    this.scene.add(this.mist.group);
    this.shafts = new LightShafts(this.field, this.terrain, this.lighting.sunDir, this.profile);
    this.scene.add(this.shafts.group);
    this.particles = new Particles(this.terrain, this.profile, this.clock);
    this.scene.add(this.particles.group);
    this.wildlife = new Wildlife(this.field, this.anchors, this.profile);
    this.scene.add(this.wildlife.group);

    this.placeCameraAtProgress(0, 1, true);

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
    this.targetProgress = THREE.MathUtils.clamp(this.targetProgress + d, 0, 1);
    if (!this.motion) this.currentProgress = this.targetProgress;
    this.lastScrollAt = performance.now();
  }

  setPointer(x: number, y: number): void {
    this.pointer.set(x, y);
  }

  /** Station whose landmark is under the pointer, or null. */
  pickStation(): number | null {
    return this.proxyUnderPointer();
  }

  jumpToStation(idx: number): void {
    if (idx < 0 || idx >= this.stationProgress.length) return;
    this.settled = false;
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

  setMotion(enabled: boolean): void {
    this.motion = enabled;
    if (!enabled) {
      this.currentProgress = this.targetProgress;
      this.travel = null;
    }
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
    this.disposeEnvironment = null;
    this.terrain?.dispose();
    this.forest?.dispose();
    this.undergrowth?.dispose();
    this.canopy?.dispose();
    this.landmarks?.dispose();
    this.mist?.dispose();
    this.shafts?.dispose();
    this.particles?.dispose();
    this.wildlife?.dispose();
    this.lighting?.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) geometries.add(m.geometry);
      if (m.material) {
        const mat = m.material as THREE.Material | THREE.Material[];
        for (const material of Array.isArray(mat) ? mat : [mat]) {
          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
          const uniforms = (material as THREE.ShaderMaterial).uniforms;
          if (uniforms) {
            Object.values(uniforms).forEach((u) => {
              if (u?.value instanceof THREE.Texture) textures.add(u.value);
            });
          }
        }
      }
    });
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
    geometries.forEach((g) => g.dispose());
    clearTextureCache();
    this.renderer?.dispose();
  }

  // ---------------- init ----------------
  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.profile.antialias,
      powerPreference: this.mobile ? 'low-power' : 'high-performance',
    });
    this.renderPixelRatio = Math.min(window.devicePixelRatio, this.profile.maxDpr);
    this.renderer.setPixelRatio(this.renderPixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.outputColorSpace    = THREE.SRGBColorSpace;
    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled   = this.profile.shadows;
    // PCFSoftShadowMap is deprecated in three r0.184; PCF with a radius is the soft path.
    this.renderer.shadowMap.type      = THREE.PCFShadowMap;
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(MIST_PALETTE[0].getHex(), this.profile.fogDensity);
    this.scene.fog = this.fog;
    // The very same Color instance: the per-station palette lerp moves the sky
    // and the fog together, so distant geometry dissolves with no horizon line.
    this.scene.background = this.fog.color;
  }

  private initCamera(): void {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    this.camera = new THREE.PerspectiveCamera(this.fovForAspect(aspect), aspect, 0.1, this.profile.cameraFar);
    this.applyFraming(this.canvas.clientWidth, this.canvas.clientHeight);
  }

  /**
   * Portrait phones show the station card as a bottom sheet, so the view is
   * re-centred with a view offset: the optical axis (horizon) sits ~30% from
   * the top and the landmark stays visible above the sheet.
   */
  private applyFraming(w: number, h: number): void {
    w = Math.max(1, w);
    h = Math.max(1, h);
    this.viewAspect = w / h;
    if (this.viewAspect < PORTRAIT_ASPECT) {
      const fullH = h * (1 + 2 * PORTRAIT_SHIFT);
      this.camera.aspect = w / fullH;
      this.camera.fov = this.fovForAspect(this.viewAspect);
      this.camera.setViewOffset(w, fullH, 0, fullH - h, w, h);
    } else {
      this.camera.aspect = this.viewAspect;
      this.camera.fov = this.fovForAspect(this.viewAspect);
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
  }

  /** Vertical FOV; wider on portrait / small screens so the landmark stays in frame. */
  private fovForAspect(aspect: number): number {
    // Portrait: the full (offset) frustum is taller than the visible window.
    if (aspect < PORTRAIT_ASPECT) return 90;
    if (aspect < 1.15) return 60;
    if (this.mobile && aspect < 1.6) return 58;
    return 55;
  }

  // ---------------- trail ----------------
  private buildTrail(): void {
    const SCALE = 6;
    // A loop through the forest. The return leg swings wide (the original
    // waypoints ran it 3-6 m beside the outbound leg for ~150 m, which read as
    // a double road once the corridor was narrowed); legs now stay >= 15 m apart.
    const wp = [
      { x:   0, z:   0 },
      { x:   0, z:   5 },
      { x:   8, z:  10 },
      { x:  -4, z:   7 },
      { x: -20, z: -20 },
      { x:  -3, z: -13 },
      { x:  -2, z:  -3 },
    ];
    // y = 0: every height comes from the terrain.
    const points = wp.map((p) => new THREE.Vector3(p.x * SCALE, 0, p.z * SCALE));
    // 'centripetal' avoids overshoot/loops at the sharp turns.
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);

    const lengths = this.curve.getLengths(200);
    this.trailLen = lengths[lengths.length - 1];

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
  private placeCameraAtProgress(p: number, dt = 1, snap = false): void {
    const pos = this.curve.getPointAt(p, this.camPos);

    // Near the end of the trail `getPointAt(p + lookAhead)` collapses onto
    // `pos`; extrapolate along the final tangent instead so the view stays level.
    const lookAhead = 0.016 + Math.min(0.018, Math.abs(this.smoothedSpeed) * 0.012);
    if (p < 1 - lookAhead) {
      this.curve.getPointAt(Math.min(1, p + lookAhead), this.lookAt);
    } else {
      this.curve.getTangentAt(1, this.tangent).normalize();
      this.lookAt.copy(pos).addScaledVector(this.tangent, 6);
    }

    // Eye height follows the terrain (eased while moving, exact otherwise).
    const eyeY = this.terrain.heightAt(pos.x, pos.z) + EYE_HEIGHT;
    let lookTargetY = this.terrain.heightAt(this.lookAt.x, this.lookAt.z) + EYE_HEIGHT - 0.15;

    // Arriving at a stop: turn toward its landmark. Strongly on narrow portrait
    // screens (the landmark is otherwise outside the ~35 degree wide view),
    // gently on wide ones where it is already in frame.
    let nearest = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.stationProgress.length; i++) {
      const d = Math.abs(this.stationProgress[i] - p);
      if (d < bestD) { bestD = d; nearest = i; }
    }
    const proxy = this.landmarks?.hitProxies[nearest];
    if (proxy) {
      const strength = this.viewAspect < PORTRAIT_ASPECT ? 0.8 : this.viewAspect < 1.15 ? 0.5 : 0.22;
      const w = (1 - THREE.MathUtils.smoothstep(bestD, 0.003, 0.03)) * strength;
      if (w > 0) {
        this.focus.copy(proxy.position);
        this.lookAt.x += (this.focus.x - this.lookAt.x) * w;
        this.lookAt.z += (this.focus.z - this.lookAt.z) * w;
        lookTargetY += (this.focus.y - 0.4 - lookTargetY) * w;
      }
    }
    if (snap || !this.motion || !Number.isFinite(this.cameraY)) {
      this.cameraY = eyeY;
      this.lookY = lookTargetY;
    } else {
      const k = 1 - Math.exp(-8 * dt);
      this.cameraY += (eyeY - this.cameraY) * k;
      this.lookY += (lookTargetY - this.lookY) * k;
    }
    pos.y = this.cameraY;
    this.lookAt.y = this.lookY;

    this.camera.position.copy(pos);
    this.viewMatrix.lookAt(pos, this.lookAt, this.camera.up);
    this.viewQuaternion.setFromRotationMatrix(this.viewMatrix);
    this.camera.quaternion.slerp(this.viewQuaternion, this.motion && !snap ? 1 - Math.exp(-12 * dt) : 1);

    const baseFov = this.fovForAspect(this.viewAspect);
    const targetFov = baseFov + Math.min(2.2, Math.abs(this.smoothedSpeed) * 1.5);
    const nextFov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-5 * dt));
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
  }

  private updateAtmosphere(activeIdx: number, dt: number): void {
    const idx = THREE.MathUtils.clamp(activeIdx, 0, MIST_PALETTE.length - 1);
    const blend = this.motion ? 1 - Math.exp(-0.65 * dt) : 1;
    // scene.background is this same Color instance.
    this.fog.color.lerp(MIST_PALETTE[idx], blend);
    const sun = this.lighting.sun;
    sun.color.lerp(LIGHT_PALETTE[idx], blend);
    const target = this.lighting.baseSunIntensity * (idx === LIGHT_PALETTE.length - 1 ? 1.08 : 1);
    sun.intensity = THREE.MathUtils.lerp(sun.intensity, target, blend);
  }

  // ---------------- quality ----------------
  private monitorQuality(rawDt: number): void {
    if (this.qualitySettled || document.hidden) return;
    this.qualityElapsed += rawDt;
    if (this.qualityElapsed < 1) return; // ignore shader-compile warm-up
    this.qualityFrames++;
    if (this.qualityElapsed < 4) return;
    const fps = this.qualityFrames / Math.max(0.1, this.qualityElapsed - 1);
    const next = lowerTier(this.tier);
    if (fps < 48 && next && this.qualityAdjustments < MAX_QUALITY_ADJUSTMENTS) {
      this.applyTier(next);
      this.qualityAdjustments++;
      this.qualityElapsed = 0;
      this.qualityFrames = 0;
      if (this.qualityAdjustments >= MAX_QUALITY_ADJUSTMENTS) this.qualitySettled = true;
    } else {
      this.qualitySettled = true;
    }
  }

  /** Drop to a cheaper tier without rebuilding anything. */
  private applyTier(tier: QualityTier): void {
    const prev = this.profile;
    this.tier = tier;
    this.profile = QUALITY[tier];
    const p = this.profile;

    this.renderPixelRatio = Math.min(window.devicePixelRatio, p.maxDpr);
    this.renderer.setPixelRatio(this.renderPixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.fog.density = p.fogDensity;
    this.camera.far = p.cameraFar;
    this.camera.updateProjectionMatrix();

    if (prev.shadows && !p.shadows) {
      this.renderer.shadowMap.enabled = false;
      this.lighting.setShadows(false, 0);
      // Shadow-receiving shaders must recompile without the shadow chunks.
      this.scene.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!mat) return;
        for (const m of Array.isArray(mat) ? mat : [mat]) m.needsUpdate = true;
      });
    }
    this.terrain.setTier(p);
    this.forest.setTier(p);
    this.undergrowth.setTier(p);
    this.canopy.setTier(p);
    this.landmarks.setTier(p);
    this.mist.setTier(p);
    this.shafts.setTier(p);
    this.particles.setTier(p);
    this.wildlife.setTier(p);
  }

  // ---------------- picking ----------------
  private proxyUnderPointer(): number | null {
    if (Math.abs(this.pointer.x) > 1 || Math.abs(this.pointer.y) > 1) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.landmarks.hitProxies, false);
    const idx = hits[0]?.object.userData['stationIndex'];
    return typeof idx === 'number' ? idx : null;
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

    // Snap when idle, but only once already close to the intended target, so a
    // long jump is not short-circuited by whichever station it passes.
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
    this.camera.getWorldDirection(this.forward);
    this.lighting.follow(this.camera.position, this.forward);

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

    // World systems. Reduced motion freezes the shared clock (all sway), mist
    // drift, particles, wildlife and landmark animation; the mist still
    // follows the camera so it never lags behind.
    const camPos = this.camera.position;
    const camU = this.currentProgress;
    if (this.motion) this.clock.time.value += dt;
    this.mist.update(dt, camPos, camU, this.fog.color, this.motion);
    this.shafts.update(dt, camPos, camU, this.lighting.sun.color, this.motion);
    // Pixels per unit of tan(angle); the portrait view offset renders a window
    // of a frustum that is (1 + 2 * shift) times taller than the canvas.
    const frustumScale = this.viewAspect < PORTRAIT_ASPECT ? 1 + 2 * PORTRAIT_SHIFT : 1;
    const pxScale = (this.renderer.domElement.height * frustumScale) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    this.particles.update(dt, camPos, this.forward, pxScale, this.motion);
    this.wildlife.update(dt, camPos, camU, this.motion);
    this.landmarks.update(dt, this.activeIndex, this.currentProgress, this.motion);

    // hover detect
    const hover = this.proxyUnderPointer();
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
    this.mobile = isMobileLayout();
    this.applyFraming(w, h);
    this.renderer.setSize(w, h, false);
  }
}
