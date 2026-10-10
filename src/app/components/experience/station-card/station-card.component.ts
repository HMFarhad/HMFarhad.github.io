import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy,
  afterRenderEffect, computed, input, output, signal, viewChild,
} from '@angular/core';
import type { Zone } from '../../../core/content/zone.model';

/** Quiet period after native scrolling before the edge may spill. */
const OVERSCROLL_HOLD_MS = 250;
/** Sheet handle drag distance that toggles the expanded state. */
const SHEET_DRAG_PX = 60;
const SWIPE_MIN_PX = 48;

/**
 * Field-journal card for the active trail stop. Renders the zone content,
 * in-card pagination for multi-item zones and the "continue" action. On
 * phones it becomes a bottom sheet with a draggable handle.
 */
@Component({
  selector: 'app-station-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './station-card.component.html',
  styleUrl: './station-card.component.scss',
  host: {
    '[class.sheet]': 'mobile()',
    '[class.expanded]': 'mobile() && expanded()',
    '[class.dragging]': 'dragOffset() !== null',
  },
})
export class StationCardComponent implements AfterViewInit, OnDestroy {
  zone = input.required<Zone>();
  index = input.required<number>();
  count = input.required<number>();
  page = input(0);
  pageCount = input(1);
  mobile = input(false);
  expanded = input(false);

  /** Relative page step: -1 or +1. */
  pageChange = output<number>();
  /** Public name `continue`: move on to the next stop (wraps at the end). */
  continueTrail = output<void>({ alias: 'continue' });
  /** Wheel distance (px) that the card body could not absorb. */
  overscroll = output<number>();
  expandedChange = output<boolean>();

  private body = viewChild.required<ElementRef<HTMLElement>>('body');
  private title = viewChild.required<ElementRef<HTMLElement>>('title');
  readonly host: ElementRef<HTMLElement>;

  isLast = computed(() => this.index() === this.count() - 1);
  stopLabel = computed(() =>
    `Stop ${pad(this.index() + 1)} / ${pad(this.count())}`);
  dragOffset = signal<number | null>(null);
  sheetTransform = computed(() => {
    const offset = this.dragOffset();
    return offset === null ? null : `translateY(${offset}px)`;
  });

  private holdUntil = 0;
  private swipe: { id: number; x: number; y: number } | null = null;
  private drag: { id: number; y: number } | null = null;

  constructor(host: ElementRef<HTMLElement>) {
    this.host = host;
    let first = true;
    // New page or stop: start reading from the top and replay the page-in.
    afterRenderEffect({
      write: () => {
        this.zone();
        this.page();
        const el = this.body().nativeElement;
        el.scrollTop = 0;
        if (first) { first = false; return; }
        if (host.nativeElement.closest('.still')) return;
        el.querySelector<HTMLElement>('.turn')?.animate?.(
          [{ opacity: 0, transform: 'translateX(10px)' }, { opacity: 1, transform: 'none' }],
          { duration: 350, easing: 'ease' });
      },
    });
  }

  ngAfterViewInit(): void {
    // Registered imperatively so it can be non-passive: the card decides
    // per event whether the browser scrolls the body or the trail moves.
    this.body().nativeElement.addEventListener('wheel', this.onWheel, { passive: false });
  }

  ngOnDestroy(): void {
    this.body().nativeElement.removeEventListener('wheel', this.onWheel);
  }

  focusTitle(): void {
    this.title().nativeElement.focus({ preventScroll: true });
  }

  step(direction: number): void {
    const next = this.page() + direction;
    if (next < 0 || next >= this.pageCount()) return;
    this.pageChange.emit(direction);
  }

  toggleSheet(): void {
    this.expandedChange.emit(!this.expanded());
  }

  // ---------------- wheel ----------------

  private onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey || e.metaKey || e.deltaY === 0) return;
    const el = this.body().nativeElement;
    const now = Date.now();
    const canScroll = e.deltaY > 0
      ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
      : el.scrollTop > 0;
    if (canScroll) {
      this.holdUntil = now + OVERSCROLL_HOLD_MS;
      return;
    }
    e.preventDefault();
    if (now < this.holdUntil) {
      // Momentum from reading the body: swallow it until the wheel rests.
      this.holdUntil = now + OVERSCROLL_HOLD_MS;
      return;
    }
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight || 800 : 1;
    this.overscroll.emit(e.deltaY * unit);
  };

  // ---------------- touch swipe between pages ----------------

  onBodyDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' || this.pageCount() < 2) return;
    this.swipe = { id: e.pointerId ?? 0, x: e.clientX, y: e.clientY };
  }

  onBodyUp(e: PointerEvent): void {
    const start = this.swipe;
    this.swipe = null;
    if (!start || (e.pointerId ?? 0) !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      this.step(dx < 0 ? 1 : -1);
    }
  }

  onBodyCancel(): void {
    this.swipe = null;
  }

  // ---------------- sheet handle ----------------

  onHandleDown(e: PointerEvent): void {
    if (!this.mobile() || (e.button ?? 0) !== 0) return;
    const id = e.pointerId ?? 0;
    this.drag = { id, y: e.clientY };
    (e.currentTarget as Element | null)?.setPointerCapture?.(id);
    this.dragOffset.set(0);
  }

  onHandleMove(e: PointerEvent): void {
    if (!this.drag || (e.pointerId ?? 0) !== this.drag.id) return;
    const dy = e.clientY - this.drag.y;
    // Rubber-band toward the state the sheet is already in.
    const resisted = this.expanded() ? (dy < 0 ? dy * 0.25 : dy) : (dy > 0 ? dy : dy * 0.35);
    this.dragOffset.set(Math.round(resisted));
  }

  onHandleUp(e: PointerEvent): void {
    if (!this.drag || (e.pointerId ?? 0) !== this.drag.id) return;
    const dy = e.clientY - this.drag.y;
    this.drag = null;
    this.dragOffset.set(null);
    if (dy <= -SHEET_DRAG_PX && !this.expanded()) this.expandedChange.emit(true);
    else if (dy >= SHEET_DRAG_PX && this.expanded()) this.expandedChange.emit(false);
    else if (Math.abs(dy) < 6) this.toggleSheet();
  }

  onHandleCancel(): void {
    this.drag = null;
    this.dragOffset.set(null);
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
