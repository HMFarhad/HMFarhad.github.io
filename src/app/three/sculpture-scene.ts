import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** A self-contained sculpture. Portfolio content never depends on WebGL. */
export class SculptureScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private group = new THREE.Group();
  private sculpture: THREE.Mesh;
  private material: THREE.MeshPhysicalMaterial;
  private environment: THREE.WebGLRenderTarget;
  private observer: ResizeObserver;
  private intersection: IntersectionObserver;
  private frame = 0;
  private last = 0;
  private elapsed = 0;
  private visible = true;
  private disposed = false;
  private reducedMotion: boolean;
  private pointer = new THREE.Vector2();
  private dragX = 0;
  private dragging = false;
  private previousX = 0;
  private satellites: THREE.Mesh[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    motion: boolean,
    private onFailure: () => void,
  ) {
    this.reducedMotion = !motion;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.4 : 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    const studio = new RoomEnvironment();
    for (const [x, y, z, sx, sy, color] of [
      [-3, 4, 2, 3, 5, 0xf4ffde],
      [4, 1, 1, 2, 6, 0xabbef3],
      [0, -3, 3, 4, 1, 0xd9f78b],
    ]) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(sx, sy),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
      );
      panel.position.set(x, y, z);
      panel.lookAt(0, 0, 0);
      studio.add(panel);
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(studio, 0.04);
    this.scene.environment = this.environment.texture;
    studio.dispose();
    pmrem.dispose();
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xdce9c2,
      metalness: 1,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      iridescence: 0.55,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [100, 330],
      side: THREE.DoubleSide,
    });
    this.sculpture = new THREE.Mesh(this.ribbonGeometry(), this.material);
    this.group.add(this.sculpture);
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, 0.006, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0x91a373, transparent: true, opacity: 0.28 }),
    );
    orbit.rotation.set(1.15, 0.3, -0.25);
    this.group.add(orbit);
    const orbMaterial = new THREE.MeshStandardMaterial({
      color: 0xc5e7a1,
      metalness: 1,
      roughness: 0.16,
    });
    for (let i = 0; i < 3; i++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(i === 0 ? 0.17 : 0.07, 24, 24),
        orbMaterial,
      );
      this.satellites.push(orb);
      this.group.add(orb);
    }
    this.scene.add(this.group);
    this.scene.add(new THREE.HemisphereLight(0xeaf7d8, 0x242433, 2));
    const light = new THREE.DirectionalLight(0xe5fcb4, 4);
    light.position.set(-3, 4, 5);
    this.scene.add(light);
    const fill = new THREE.DirectionalLight(0xb5c6ff, 2);
    fill.position.set(4, -2, 3);
    this.scene.add(fill);
    this.camera.position.set(0, 0, 9.3);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.intersection = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting;
        this.updateLoop();
      },
      { rootMargin: '100px' },
    );
    this.intersection.observe(canvas);
    canvas.addEventListener('pointermove', this.onPointer);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('webglcontextlost', this.onLost);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
    this.updateLoop();
  }
  private ribbonGeometry(): THREE.BufferGeometry {
    const vertices: number[] = [],
      indices: number[] = [],
      uvs: number[] = [];
    const rings = 240,
      sides = 20;
    // Closed ribbon with a full twist and rounded rectangular cross-section.
    for (let i = 0; i <= rings; i++) {
      const t = (i / rings) * Math.PI * 2;
      const radial = new THREE.Vector3(Math.cos(t), Math.sin(t), 0);
      const center = radial.clone().multiplyScalar(1.52 + 0.12 * Math.cos(t * 3));
      center.z = 0.3 * Math.sin(t * 2);
      const a = radial
        .clone()
        .multiplyScalar(Math.cos(t))
        .add(new THREE.Vector3(0, 0, Math.sin(t)));
      const b = radial
        .clone()
        .multiplyScalar(-Math.sin(t))
        .add(new THREE.Vector3(0, 0, Math.cos(t)));
      for (let j = 0; j <= sides; j++) {
        const v = (j / sides) * Math.PI * 2;
        const c = Math.cos(v),
          s = Math.sin(v);
        const p = center
          .clone()
          .addScaledVector(a, 0.64 * Math.sign(c) * Math.pow(Math.abs(c), 0.55))
          .addScaledVector(b, 0.085 * Math.sign(s) * Math.pow(Math.abs(s), 0.55));
        vertices.push(p.x, p.y, p.z);
        uvs.push(i / rings, j / sides);
        if (i < rings && j < sides) {
          const k = i * (sides + 1) + j;
          indices.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  setShape(index: number): void {
    this.sculpture.geometry.dispose();
    this.sculpture.geometry =
      index === 0
        ? this.ribbonGeometry()
        : index === 1
          ? new THREE.TorusKnotGeometry(1.14, 0.36, 180, 24, 2, 3)
          : new THREE.IcosahedronGeometry(1.9, 0);
    this.material.flatShading = index === 2;
    this.material.color.setHex([0xdce9c2, 0xc8d2f0, 0xe7c995][index]);
    this.material.needsUpdate = true;
    this.render();
  }
  setMotion(enabled: boolean): void {
    this.reducedMotion = !enabled;
    this.pointer.set(0, 0);
    this.updateLoop();
    this.render();
  }
  private resize(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.position.z = this.camera.aspect < 0.85 ? 11 : 9.3;
    this.camera.updateProjectionMatrix();
    this.render();
  }
  private onPointer = (event: PointerEvent) => {
    if (this.reducedMotion) return;
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - r.left) / r.width - 0.5) * 2,
      ((event.clientY - r.top) / r.height - 0.5) * 2,
    );
    if (this.dragging) {
      this.dragX += (event.clientX - this.previousX) * 0.007;
      this.previousX = event.clientX;
    }
  };
  private onDown = (e: PointerEvent) => {
    if (this.reducedMotion) return;
    this.dragging = true;
    this.previousX = e.clientX;
    this.canvas.setPointerCapture(e.pointerId);
  };
  private onUp = () => {
    this.dragging = false;
  };
  private onLeave = () => {
    this.pointer.set(0, 0);
  };
  private onLost = (e: Event) => {
    e.preventDefault();
    this.dispose();
    this.onFailure();
  };
  private onVisibility = () => this.updateLoop();
  private updateLoop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.last = 0;
    if (!this.disposed && this.visible && !document.hidden && !this.reducedMotion)
      this.frame = requestAnimationFrame(this.tick);
  }
  private tick = (time: number) => {
    if (this.disposed) return;
    this.elapsed += this.last ? Math.min((time - this.last) / 1000, 0.05) : 0;
    this.last = time;
    this.render();
    this.frame = requestAnimationFrame(this.tick);
  };
  private render(): void {
    if (this.disposed) return;
    const t = this.elapsed;
    this.group.rotation.set(
      0.2 + this.pointer.y * 0.08,
      -0.3 + this.pointer.x * 0.12 + this.dragX + t * 0.07,
      -0.35 + Math.sin(t * 0.12) * 0.12,
    );
    this.group.position.y = Math.sin(t * 0.45) * 0.07;
    this.satellites.forEach((orb, i) => {
      const a = t * 0.12 + i * 2.2;
      orb.position.set(Math.cos(a) * 2.4, Math.sin(a) * 1.7, Math.sin(a) * 0.7);
    });
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.intersection.disconnect();
    this.canvas.removeEventListener('pointermove', this.onPointer);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    document.removeEventListener('visibilitychange', this.onVisibility);
    const materials = new Set<THREE.Material>();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materials.add(m));
      }
    });
    materials.forEach((m) => m.dispose());
    this.environment.dispose();
    this.renderer.dispose();
  }
}
