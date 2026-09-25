import { Routes } from '@angular/router';
import { noAuthGuard } from '../../core/guards/auth.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        canActivate: [noAuthGuard],
        loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        canActivate: [noAuthGuard],
        loadComponent: () => import('./pages/register.page').then((m) => m.RegisterPage),
      },
      {
        path: 'forgot-password',
        canActivate: [noAuthGuard],
        loadComponent: () => import('./pages/forgot-password.page').then((m) => m.ForgotPasswordPage),
      },
      {
        // No guard: the emailed link must work even in a browser with a (soon dead) session.
        path: 'reset-password',
        loadComponent: () => import('./pages/reset-password.page').then((m) => m.ResetPasswordPage),
      },
    ],
  },
];
