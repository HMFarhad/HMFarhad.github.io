import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ExperienceComponent, FOREST_LOADER } from './experience.component';
import { EmailService } from '../../core/email.service';
import { AMBIENCE } from '../../core/audio/ambience';
import { ACTIVE_ZONES } from '../../core/content/zones';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

class FakeForest {
  static instances: FakeForest[] = [];
  constructor() { FakeForest.instances.push(this); }
  jumpToStation = vi.fn();
  addScrollDelta = vi.fn();
  setMotion = vi.fn();
  setPaused = vi.fn();
  setPointer = vi.fn();
  pickStation = vi.fn();
  dispose = vi.fn();
  onActiveZoneChange: ((index: number) => void) | null = null;
  onStationSettled: ((settled: boolean) => void) | null = null;
  onLandmarkHover: ((index: number | null) => void) | null = null;
}

const indexOf = (id: string) => ACTIVE_ZONES.findIndex((z) => z.id === id);
const itemCount = (id: string) => {
  const zone = ACTIVE_ZONES.find((z) => z.id === id)!;
  return 'items' in zone.payload ? zone.payload.items.length : 1;
};

describe('Original forest visitor journeys', () => {
  let fixture: ComponentFixture<ExperienceComponent> | undefined;
  let send: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;
  let reducedMotion: boolean;
  let mobileLayout: boolean;
  let ambience: {
    running: boolean;
    start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>;
    suspend: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>;
  };
  const scene = () => FakeForest.instances.at(-1)!;
  const el = () => fixture!.nativeElement as HTMLElement;
  const mount = async () => {
    fixture = TestBed.createComponent(ExperienceComponent);
    fixture.detectChanges();
    await fixture.componentInstance.sceneInitialization;
    fixture.detectChanges();
    return fixture;
  };
  /** Walk to a stop and arrive there. */
  const arrive = (f: ComponentFixture<ExperienceComponent>, index: number) => {
    scene().onActiveZoneChange?.(index);
    scene().onStationSettled?.(true);
    f.detectChanges();
  };
  const wheel = (deltaY: number) => el().querySelector('canvas')!.dispatchEvent(
    new WheelEvent('wheel', { deltaY, cancelable: true }));
  const key = (k: string, target: EventTarget = el().querySelector('canvas')!) => {
    const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  beforeEach(async () => {
    reducedMotion = false;
    mobileLayout = false;
    FakeForest.instances = [];
    localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: (query.includes('reduced-motion') && reducedMotion)
        || (query.includes('max-width: 768px') && mobileLayout),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    send = vi.fn();
    load = vi.fn(async () => ({ ForestScene: FakeForest }));
    ambience = {
      running: false,
      start: vi.fn(async () => undefined), stop: vi.fn(),
      suspend: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [ExperienceComponent],
      providers: [
        { provide: EmailService, useValue: { isConfigured: true, send } },
        { provide: FOREST_LOADER, useValue: load },
        { provide: AMBIENCE, useValue: ambience },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('keeps all seven original stops and the profile data intact', async () => {
    const f = await mount();
    expect(f.componentInstance.zones).toBe(ACTIVE_ZONES);
    expect(f.nativeElement.querySelectorAll('.mini-map button').length).toBe(7);
    expect(f.nativeElement.querySelector('.escape').getAttribute('href')).toBe('/');
    const role = ACTIVE_ZONES.find((z) => z.id === 'experience');
    expect(role?.payload.items[0].role).toBe('Software Engineer');
    expect(role?.payload.items[0].period).toBe('September 2026 – Present');
    const contact = ACTIVE_ZONES.find((z) => z.id === 'contact');
    expect(contact?.payload.links.some((link) => link.url.startsWith('tel:'))).toBe(false);
    expect(JSON.stringify(ACTIVE_ZONES)).not.toContain('+358');
  });

  it('navigates with the existing zone map and announces the active stop', async () => {
    const f = await mount();
    const buttons = f.nativeElement.querySelectorAll('.mini-map button');
    buttons[3].click();
    expect(scene().jumpToStation).toHaveBeenCalledWith(3);
    scene().onActiveZoneChange?.(3);
    f.detectChanges();
    expect(buttons[3].getAttribute('aria-current')).toBe('step');
    expect(buttons[3].closest('li').classList.contains('visited')).toBe(true);
    expect(f.nativeElement.querySelector('.active-zone').textContent).toContain('Projects');
  });

  it('honors reduced motion and supports changing it while exploring', async () => {
    reducedMotion = true;
    const f = await mount();
    expect(scene().setMotion).toHaveBeenCalledWith(false);
    const toggle = f.nativeElement.querySelector('.motion-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Enable animation');
    toggle.click();
    f.detectChanges();
    expect(scene().setMotion).toHaveBeenLastCalledWith(true);
    expect(toggle.getAttribute('aria-label')).toBe('Reduce animation');
  });

  it('plays the guided journey through each settled stop', async () => {
    const f = await mount();
    vi.useFakeTimers();
    f.nativeElement.querySelector('.tour-launch button').click();
    expect(f.componentInstance.tourState()).toBe('playing');
    expect(scene().jumpToStation).toHaveBeenLastCalledWith(0);

    scene().onStationSettled?.(true);
    vi.advanceTimersByTime(3200);
    expect(f.componentInstance.tourProgress()).toBeGreaterThan(0.45);
    expect(f.componentInstance.tourProgress()).toBeLessThan(0.55);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.tour-wait-track').getAttribute('aria-valuenow')).toBe('49');
    vi.advanceTimersByTime(3300);
    expect(scene().jumpToStation).toHaveBeenLastCalledWith(1);

    scene().onActiveZoneChange?.(6);
    scene().onStationSettled?.(true);
    vi.advanceTimersByTime(6500);
    expect(f.componentInstance.tourState()).toBe('completed');
    vi.useRealTimers();
  });

  it('shows every card page before the guided journey leaves the stop', async () => {
    const f = await mount();
    const stop = indexOf('experience');
    const count = itemCount('experience');
    vi.useFakeTimers();
    f.nativeElement.querySelector('.tour-launch button').click();
    arrive(f, stop);
    expect(f.componentInstance.pageIndex()).toBe(0);
    expect(f.nativeElement.querySelector('.tour-card-count').textContent).toContain(`1 / ${count}`);

    for (let page = 1; page < count; page++) {
      vi.advanceTimersByTime(6500);
      expect(f.componentInstance.pageIndex()).toBe(page);
      expect(scene().jumpToStation).not.toHaveBeenCalledWith(stop + 1);
    }
    f.detectChanges();
    expect(f.nativeElement.querySelector('.tour-card-count').textContent).toContain(`${count} / ${count}`);
    expect(document.activeElement?.id).not.toBe('card-title');

    vi.advanceTimersByTime(6500);
    expect(scene().jumpToStation).toHaveBeenLastCalledWith(stop + 1);
  });

  it('pauses and exits the guided journey when the visitor takes control', async () => {
    const f = await mount();
    f.nativeElement.querySelector('.tour-launch button').click();
    f.detectChanges();
    f.nativeElement.querySelector('.tour-primary').click();
    expect(f.componentInstance.tourState()).toBe('paused');
    expect(scene().setPaused).toHaveBeenLastCalledWith(true);

    f.detectChanges();
    f.nativeElement.querySelector('.tour-primary').click();
    expect(f.componentInstance.tourState()).toBe('playing');
    expect(scene().setPaused).toHaveBeenLastCalledWith(false);

    f.nativeElement.querySelector('canvas').dispatchEvent(
      new WheelEvent('wheel', { deltaY: 20, cancelable: true }));
    expect(f.componentInstance.tourState()).toBe('idle');
    expect(scene().addScrollDelta).toHaveBeenCalled();
  });

  it('keeps contact controls hidden during travel and lets arrow keys edit the message', async () => {
    const f = await mount();
    scene().onActiveZoneChange?.(6);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.contact-overlay')).toBeNull();
    scene().onStationSettled?.(true);
    f.detectChanges();
    f.nativeElement.querySelector('.form-toggle').click();
    f.detectChanges();
    const field = f.nativeElement.querySelector('textarea');
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    field.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(scene().jumpToStation).not.toHaveBeenCalled();
    f.nativeElement.querySelector('canvas').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(scene().jumpToStation).toHaveBeenCalledWith(0);
  });

  it('opens the station card only once the walker has arrived', async () => {
    const f = await mount();
    expect(el().querySelector('app-station-card')).toBeNull();
    scene().onStationSettled?.(true);
    f.detectChanges();
    expect(el().querySelector('app-station-card [role="region"]')).not.toBeNull();
    scene().onStationSettled?.(false);
    f.detectChanges();
    expect(el().querySelector('app-station-card')).toBeNull();
  });

  it('shows the active stop content in the card without pausing the forest', async () => {
    const f = await mount();
    arrive(f, 0);
    const card = el().querySelector('app-station-card')!;
    const about = ACTIVE_ZONES.find((zone) => zone.id === 'about')!;
    if (about.id !== 'about') throw new Error('unexpected zone');
    expect(card.querySelector('#card-title')!.textContent).toContain('About');
    expect(card.textContent).toContain(about.payload.name);
    expect(card.textContent).toContain(about.payload.bio.split('\n\n')[0]);
    expect(el().querySelector('dialog')).toBeNull();
    expect(scene().setPaused).not.toHaveBeenCalledWith(true);
  });

  it('pages multi-item stops from the card and the arrow keys', async () => {
    const f = await mount();
    arrive(f, indexOf('projects'));
    const prev = el().querySelector<HTMLButtonElement>('.card-prev')!;
    expect(prev.disabled).toBe(true);
    el().querySelector<HTMLButtonElement>('.card-next')!.click();
    f.detectChanges();
    expect(f.componentInstance.pageIndex()).toBe(1);
    expect(el().querySelector('.card-pagination .counter')!.textContent).toContain(`2 / ${itemCount('projects')}`);

    key('ArrowRight');
    expect(f.componentInstance.pageIndex()).toBe(2);
    key('ArrowLeft');
    expect(f.componentInstance.pageIndex()).toBe(1);
    expect(scene().jumpToStation).not.toHaveBeenCalled();
  });

  it('turns card pages with the wheel before walking on, in both directions', async () => {
    const f = await mount();
    const count = itemCount('experience');
    vi.useFakeTimers();
    arrive(f, indexOf('experience'));
    const notch = 180; // 0.02 trail progress, just over one page

    wheel(notch);
    expect(f.componentInstance.pageIndex()).toBe(1);
    wheel(notch); // inside the post-flip lock: ignored
    expect(f.componentInstance.pageIndex()).toBe(1);
    for (let page = 2; page < count; page++) {
      vi.advanceTimersByTime(400);
      wheel(notch);
      expect(f.componentInstance.pageIndex()).toBe(page);
    }
    expect(scene().addScrollDelta).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    wheel(notch);
    expect(scene().addScrollDelta).toHaveBeenCalledTimes(1);
    expect(scene().addScrollDelta.mock.calls[0][0]).toBeCloseTo(notch / 9000, 6);

    for (let page = count - 2; page >= 0; page--) {
      vi.advanceTimersByTime(400);
      wheel(-notch);
      expect(f.componentInstance.pageIndex()).toBe(page);
    }
    vi.advanceTimersByTime(400);
    wheel(-notch);
    expect(scene().addScrollDelta).toHaveBeenCalledTimes(2);
    expect(scene().addScrollDelta.mock.calls[1][0]).toBeCloseTo(-notch / 9000, 6);
  });

  it('continues to the next stop and wraps back to the start at the end', async () => {
    const f = await mount();
    arrive(f, 0);
    el().querySelector<HTMLButtonElement>('.card-continue')!.click();
    expect(scene().jumpToStation).toHaveBeenLastCalledWith(1);
    f.detectChanges();
    expect(el().querySelector('app-station-card')).toBeNull();

    arrive(f, 6);
    const button = el().querySelector<HTMLButtonElement>('.card-continue')!;
    expect(button.textContent).toContain('Walk back to the start');
    button.click();
    expect(scene().jumpToStation).toHaveBeenLastCalledWith(0);
  });

  it('moves focus to the card title only after explicit navigation', async () => {
    const f = await mount();
    el().querySelectorAll<HTMLButtonElement>('.mini-map button')[2].click();
    arrive(f, 2);
    await f.whenStable();
    expect(document.activeElement?.id).toBe('card-title');

    // Leaving the stop while the card holds focus hands it back to the canvas.
    scene().onStationSettled?.(false);
    f.detectChanges();
    expect(document.activeElement).toBe(el().querySelector('canvas'));
  });

  it('starts forest sound only from the sound toggle and remembers the choice', async () => {
    const f = await mount();
    window.dispatchEvent(new PointerEvent('pointerdown'));
    expect(ambience.start).not.toHaveBeenCalled();

    const toggle = el().querySelector<HTMLButtonElement>('.sound-toggle')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    f.detectChanges();
    expect(ambience.start).toHaveBeenCalledOnce();
    expect(localStorage.getItem('forest:sound')).toBe('on');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    toggle.click();
    expect(ambience.stop).toHaveBeenCalledOnce();
    expect(localStorage.getItem('forest:sound')).toBe('off');
  });

  it('waits for a gesture before resuming a remembered sound preference', async () => {
    localStorage.setItem('forest:sound', 'on');
    const f = await mount();
    expect(f.componentInstance.soundOn()).toBe(true);
    expect(ambience.start).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(ambience.start).toHaveBeenCalledOnce();
    window.dispatchEvent(new PointerEvent('pointerdown'));
    expect(ambience.start).toHaveBeenCalledOnce();
  });

  it('opens the settings menu and closes it with Escape or an outside press', async () => {
    const f = await mount();
    const toggle = el().querySelector<HTMLButtonElement>('.menu-toggle')!;
    expect(toggle.getAttribute('aria-haspopup')).toBe('true');
    toggle.click();
    f.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    key('Escape', window);
    f.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    el().querySelector('canvas')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    f.detectChanges();
    expect(f.componentInstance.menuOpen()).toBe(false);
  });

  it('shows the card as a bottom sheet on phones that expands and collapses', async () => {
    mobileLayout = true;
    const f = await mount();
    arrive(f, 1);
    const card = el().querySelector('app-station-card')!;
    expect(card.classList.contains('sheet')).toBe(true);
    el().querySelector<HTMLButtonElement>('.sheet-expand')!.click();
    f.detectChanges();
    expect(f.componentInstance.sheetExpanded()).toBe(true);
    expect(card.classList.contains('expanded')).toBe(true);

    key('Escape', window);
    f.detectChanges();
    expect(f.componentInstance.sheetExpanded()).toBe(false);
    expect(card.classList.contains('expanded')).toBe(false);

    const handle = el().querySelector('.sheet-handle')!;
    handle.dispatchEvent(new PointerEvent('pointerdown', { clientY: 600, bubbles: true }));
    handle.dispatchEvent(new PointerEvent('pointerup', { clientY: 500, bubbles: true }));
    expect(f.componentInstance.sheetExpanded()).toBe(true);
    scene().onActiveZoneChange?.(2);
    expect(f.componentInstance.sheetExpanded()).toBe(false);
  });

  it('normalizes wheel units while allowing browser zoom', async () => {
    const f = await mount();
    const canvas = f.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, cancelable: true }));
    expect(scene().addScrollDelta).toHaveBeenCalledWith(48 / 9000);
    const zoom = new WheelEvent('wheel', { deltaY: 20, ctrlKey: true, cancelable: true });
    canvas.dispatchEvent(zoom);
    expect(zoom.defaultPrevented).toBe(false);
    expect(scene().addScrollDelta).toHaveBeenCalledTimes(1);
  });

  it('offers the text route when the 3D engine cannot initialize', async () => {
    load.mockRejectedValue(new Error('WebGL unavailable'));
    const f = await mount();
    expect(f.componentInstance.sceneFailed()).toBe(true);
    expect(f.nativeElement.querySelector('.scene-status a').getAttribute('href')).toBe('/');
  });

  it('does not create a scene after navigating away during loading', async () => {
    let resolve!: (value: unknown) => void;
    load.mockReturnValue(new Promise((done) => { resolve = done; }));
    fixture = TestBed.createComponent(ExperienceComponent);
    fixture.detectChanges();
    const pending = fixture.componentInstance.sceneInitialization;
    fixture.destroy();
    fixture = undefined;
    resolve({ ForestScene: FakeForest });
    await pending;
    expect(FakeForest.instances).toHaveLength(0);
  });

  it('prevents duplicate submissions and restores the form after delivery failure', async () => {
    const f = await mount();
    const component = f.componentInstance;
    component.form = { name: 'Visitor', email: 'visitor@example.com', subject: 'Hello', message: 'Keep this message' };
    let reject!: (reason: Error) => void;
    send.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    const pending = component.onSubmit();
    await component.onSubmit();
    expect(send).toHaveBeenCalledTimes(1);
    reject(new Error('offline'));
    await pending;
    expect(component.isSubmitting()).toBe(false);
    expect(component.submitOk()).toBe(false);
    expect(component.form.message).toBe('Keep this message');
  });

  it('releases the renderer, sound and input handlers on navigation away', async () => {
    const f = await mount();
    const forest = scene();
    f.destroy();
    fixture = undefined;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(forest.dispose).toHaveBeenCalledOnce();
    expect(forest.jumpToStation).not.toHaveBeenCalled();
    expect(ambience.dispose).toHaveBeenCalledOnce();
  });
});
