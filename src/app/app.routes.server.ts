import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'experience', renderMode: RenderMode.Prerender },
  { path: 'page', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Prerender }
];
