import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-entry',
  standalone: true,
  template: `
    <main class="entry">
      <h1>Loading…</h1>
      <p>Redirecting to the standard portfolio.</p>
      <a href="/">Open the standard portfolio</a>
    </main>
  `,
  styles: [`
    .entry { min-height: 100dvh; display: grid; place-items: center; text-align: center; gap: .5rem; }
    h1 { font-weight: 300; letter-spacing: .04em; }
    p  { opacity: .65; }
    a  { color: inherit; }
  `]
})
export class EntryComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.location.replace('/');
  }
}
