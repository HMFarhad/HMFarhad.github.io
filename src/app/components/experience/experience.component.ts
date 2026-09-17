import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  PLATFORM_ID, NgZone, inject, signal, InjectionToken
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ACTIVE_ZONES } from '../../core/content/zones';
import type { Zone } from '../../core/content/zone.model';
import { isMobileLayout } from '../../core/device';
import { ensureHoloFonts } from '../../core/holo-fonts';
import type { ForestScene } from '../../three/forest-scene';
import { EmailService, ContactFormData } from '../../core/email.service';

export const FOREST_LOADER = new InjectionToken('FOREST_LOADER', {
  providedIn: 'root', factory: () => () => import('../../three/forest-scene'),
});

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [FormsModule],
  host: { ngSkipHydration: 'true' },
  templateUrl: './experience.component.html',
  styleUrl: './experience.component.scss'
})
export class ExperienceComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('reader', { static: true }) readerRef!: ElementRef<HTMLDialogElement>;

  private platformId = inject(PLATFORM_ID);
  private zone       = inject(NgZone);
  private email      = inject(EmailService);

  private loadScene = inject(FOREST_LOADER);
  private scene: ForestScene | null = null;
  private destroyed = false;
  private motionMq: MediaQueryList | null = null;
  private onMotionMqChange = () => {
    this.motion.set(!this.motionMq?.matches);
    this.scene?.setMotion(this.motion());
  };
  sceneInitialization: Promise<void> = Promise.resolve();
  private detachInput: (() => void) | null = null;

  zones: Zone[] = ACTIVE_ZONES;
  activeIndex = signal(0);
  hoverIndex  = signal<number | null>(null);
  showHint    = signal(true);
  isMobile    = signal(false);
  sceneReady = signal(false);
  sceneFailed = signal(false);
  motion = signal(true);
  settled = signal(false);
  carousel = signal<{ index: number; count: number } | null>(null);

  // Contact form state.
  form: ContactFormData = { name: '', email: '', subject: '', message: '' };
  formOpen     = signal(false);
  isSubmitting = signal(false);
  submitMsg    = signal('');
  submitOk     = signal<boolean | null>(null);
  emailConfigured = signal(false);

  private mobileMq: MediaQueryList | null = null;
  private onMobileMqChange: ((e: MediaQueryListEvent) => void) | null = null;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.isMobile.set(isMobileLayout());
    this.mobileMq = window.matchMedia('(max-width: 768px), (pointer: coarse)');
    this.onMobileMqChange = () => this.isMobile.set(isMobileLayout());
    this.mobileMq.addEventListener('change', this.onMobileMqChange);

    this.motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.onMotionMqChange();
    this.motionMq.addEventListener('change', this.onMotionMqChange);
    this.sceneInitialization = this.zone.runOutsideAngular(() => this.initializeScene());
  }

  private async initializeScene(): Promise<void> {
    try {
      const [, { ForestScene }] = await Promise.all([ensureHoloFonts(), this.loadScene()]);
      if (this.destroyed) return;
      const canvas = this.canvasRef.nativeElement;
      this.scene = new ForestScene(canvas, ACTIVE_ZONES.length);
      this.scene.setMotion(this.motion());
      this.scene.onActiveZoneChange = (idx) => this.zone.run(() => {
        this.activeIndex.set(idx);
        this.closeForm();
      });
      this.scene.onLandmarkHover = (idx) => this.zone.run(() => this.hoverIndex.set(idx));
      this.scene.onStationSettled = (settled) => this.zone.run(() => this.settled.set(settled));
      this.scene.onCarouselChange = (state) => this.zone.run(() => this.carousel.set(state));
      this.detachInput = this.attachInput(canvas);
      this.zone.run(() => this.sceneReady.set(true));
    } catch {
      if (!this.destroyed) this.zone.run(() => this.sceneFailed.set(true));
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.motionMq?.removeEventListener('change', this.onMotionMqChange);
    if (this.mobileMq && this.onMobileMqChange) {
      this.mobileMq.removeEventListener('change', this.onMobileMqChange);
    }
    this.detachInput?.();
    this.scene?.dispose?.();
    this.scene = null;
  }

  // ---------------- input ----------------
  private attachInput(canvas: HTMLCanvasElement): () => void {
    const scrollRange = 9000;
    let startX = 0, startY = 0, lastY = 0;
    let activePointer: number | null = null;
    let moved = false;

    const setPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      this.scene?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1,
        1 - ((e.clientY - r.top) / r.height) * 2);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      this.showHint.set(false);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
      this.scene?.addScrollDelta(e.deltaY * unit / scrollRange);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || activePointer !== null) return;
      activePointer = e.pointerId;
      startX = e.clientX; startY = lastY = e.clientY; moved = false;
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
      setPointer(e);
    };
    const onMove = (e: PointerEvent) => {
      setPointer(e);
      if (e.pointerId !== activePointer) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) moved = true;
      if (moved) {
        this.showHint.set(false);
        this.scene?.addScrollDelta((lastY - e.clientY) * (this.isMobile() ? 1.55 : 1.2) / scrollRange);
      }
      lastY = e.clientY;
    };
    const cancelPointer = () => { activePointer = null; moved = false; };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      setPointer(e);
      if (!moved) {
        const url = this.scene?.pickLink();
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        else {
          const idx = this.scene?.pickStation();
          if (typeof idx === 'number') this.goToZone(idx);
        }
      }
      cancelPointer();
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    const onLeave = () => {
      if (activePointer === null) this.scene?.setPointer(10, 10);
    };
    const onKey = (e: KeyboardEvent) => {
      if (this.readerRef.nativeElement.open) return;
      if (e.ctrlKey || e.metaKey || e.altKey ||
          (e.target instanceof Element && e.target.closest('input, textarea, select, button, a, [contenteditable="true"]'))) return;
      const last = this.zones.length - 1;
      let index: number | undefined;
      switch (e.key) {
        case 'PageDown': case 'ArrowDown': case 'ArrowRight': index = Math.min(last, this.activeIndex() + 1); break;
        case 'PageUp': case 'ArrowUp': case 'ArrowLeft': index = Math.max(0, this.activeIndex() - 1); break;
        case 'Home': index = 0; break;
        case 'End': index = last; break;
      }
      if (index !== undefined) {
        e.preventDefault();
        this.goToZone(index);
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', cancelPointer);
    canvas.addEventListener('lostpointercapture', cancelPointer);
    canvas.addEventListener('pointerleave', onLeave);
    window.addEventListener('keydown', onKey);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', cancelPointer);
      canvas.removeEventListener('lostpointercapture', cancelPointer);
      canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKey);
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
    return this.settled() && !!z && z.id === 'contact';
  }

  /** Navigate to a zone via the mini-map. */
  goToZone(i: number): void {
    this.showHint.set(false);
    this.settled.set(false);
    this.carousel.set(null);
    this.scene?.jumpToStation(i);
  }

  toggleMotion(): void {
    this.motion.update((value) => !value);
    this.scene?.setMotion(this.motion());
  }

  stepCard(direction: number): void {
    this.scene?.stepCarousel(direction);
  }

  openReader(): void {
    this.readerRef.nativeElement.showModal();
    this.scene?.setPaused(true);
  }

  resumeJourney(): void {
    this.scene?.setPaused(false);
  }

  /** Email + clickable links to render as a real DOM overlay. */
  contactLinks(): { email: string; links: { label: string; url: string }[] } | null {
    const z = this.zones.find((zz) => zz.id === 'contact');
    if (!z || z.id !== 'contact') return null;
    return { email: z.payload.email, links: z.payload.links };
  }

  // ---------------- contact form ----------------

  toggleForm(): void {
    this.emailConfigured.set(this.email.isConfigured);
    this.formOpen.update((v) => !v);
    if (!this.formOpen()) this.clearStatus();
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.clearStatus();
  }

  private clearStatus(): void {
    this.submitMsg.set('');
    this.submitOk.set(null);
  }

  formValid(): boolean {
    const f = this.form;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !!(f.name.trim() && emailRe.test(f.email.trim())
      && f.subject.trim() && f.message.trim().length >= 5);
  }

  async onSubmit(): Promise<void> {
    if (this.isSubmitting() || !this.formValid()) return;
    this.isSubmitting.set(true);
    this.clearStatus();

    try {
    const res = await this.email.send({
      name:    this.form.name.trim(),
      email:   this.form.email.trim(),
      subject: this.form.subject.trim(),
      message: this.form.message.trim()
    });

    if (res.success) {
      this.submitOk.set(true);
      this.submitMsg.set(`Thanks ${this.form.name.split(' ')[0]} — your message is on its way.`);
      this.form = { name: '', email: '', subject: '', message: '' };
    } else if (res.notConfigured) {
      this.openMailto();
    } else {
      this.submitOk.set(false);
      this.submitMsg.set(res.error || 'Something went wrong. Please try again.');
    }
    } catch {
      this.submitOk.set(false);
      this.submitMsg.set('Something went wrong. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private openMailto(): void {
    const c = this.contactLinks();
    if (!c) return;
    const subject = encodeURIComponent(this.form.subject || 'Hello from your portfolio');
    const body = encodeURIComponent(
      `Name: ${this.form.name}\nEmail: ${this.form.email}\n\n${this.form.message}`
    );
    window.open(`mailto:${c.email}?subject=${subject}&body=${body}`, '_blank');
    this.submitOk.set(true);
    this.submitMsg.set('Opening your email client…');
  }
}
