import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'notes',
    loadChildren: () => import('./features/notes/notes.routes').then((m) => m.NOTES_ROUTES),
  },
  {
    path: 'assistant',
    loadChildren: () => import('./features/assistant/assistant.routes').then((m) => m.ASSISTANT_ROUTES),
  },
  {
    // The notes feature's own authGuard (on each of its child routes) is what actually enforces
    // login - this redirect is unconditional, resolved to a login redirect downstream.
    path: '',
    pathMatch: 'full',
    redirectTo: 'notes',
  },
];
