import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StationCardComponent } from './station-card.component';
import { ACTIVE_ZONES } from '../../../core/content/zones';
import type { Zone } from '../../../core/content/zone.model';

const zoneById = (id: Zone['id']) => ACTIVE_ZONES.find((z) => z.id === id)!;

describe('StationCardComponent', () => {
  let fixture: ComponentFixture<StationCardComponent>;
  let el: HTMLElement;

  const render = (id: Zone['id'], extra: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(StationCardComponent);
    const zone = zoneById(id);
    const items = 'items' in zone.payload && id !== 'education' ? zone.payload.items.length : 1;
    fixture.componentRef.setInput('zone', zone);
    fixture.componentRef.setInput('index', ACTIVE_ZONES.indexOf(zone));
    fixture.componentRef.setInput('count', ACTIVE_ZONES.length);
    fixture.componentRef.setInput('pageCount', items);
    for (const [key, value] of Object.entries(extra)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    el = fixture.nativeElement;
    return fixture;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StationCardComponent] }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  it('renders the stop as a labelled region with its content', () => {
    render('about');
    const region = el.querySelector('[role="region"]')!;
    expect(region.getAttribute('aria-labelledby')).toBe('card-title');
    expect(region.getAttribute('tabindex')).toBe('-1');
    expect(el.querySelector('#card-title')!.textContent).toContain('About');
    expect(el.querySelector('.eyebrow')!.textContent).toContain('Stop 01 / 07');
    const about = zoneById('about');
    if (about.id !== 'about') throw new Error('unexpected zone');
    expect(el.textContent).toContain(about.payload.name);
    expect(el.querySelector('.card-pagination')).toBeNull();
    expect(el.querySelector('.card-continue')!.textContent).toContain('Continue the trail');
  });

  it('pages through multi-item stops and disables previous on the first page', () => {
    render('experience');
    const changes: number[] = [];
    fixture.componentInstance.pageChange.subscribe((d) => changes.push(d));
    const prev = el.querySelector<HTMLButtonElement>('.card-prev')!;
    const next = el.querySelector<HTMLButtonElement>('.card-next')!;
    expect(prev.disabled).toBe(true);
    expect(el.querySelector('.counter')!.textContent).toContain('1');
    next.click();
    prev.click();
    expect(changes).toEqual([1]);

    const exp = zoneById('experience');
    if (exp.id !== 'experience') throw new Error('unexpected zone');
    const last = exp.payload.items.length - 1;
    fixture.componentRef.setInput('page', last);
    fixture.detectChanges();
    expect(next.disabled).toBe(true);
    expect(el.querySelector('.counter')!.textContent).toContain(`${last + 1}`);
    expect(el.textContent).toContain(exp.payload.items[last].company);
  });

  it('emits a page change on a horizontal touch swipe', () => {
    render('projects');
    const changes: number[] = [];
    fixture.componentInstance.pageChange.subscribe((d) => changes.push(d));
    const body = el.querySelector('.card-body')!;
    body.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, clientY: 200, pointerType: 'touch', bubbles: true }));
    body.dispatchEvent(new PointerEvent('pointerup', { clientX: 180, clientY: 210, pointerType: 'touch', bubbles: true }));
    expect(changes).toEqual([1]);

    // A mostly vertical gesture is a scroll, not a swipe.
    body.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, clientY: 400, pointerType: 'touch', bubbles: true }));
    body.dispatchEvent(new PointerEvent('pointerup', { clientX: 240, clientY: 250, pointerType: 'touch', bubbles: true }));
    expect(changes).toEqual([1]);
  });

  it('hands wheel input back to the trail only when the body cannot scroll further', () => {
    render('about');
    const spilled: number[] = [];
    fixture.componentInstance.overscroll.subscribe((px) => spilled.push(px));
    const body = el.querySelector<HTMLElement>('.card-body')!;
    const wheel = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    body.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(spilled).toEqual([120]);

    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 900 });
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: 300 });
    const scrollable = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    body.dispatchEvent(scrollable);
    expect(scrollable.defaultPrevented).toBe(false);
    expect(spilled).toEqual([120]);
  });

  it('expands and collapses the mobile sheet from the handle', () => {
    render('skills', { mobile: true });
    const states: boolean[] = [];
    fixture.componentInstance.expandedChange.subscribe((v) => states.push(v));
    expect(el.classList.contains('sheet')).toBe(true);
    const handle = el.querySelector('.sheet-handle')!;
    handle.dispatchEvent(new PointerEvent('pointerdown', { clientY: 600, bubbles: true }));
    handle.dispatchEvent(new PointerEvent('pointermove', { clientY: 520, bubbles: true }));
    handle.dispatchEvent(new PointerEvent('pointerup', { clientY: 520, bubbles: true }));
    expect(states).toEqual([true]);

    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
    expect(el.classList.contains('expanded')).toBe(true);
    el.querySelector<HTMLButtonElement>('.sheet-expand')!.click();
    expect(states).toEqual([true, false]);
  });

  it('offers a walk back to the start on the final stop', () => {
    render('contact');
    const spy = vi.fn();
    fixture.componentInstance.continueTrail.subscribe(spy);
    const button = el.querySelector<HTMLButtonElement>('.card-continue')!;
    expect(button.textContent).toContain('Walk back to the start');
    button.click();
    expect(spy).toHaveBeenCalledOnce();
  });
});
