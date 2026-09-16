import {
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
  NgZone,
  InjectionToken,
  inject,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ZONES } from '../../core/content/zones';
import { EmailService, ContactFormData } from '../../core/email.service';
import type { SculptureScene } from '../../three/sculpture-scene';

export const SCULPTURE_LOADER = new InjectionToken<
  () => Promise<typeof import('../../three/sculpture-scene')>
>('SCULPTURE_LOADER', {
  providedIn: 'root',
  factory: () => () => import('../../three/sculpture-scene'),
});

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './experience.component.html',
  styleUrl: './experience.component.scss',
})
export class ExperienceComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);
  private loadScene = inject(SCULPTURE_LOADER);
  private email = inject(EmailService);
  private scene: SculptureScene | null = null;
  private destroyed = false;
  private motionQuery?: MediaQueryList;
  private readonly onMotionChange = () => {
    this.motion.set(!this.motionQuery?.matches);
    this.scene?.setMotion(this.motion());
  };

  menuOpen = signal(false);
  motion = signal(true);
  sceneReady = signal(false);
  sceneFailed = signal(false);
  formOpen = signal(false);
  shape = signal(0);
  shapes = ['Flow', 'Orbit', 'Structure'];
  showAll = signal(false);
  category = signal('All');
  readonly projects = ZONES.find((z) => z.id === 'projects')!.payload.items;
  readonly experience = ZONES.find((z) => z.id === 'experience')!.payload.items;
  readonly education = ZONES.find((z) => z.id === 'education')!.payload.items;
  readonly skills = ZONES.find((z) => z.id === 'skills')!.payload.groups;
  readonly blogs = ZONES.find((z) => z.id === 'blogs')!.payload.items;
  readonly about = ZONES.find((z) => z.id === 'about')!.payload;
  readonly categories = ['All', ...new Set(this.projects.map((p) => p.category!))];
  readonly visibleProjects = computed(() => {
    if (!this.showAll()) return this.projects.slice(0, 3);
    return this.category() === 'All'
      ? this.projects
      : this.projects.filter((p) => p.category === this.category());
  });
  readonly currentYear = new Date().getFullYear();
  readonly emailConfigured = this.email.isConfigured;
  form: ContactFormData = { name: '', email: '', subject: '', message: '' };
  submitting = signal(false);
  submitMessage = signal('');
  submitError = signal(false);

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.onMotionChange();
    this.motionQuery.addEventListener('change', this.onMotionChange);
    try {
      const { SculptureScene } = await this.loadScene();
      if (this.destroyed) return;
      this.zone.runOutsideAngular(() => {
        this.scene = new SculptureScene(this.canvasRef.nativeElement, this.motion(), () => {
          this.zone.run(() => {
            this.sceneReady.set(false);
            this.sceneFailed.set(true);
          });
        });
      });
      this.sceneReady.set(true);
    } catch {
      this.sceneFailed.set(true);
    }
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    this.scene?.dispose();
  }
  selectShape(index: number): void {
    this.shape.set(index);
    this.scene?.setShape(index);
  }
  toggleMotion(): void {
    this.motion.update((v) => !v);
    this.scene?.setMotion(this.motion());
  }
  closeMenu(): void {
    this.menuOpen.set(false);
  }
  projectTitle(name: string): string {
    return name.split(' — ')[0];
  }
  projectSummary(index: number, blurb: string): string {
    if (!this.showAll())
      return [
        'Connecting inventory, payments, and commerce for 200+ businesses. A focused API redesign made everything move faster.',
        'Making municipal payments work reliably. Automated settlements turn hundreds of daily transactions into completed payments.',
        'Bringing real-time visibility to a distribution network of 4,500 distributors and 200,000 retailers.',
      ][index];
    return blurb;
  }
  formValid(): boolean {
    return !!(
      this.form.name.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim()) &&
      this.form.subject.trim() &&
      this.form.message.trim().length >= 5
    );
  }
  async onSubmit(): Promise<void> {
    if (this.submitting() || !this.formValid()) return;
    this.submitMessage.set('');
    this.submitError.set(false);
    if (!this.emailConfigured) {
      const body =
        'Name: ' + this.form.name + '\nEmail: ' + this.form.email + '\n\n' + this.form.message;
      window.location.href =
        'mailto:hssnmd.farhad@gmail.com?subject=' +
        encodeURIComponent(this.form.subject) +
        '&body=' +
        encodeURIComponent(body);
      this.submitMessage.set(
        'Your email draft is ready in your email app. Send it there to complete your message.',
      );
      return;
    }
    this.submitting.set(true);
    try {
      const result = await this.email.send(this.form);
      if (!result.success) throw new Error(result.error);
      this.submitMessage.set('Thanks for reaching out. Your message has been sent.');
      this.form = { name: '', email: '', subject: '', message: '' };
    } catch {
      this.submitError.set(true);
      this.submitMessage.set(
        'Your message could not be sent. Please try again or email me directly.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
