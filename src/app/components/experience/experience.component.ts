import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, Injector,
  PLATFORM_ID, NgZone, inject, signal, computed, viewChild, afterNextRender, InjectionToken
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ACTIVE_ZONES } from '../../core/content/zones';
import type { Zone } from '../../core/content/zone.model';
import { isMobileLayout } from '../../core/device';
import { AMBIENCE } from '../../core/audio/ambience';
import type { ForestScene } from '../../three/forest-scene';
import { EmailService, ContactFormData } from '../../core/email.service';
import { StationCardComponent } from './station-card/station-card.component';

type TourState = 'idle' | 'playing' | 'paused' | 'completed';

const TOUR_DWELL_MS = 6500;
/** Wheel deltaY (px) per unit of trail progress. */
const SCROLL_RANGE = 9000;
/** Trail-progress worth of input that turns one card page (~1.6 wheel notches). */
const PAGE_SWIPE_PROGRESS = 0.018;
/** Input is ignored this long after a page flip so one gesture turns one page. */
const PAGE_FLIP_LOCK_MS = 320;
/** A partial page gesture is forgotten after this much idle time. */
const PAGE_IDLE_RESET_MS = 700;
const SOUND_KEY = 'forest:sound';

export const FOREST_LOADER = new InjectionToken('FOREST_LOADER', {
  providedIn: 'root', factory: () => () => import('../../three/forest-scene'),
});

/** Paged items for multi-item stops; other stops have a single page. */
export function zoneItems(zone: Zone | undefined): readonly unknown[] {
  if (!zone) return [];
  switch (zone.id) {
    case 'experience': case 'projects': case 'blogs': return zone.payload.items;
    default: return [];
  }
}

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [FormsModule, StationCardComponent],
  host: { ngSkipHydration: 'true' },
  templateUrl: './experience.component.html',
  styleUrl: './experience.component.scss'
})
export class ExperienceComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('menu', { static: true }) menuRef!: ElementRef<HTMLElement>;
  private card = viewChild(StationCardComponent);

  private platformId = inject(PLATFORM_ID);
  private zone       = inject(NgZone);
  private email      = inject(EmailService);
  private ambience   = inject(AMBIENCE);
  private injector   = inject(Injector);

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
  private detachSoundGesture: (() => void) | null = null;
  private tourTimer: ReturnType<typeof setTimeout> | null = null;
  private tourProgressTimer: ReturnType<typeof setInterval> | null = null;
  private tourDwellStartedAt = 0;
  private tourDwellDuration = TOUR_DWELL_MS;
  private tourRemainingMs = TOUR_DWELL_MS;
  private scenePaused = false;
  private focusCardOnArrival = false;
  private pageAccum = 0;
  private lastPageInputAt = 0;
  private lastFlipAt = 0;
  private onVisibilityChange = () => {
    if (document.hidden) {
      if (this.tourState() === 'playing') this.pauseTour();
      this.ambience.suspend();
    } else if (!this.scenePaused) {
      this.ambience.resume();
    }
  };
  private onDocPointerDown = (e: PointerEvent) => {
    if (this.menuOpen() && !this.menuRef.nativeElement.contains(e.target as Node)) this.menuOpen.set(false);
  };

  zones: Zone[] = ACTIVE_ZONES;
  activeIndex = signal(0);
  hoverIndex  = signal<number | null>(null);
  showHint    = signal(true);
  isMobile    = signal(false);
  sceneReady = signal(false);
  sceneFailed = signal(false);
  motion = signal(true);
  settled = signal(false);
  tourState = signal<TourState>('idle');
  tourProgress = signal(0);
  tourSecondsRemaining = signal(Math.ceil(TOUR_DWELL_MS / 1000));
  visitedZones = signal<ReadonlySet<number>>(new Set([0]));

  /** Current card page per stop, kept while walking elsewhere. */
  pages = signal<number[]>(ACTIVE_ZONES.map(() => 0));
  pageCount = computed(() => Math.max(1, zoneItems(this.zones[this.activeIndex()]).length));
  pageIndex = computed(() => Math.min(this.pages()[this.activeIndex()] ?? 0, this.pageCount() - 1));
  carousel = computed<{ index: number; count: number } | null>(() =>
    this.pageCount() > 1 ? { index: this.pageIndex(), count: this.pageCount() } : null);
  cardOpen = computed(() => this.sceneReady() && this.settled());
  sheetExpanded = signal(false);
  menuOpen = signal(false);
  soundOn = signal(false);

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
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerdown', this.onDocPointerDown, true);
    if (this.readSoundPreference()) {
      this.soundOn.set(true);
      this.armSoundGesture();
    }
    this.sceneInitialization = this.zone.runOutsideAngular(() => this.initializeScene());
  }

  private async initializeScene(): Promise<void> {
    try {
      const { ForestScene } = await this.loadScene();
      if (this.destroyed) return;
      const canvas = this.canvasRef.nativeElement;
      this.scene = new ForestScene(canvas, ACTIVE_ZONES.length);
      this.scene.setMotion(this.motion());
      this.scene.onActiveZoneChange = (idx) => this.zone.run(() => {
        this.activeIndex.set(idx);
        this.visitedZones.update((visited) => {
          if (visited.has(idx)) return visited;
          const next = new Set(visited);
          next.add(idx);
          return next;
        });
        this.sheetExpanded.set(false);
        this.resetPageGesture();
        this.closeForm();
      });
      this.scene.onLandmarkHover = (idx) => this.zone.run(() => this.hoverIndex.set(idx));
      this.scene.onStationSettled = (settled) => this.zone.run(() => {
        this.setSettled(settled);
        if (settled && this.tourState() === 'playing') this.scheduleTourAdvance();
        else if (!settled) {
          this.clearTourTimer();
          this.resetTourProgress();
        }
      });
      this.detachInput = this.attachInput(canvas);
      this.zone.run(() => this.sceneReady.set(true));
    } catch (error) {
      console.error('[experience] Forest initialization failed', error);
      if (!this.destroyed) this.zone.run(() => this.sceneFailed.set(true));
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearTourTimer();
    this.motionMq?.removeEventListener('change', this.onMotionMqChange);
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      document.removeEventListener('pointerdown', this.onDocPointerDown, true);
    }
    if (this.mobileMq && this.onMobileMqChange) {
      this.mobileMq.removeEventListener('change', this.onMobileMqChange);
    }
    this.detachSoundGesture?.();
    this.detachInput?.();
    this.scene?.dispose?.();
    this.scene = null;
    this.ambience.dispose();
  }

  // ---------------- input ----------------

  /**
   * Single funnel for wheel, drag and card overscroll, in trail-progress
   * units. Parked at a multi-page stop, input turns card pages first and
   * only the leftover past the first/last page moves the walker.
   */
  feedScroll(d: number): void {
    if (!d) return;
    const count = this.pageCount();
    if (!(this.settled() && count > 1)) {
      this.scene?.addScrollDelta(d);
      return;
    }
    const now = Date.now();
    if (now - this.lastFlipAt < PAGE_FLIP_LOCK_MS) return;
    if (now - this.lastPageInputAt > PAGE_IDLE_RESET_MS) this.pageAccum = 0;
    this.lastPageInputAt = now;
    this.pageAccum += d;
    const page = this.pageIndex();
    if (this.pageAccum >= PAGE_SWIPE_PROGRESS && page < count - 1) {
      this.setPage(page + 1);
      return;
    }
    if (this.pageAccum <= -PAGE_SWIPE_PROGRESS && page > 0) {
      this.setPage(page - 1);
      return;
    }
    const spill = (page === count - 1 && this.pageAccum > 0) || (page === 0 && this.pageAccum < 0);
    if (spill) {
      const leftover = this.pageAccum;
      this.pageAccum = 0;
      this.scene?.addScrollDelta(leftover);
    }
  }

  private attachInput(canvas: HTMLCanvasElement): () => void {
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
      this.takeControl();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
      this.feedScroll(e.deltaY * unit / SCROLL_RANGE);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || activePointer !== null) return;
      activePointer = e.pointerId;
      startX = e.clientX; startY = lastY = e.clientY; moved = false;
      canvas.setPointerCapture?.(e.pointerId);
      canvas.focus({ preventScroll: true });
      setPointer(e);
    };
    const onMove = (e: PointerEvent) => {
      setPointer(e);
      if (e.pointerId !== activePointer) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) moved = true;
      if (moved) {
        this.takeControl();
        this.feedScroll((lastY - e.clientY) * (this.isMobile() ? 1.55 : 1.2) / SCROLL_RANGE);
      }
      lastY = e.clientY;
    };
    const cancelPointer = () => { activePointer = null; moved = false; };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      setPointer(e);
      if (!moved) {
        this.exitTour();
        const idx = this.scene?.pickStation();
        if (typeof idx === 'number') {
          if (idx === this.activeIndex() && this.settled()) this.card()?.focusTitle();
          else this.goToZone(idx);
        }
      }
      cancelPointer();
      if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    const onLeave = () => {
      if (activePointer === null) this.scene?.setPointer(10, 10);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.handleEscape()) e.preventDefault();
        return;
      }
      const target = e.target instanceof Element ? e.target : null;
      if (e.ctrlKey || e.metaKey || e.altKey ||
          target?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      // Let the card body scroll with the vertical keys while it has focus.
      if (target?.closest('.card-body') && !e.key.startsWith('ArrowL') && !e.key.startsWith('ArrowR')) return;
      const card = this.carousel();
      if (this.settled() && card) {
        if (e.key === 'ArrowRight' && card.index < card.count - 1) {
          e.preventDefault();
          this.stepCard(1);
          return;
        }
        if (e.key === 'ArrowLeft' && card.index > 0) {
          e.preventDefault();
          this.stepCard(-1);
          return;
        }
      }
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
        this.exitTour();
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

  /** Free exploration ends the guided journey and the first-visit hint. */
  private takeControl(): void {
    this.exitTour();
    this.showHint.set(false);
  }

  /** Escape closes the innermost open thing: menu, then sheet, then form. */
  private handleEscape(): boolean {
    if (this.menuOpen()) { this.menuOpen.set(false); return true; }
    if (this.sheetExpanded()) { this.sheetExpanded.set(false); return true; }
    if (this.formOpen()) { this.closeForm(); return true; }
    return false;
  }

  onCardOverscroll(px: number): void {
    this.takeControl();
    this.feedScroll(px / SCROLL_RANGE);
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

  /**
   * Navigate to a zone. Explicit navigation (rail, keys, landmark click,
   * Continue) moves focus to the card title on arrival; the tour does not.
   */
  goToZone(i: number, guided = false): void {
    if (!guided) this.exitTour();
    this.showHint.set(false);
    this.focusCardOnArrival = !guided;
    this.setSettled(false);
    this.scene?.jumpToStation(i);
  }

  continueTrail(): void {
    this.goToZone((this.activeIndex() + 1) % this.zones.length);
  }

  private setSettled(settled: boolean): void {
    if (!settled) {
      const host = this.card()?.host.nativeElement;
      if (host && typeof document !== 'undefined' && host.contains(document.activeElement)) {
        this.canvasRef.nativeElement.focus({ preventScroll: true });
      }
    }
    this.settled.set(settled);
    this.resetPageGesture();
    if (settled && this.focusCardOnArrival) {
      this.focusCardOnArrival = false;
      afterNextRender({ write: () => this.card()?.focusTitle() }, { injector: this.injector });
    }
  }

  toggleMotion(): void {
    this.motion.update((value) => !value);
    this.scene?.setMotion(this.motion());
  }

  // ---------------- card pages ----------------

  /** Show page `index` of the active stop. Returns true when it changed. */
  setPage(index: number): boolean {
    const next = Math.max(0, Math.min(this.pageCount() - 1, index));
    if (next === this.pageIndex()) return false;
    const zone = this.activeIndex();
    this.pages.update((pages) => pages.map((p, i) => (i === zone ? next : p)));
    this.lastFlipAt = Date.now();
    this.pageAccum = 0;
    return true;
  }

  stepCard(direction: number): boolean {
    this.exitTour();
    this.showHint.set(false);
    return this.setPage(this.pageIndex() + direction);
  }

  private resetPageGesture(): void {
    this.pageAccum = 0;
    this.lastPageInputAt = 0;
  }

  // ---------------- sound ----------------

  toggleSound(): void {
    const on = !this.soundOn();
    this.soundOn.set(on);
    this.detachSoundGesture?.();
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ }
    if (on) this.startAmbience();
    else this.ambience.stop();
  }

  private readSoundPreference(): boolean {
    try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; }
  }

  /** Browsers only allow audio after a gesture: wait for the first one. */
  private armSoundGesture(): void {
    const onGesture = () => {
      this.detachSoundGesture?.();
      if (this.soundOn() && !this.destroyed) this.startAmbience();
    };
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    this.detachSoundGesture = () => {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      this.detachSoundGesture = null;
    };
  }

  private startAmbience(): void {
    Promise.resolve(this.ambience.start()).catch(() => undefined);
    if (this.scenePaused || document.hidden) this.ambience.suspend();
  }

  private setScenePaused(paused: boolean): void {
    this.scenePaused = paused;
    this.scene?.setPaused(paused);
    if (paused) this.ambience.suspend();
    else if (!document.hidden) this.ambience.resume();
  }

  // ---------------- guided journey ----------------

  startTour(): void {
    if (!this.sceneReady()) return;
    this.clearTourTimer();
    this.closeForm();
    this.menuOpen.set(false);
    this.pages.set(this.zones.map(() => 0));
    this.resetTourProgress();
    this.tourState.set('playing');
    this.setScenePaused(false);
    this.goToZone(0, true);
  }

  pauseTour(): void {
    if (this.tourState() !== 'playing') return;
    if (this.settled()) this.updateTourProgress();
    this.clearTourTimer();
    this.tourState.set('paused');
    this.setScenePaused(true);
  }

  resumeTour(): void {
    if (this.tourState() !== 'paused') return;
    this.tourState.set('playing');
    this.setScenePaused(false);
    if (this.settled()) this.scheduleTourAdvance(false);
  }

  stepTour(direction: number): void {
    const next = Math.max(0, Math.min(this.zones.length - 1, this.activeIndex() + direction));
    if (next === this.activeIndex()) return;
    this.clearTourTimer();
    this.resetTourProgress();
    this.tourState.set('playing');
    this.setScenePaused(false);
    this.goToZone(next, true);
  }

  exitTour(resumeScene = true): void {
    if (this.tourState() === 'idle') return;
    this.clearTourTimer();
    this.resetTourProgress();
    this.tourState.set('idle');
    if (resumeScene) this.setScenePaused(false);
  }

  private scheduleTourAdvance(reset = true): void {
    this.clearTourTimer();
    if (reset) this.resetTourProgress();
    this.tourDwellDuration = this.tourRemainingMs;
    this.tourDwellStartedAt = Date.now();
    const update = () => this.zone.run(() => this.updateTourProgress());
    this.tourProgressTimer = setInterval(update, 100);
    this.tourTimer = setTimeout(() => this.zone.run(() => {
      if (this.destroyed || this.tourState() !== 'playing') return;
      this.clearTourTimer();
      this.tourProgress.set(1);
      this.tourSecondsRemaining.set(0);
      const card = this.carousel();
      if (card && card.index < card.count - 1 && this.setPage(card.index + 1)) {
        this.scheduleTourAdvance();
        return;
      }
      const next = this.activeIndex() + 1;
      if (next >= this.zones.length) {
        this.tourState.set('completed');
        return;
      }
      this.resetTourProgress();
      this.goToZone(next, true);
    }), this.tourRemainingMs);
  }

  private clearTourTimer(): void {
    if (this.tourTimer !== null) clearTimeout(this.tourTimer);
    if (this.tourProgressTimer !== null) clearInterval(this.tourProgressTimer);
    this.tourTimer = null;
    this.tourProgressTimer = null;
  }

  private updateTourProgress(): void {
    const elapsed = Math.max(0, Date.now() - this.tourDwellStartedAt);
    this.tourRemainingMs = Math.max(0, this.tourDwellDuration - elapsed);
    this.tourProgress.set(Math.max(0, Math.min(1, 1 - this.tourRemainingMs / TOUR_DWELL_MS)));
    this.tourSecondsRemaining.set(Math.ceil(this.tourRemainingMs / 1000));
  }

  private resetTourProgress(): void {
    this.tourRemainingMs = TOUR_DWELL_MS;
    this.tourDwellDuration = TOUR_DWELL_MS;
    this.tourProgress.set(0);
    this.tourSecondsRemaining.set(Math.ceil(TOUR_DWELL_MS / 1000));
  }

  /** Email + clickable links rendered inside the Contact card. */
  contactLinks(): { email: string; links: { label: string; url: string }[] } | null {
    const z = this.zones.find((zz) => zz.id === 'contact');
    if (!z || z.id !== 'contact') return null;
    return { email: z.payload.email, links: z.payload.links };
  }

  // ---------------- contact form ----------------

  toggleForm(): void {
    if (this.tourState() === 'playing') this.pauseTour();
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
