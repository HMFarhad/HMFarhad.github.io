import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./components/experience/experience.component').then((m) => m.ExperienceComponent)
  },
  {
    path: 'experience',
    loadComponent: () =>
      import('./components/experience/experience.component').then((m) => m.ExperienceComponent)
  },
  {
    path: 'page',
    loadComponent: () =>
      import('./components/entry/entry.component').then((m) => m.EntryComponent)
  },
  { path: '**', redirectTo: '' }
];
