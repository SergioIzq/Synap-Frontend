import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const ASSISTANT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/assistant.page').then((m) => m.AssistantPage),
  },
];
