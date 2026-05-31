import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-entry',
  standalone: true,
  template: `
    <main class="entry">
      <h1>Loading…</h1>
      <p>Choosing the best experience for your device.</p>
    </main>
  `,
  styles: [`
    .entry { min-height: 100dvh; display: grid; place-items: center; text-align: center; gap: .5rem; }
    h1 { font-weight: 300; letter-spacing: .04em; }
    p  { opacity: .65; }
  `]
})
export class EntryComponent implements OnInit {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow  = window.innerWidth < 900;
    const target = reduced || narrow ? '/page' : '/experience';
    // Replace so back button goes to the previous site, not loop.
    this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
