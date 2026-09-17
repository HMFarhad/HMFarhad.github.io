import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ExperienceComponent, FOREST_LOADER } from './experience.component';
import { EmailService } from '../../core/email.service';
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
  pickLink = vi.fn();
  pickStation = vi.fn();
  stepCarousel = vi.fn(() => true);
  dispose = vi.fn();
  onActiveZoneChange: ((index: number) => void) | null = null;
  onStationSettled: ((settled: boolean) => void) | null = null;
  onLandmarkHover: ((index: number | null) => void) | null = null;
  onCarouselChange: ((state: { index: number; count: number } | null) => void) | null = null;
}

describe('Original forest visitor journeys', () => {
  let fixture: ComponentFixture<ExperienceComponent> | undefined;
  let send: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;
  let reducedMotion: boolean;
  const scene = () => FakeForest.instances.at(-1)!;
  const mount = async () => {
    fixture = TestBed.createComponent(ExperienceComponent);
    fixture.detectChanges();
    await fixture.componentInstance.sceneInitialization;
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    reducedMotion = false;
    FakeForest.instances = [];
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query.includes('reduced-motion') && reducedMotion,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    send = vi.fn();
    load = vi.fn(async () => ({ ForestScene: FakeForest }));
    await TestBed.configureTestingModule({
      imports: [ExperienceComponent],
      providers: [
        { provide: EmailService, useValue: { isConfigured: true, send } },
        { provide: FOREST_LOADER, useValue: load },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps all seven original stops and the profile data intact', async () => {
    const f = await mount();
    expect(f.componentInstance.zones).toBe(ACTIVE_ZONES);
    expect(f.nativeElement.querySelectorAll('.mini-map button').length).toBe(7);
    expect(f.nativeElement.querySelector('.escape').getAttribute('href')).toBe('page');
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

  it('shows every carousel page before the guided journey leaves the section', async () => {
    const f = await mount();
    vi.useFakeTimers();
    f.nativeElement.querySelector('.tour-launch button').click();
    scene().onActiveZoneChange?.(2);
    scene().onCarouselChange?.({ index: 0, count: 4 });
    scene().onStationSettled?.(true);

    vi.advanceTimersByTime(6500);
    expect(scene().stepCarousel).toHaveBeenLastCalledWith(1);
    expect(scene().jumpToStation).not.toHaveBeenCalledWith(3);

    scene().onCarouselChange?.({ index: 1, count: 4 });
    vi.advanceTimersByTime(6500);
    expect(scene().stepCarousel).toHaveBeenCalledTimes(2);

    scene().onCarouselChange?.({ index: 3, count: 4 });
    vi.advanceTimersByTime(6500);
    expect(scene().jumpToStation).toHaveBeenLastCalledWith(3);
    vi.useRealTimers();
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

  it('provides direct buttons for the in-world carousel', async () => {
    const f = await mount();
    scene().onCarouselChange?.({ index: 0, count: 16 });
    scene().onStationSettled?.(true);
    f.detectChanges();
    const controls = f.nativeElement.querySelectorAll('.carousel-controls button');
    expect(controls[0].disabled).toBe(true);
    controls[1].click();
    expect(scene().stepCarousel).toHaveBeenCalledWith(1);

    scene().stepCarousel.mockClear();
    const canvas = f.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(scene().stepCarousel).toHaveBeenCalledWith(1);
    expect(scene().jumpToStation).not.toHaveBeenCalled();
  });

  it('paginates carousel content inside the paused reader', async () => {
    const f = await mount();
    scene().onActiveZoneChange?.(3);
    scene().onCarouselChange?.({ index: 0, count: 16 });
    scene().onStationSettled?.(true);
    f.detectChanges();
    const dialog = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    f.nativeElement.querySelector('.read-panel').click();
    f.detectChanges();

    const pages = f.nativeElement.querySelectorAll('.reader-pagination button');
    expect(pages[0].disabled).toBe(true);
    pages[1].click();
    f.detectChanges();
    expect(scene().stepCarousel).toHaveBeenCalledWith(1);
    expect(f.nativeElement.querySelector('.reader-pagination span').textContent).toContain('2 / 16');
    expect(scene().setPaused).toHaveBeenLastCalledWith(true);
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

  it('opens the same written content in a reader and pauses the forest', async () => {
    const f = await mount();
    scene().onStationSettled?.(true);
    f.detectChanges();
    const dialog = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    f.nativeElement.querySelector('.read-panel').click();
    expect(dialog.open).toBe(true);
    expect(scene().setPaused).toHaveBeenCalledWith(true);
    const about = ACTIVE_ZONES.find((zone) => zone.id === 'about')!;
    expect(dialog.textContent).toContain(about.payload.name);
    expect(dialog.textContent).toContain(about.payload.bio.split('\n\n')[0]);
    dialog.dispatchEvent(new Event('close'));
    expect(scene().setPaused).toHaveBeenLastCalledWith(false);
  });

  it('offers the text route when the 3D engine cannot initialize', async () => {
    load.mockRejectedValue(new Error('WebGL unavailable'));
    const f = await mount();
    expect(f.componentInstance.sceneFailed()).toBe(true);
    expect(f.nativeElement.querySelector('.scene-status a').getAttribute('href')).toBe('page');
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

  it('releases the renderer and input handlers on navigation away', async () => {
    const f = await mount();
    const forest = scene();
    f.destroy();
    fixture = undefined;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(forest.dispose).toHaveBeenCalledOnce();
    expect(forest.jumpToStation).not.toHaveBeenCalled();
  });
});
