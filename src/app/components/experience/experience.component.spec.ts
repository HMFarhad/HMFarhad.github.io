import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ExperienceComponent, SCULPTURE_LOADER } from './experience.component';
import { EmailService } from '../../core/email.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const scene = { setShape: vi.fn(), setMotion: vi.fn(), dispose: vi.fn() };
const loadScene = async () => ({
  SculptureScene: class {
    setShape = scene.setShape;
    setMotion = scene.setMotion;
    dispose = scene.dispose;
  },
});

describe('Portfolio visitor journeys', () => {
  let fixture: ComponentFixture<ExperienceComponent>;
  let send: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    vi.stubGlobal(
      'matchMedia',
      vi
        .fn()
        .mockReturnValue({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
    );
    send = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ExperienceComponent],
      providers: [
        { provide: EmailService, useValue: { isConfigured: true, send } },
        { provide: SCULPTURE_LOADER, useValue: loadScene },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ExperienceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => {
    fixture.destroy();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  const click = (element: HTMLElement) => element.click();

  it('renders meaningful content and the current role before 3D is needed', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toContain('Thoughtful code.');
    const firstRole = root.querySelector('.experience-row');
    expect(firstRole?.textContent).toContain('Nexetic Oy');
    expect(firstRole?.textContent).toContain('Software Engineer');
    expect(firstRole?.textContent).toContain('September 2026 – Present');
    expect(root.textContent).toContain('March 2018 – December 2022');
    expect(root.querySelectorAll('.project-card').length).toBe(3);
  });
  it('supports opening and closing mobile navigation with accessible state', () => {
    const toggle = fixture.nativeElement.querySelector('.menu-toggle') as HTMLElement;
    click(toggle);
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    click(fixture.nativeElement.querySelector('#navigation a'));
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
  it('lets visitors browse all work, filter it, and return to selected projects', () => {
    click(fixture.nativeElement.querySelector('.all-projects'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.project-card').length).toBe(16);
    const filters = [
      ...fixture.nativeElement.querySelectorAll('.project-filters button'),
    ] as HTMLButtonElement[];
    click(filters.find((b) => b.textContent?.trim() === 'Research')!);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.project-card').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.projects-grid').textContent).toContain('Bengali');
    click(fixture.nativeElement.querySelector('.all-projects'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.project-card').length).toBe(3);
  });
  it('honors reduced motion and offers explicit motion and shape controls', () => {
    expect(fixture.componentInstance.motion()).toBe(false);
    fixture.componentInstance.toggleMotion();
    expect(scene.setMotion).toHaveBeenCalledWith(true);
    fixture.componentInstance.selectShape(2);
    expect(scene.setShape).toHaveBeenCalledWith(2);
  });
  it('keeps written content available after a rendering failure', () => {
    fixture.componentInstance.sceneReady.set(false);
    fixture.componentInstance.sceneFailed.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.interaction-hint').textContent).toContain('STILL');
    expect(fixture.nativeElement.querySelectorAll('.project-card').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.resume-link').getAttribute('href')).toContain(
      '.pdf',
    );
  });
  it('prevents invalid and duplicate submissions and reports success', async () => {
    const component = fixture.componentInstance;
    await component.onSubmit();
    expect(send).not.toHaveBeenCalled();
    component.form = {
      name: 'Visitor',
      email: 'visitor@example.com',
      subject: 'Hello',
      message: 'A test message',
    };
    let resolve!: (value: { success: boolean }) => void;
    send.mockReturnValue(new Promise((r) => (resolve = r)));
    const pending = component.onSubmit();
    await component.onSubmit();
    expect(send).toHaveBeenCalledTimes(1);
    expect(component.submitting()).toBe(true);
    resolve({ success: true });
    await pending;
    expect(component.submitting()).toBe(false);
    expect(component.submitMessage()).toContain('has been sent');
    expect(component.form.message).toBe('');
  });
  it('preserves the visitor message and allows retry after a delivery error', async () => {
    const component = fixture.componentInstance;
    component.form = {
      name: 'Visitor',
      email: 'visitor@example.com',
      subject: 'Hello',
      message: 'Keep this message',
    };
    send.mockRejectedValue(new Error('offline'));
    await component.onSubmit();
    expect(component.submitError()).toBe(true);
    expect(component.submitting()).toBe(false);
    expect(component.form.message).toBe('Keep this message');
  });
});
