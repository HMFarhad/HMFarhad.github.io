import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  PLATFORM_ID, NgZone, inject, signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ACTIVE_ZONES } from '../../core/content/zones';
import type { Zone } from '../../core/content/zone.model';

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [],
  host: { ngSkipHydration: 'true' },
  templateUrl: './experience.component.html',
  styleUrl: './experience.component.scss'
})
export class ExperienceComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  private zone       = inject(NgZone);

  private scene: any = null;
  private detachInput: (() => void) | null = null;

  zones: Zone[] = ACTIVE_ZONES;
  activeIndex = signal(0);
  hoverIndex  = signal<number | null>(null);
  showHint    = signal(true);

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Run three.js outside Angular zone so its rAF loop doesn't trigger CD.
    this.zone.runOutsideAngular(() => {
      // Defer one frame so hydration finishes before WebGL binds the canvas.
      requestAnimationFrame(async () => {
        const { ForestScene } = await import('../../three/forest-scene');
        const canvas = this.canvasRef.nativeElement;
        this.scene = new ForestScene(canvas, ACTIVE_ZONES.length);

        this.scene.onActiveZoneChange = (idx: number) => {
          // Bring back into zone for signal -> view.
          this.zone.run(() => this.activeIndex.set(idx));
        };
        this.scene.onLandmarkHover = (idx: number | null) => {
          this.zone.run(() => this.hoverIndex.set(idx));
        };

        this.detachInput = this.attachInput(canvas);
      });
    });
  }

  ngOnDestroy(): void {
    this.detachInput?.();
    this.scene?.dispose?.();
    this.scene = null;
  }

  // ---------------- input ----------------
  private attachInput(canvas: HTMLCanvasElement): () => void {
    const scrollRange = 9000;
    const touchMul    = 1.2;

    let touchY: number | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.showHint.set(false);
      this.scene?.addScrollDelta(e.deltaY / scrollRange);
    };
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null; };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY == null) return;
      const y = e.touches[0]?.clientY;
      if (y == null) return;
      e.preventDefault();
      this.showHint.set(false);
      const dy = touchY - y;
      touchY = y;
      this.scene?.addScrollDelta((dy * touchMul) / scrollRange);
    };
    const onTouchEnd = () => { touchY = null; };

    const onMouseMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width)  *  2 - 1;
      const y = ((e.clientY - r.top)  / r.height) * -2 + 1;
      this.scene?.setPointer(x, y);
    };
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width)  *  2 - 1;
      const y = ((e.clientY - r.top)  / r.height) * -2 + 1;
      this.scene?.setPointer(x, y);
      // Prefer link pills on the holo-panel over a station jump so the
      // "Visit Site" buttons feel like real buttons.
      const url = this.scene?.pickLink();
      if (url) {
        window.open(url, '_blank', 'noopener');
        return;
      }
      const idx = this.scene?.pickStation();
      if (typeof idx === 'number') this.scene?.jumpToStation(idx);
    };
    const onKey = (e: KeyboardEvent) => {
      const last = this.zones.length - 1;
      const cur  = this.activeIndex();
      switch (e.key) {
        case 'PageDown':
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          this.scene?.jumpToStation(Math.min(last, cur + 1));
          break;
        case 'PageUp':
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          this.scene?.jumpToStation(Math.max(0, cur - 1));
          break;
        case 'Home':
          e.preventDefault();
          this.scene?.jumpToStation(0);
          break;
        case 'End':
          e.preventDefault();
          this.scene?.jumpToStation(last);
          break;
      }
    };

    canvas.addEventListener('wheel',      onWheel,      { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true  });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: true  });
    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('click',      onClick);
    window.addEventListener('keydown',    onKey);

    return () => {
      canvas.removeEventListener('wheel',      onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
      canvas.removeEventListener('mousemove',  onMouseMove);
      canvas.removeEventListener('click',      onClick);
      window.removeEventListener('keydown',    onKey);
    };
  }

  // Helper for HUD: zone title at index.
  zoneTitle(i: number | null): string | null {
    if (i == null || i < 0 || i >= this.zones.length) return null;
    return this.zones[i].title;
  }

  /** True when the walker is parked at the Contact zone. */
  isContactActive(): boolean {
    const z = this.zones[this.activeIndex()];
    return !!z && z.id === 'contact';
  }

  /** Navigate to a zone via the mini-map. */
  goToZone(i: number): void {
    this.scene?.jumpToStation?.(i);
  }

  /** Email + clickable links to render as a real DOM overlay. */
  contactLinks(): { email: string; links: { label: string; url: string }[] } | null {
    const z = this.zones.find((zz) => zz.id === 'contact');
    if (!z || z.id !== 'contact') return null;
    return { email: z.payload.email, links: z.payload.links };
  }
}
