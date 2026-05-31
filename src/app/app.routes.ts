import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./components/entry/entry.component').then((m) => m.EntryComponent)
  },
  {
    path: 'experience',
    loadComponent: () =>
      import('./components/experience/experience.component').then((m) => m.ExperienceComponent)
  },
  {
    path: 'page',
    loadComponent: () =>
      import('./components/page/page.component').then((m) => m.PageComponent)
  },
  { path: '**', redirectTo: '' }
];
