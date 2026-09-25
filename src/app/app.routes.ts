import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'notes',
        loadChildren: () => import('./features/notes/notes.routes').then((m) => m.NOTES_ROUTES),
      },
      {
        path: 'assistant',
        loadChildren: () =>
          import('./features/assistant/assistant.routes').then((m) => m.ASSISTANT_ROUTES),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/pages/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'notes',
      },
    ],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app',
  },
];
