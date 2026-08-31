import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../stores/auth.store';

/**
 * Minimal global error handling - no toast/notification library is wired up yet (Synap hasn't
 * picked a UI component library), so this only handles the one cross-cutting concern that must
 * exist from day one: an expired/invalid session should not leave the user stuck.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/login') && !req.url.includes('/auth/register')) {
        authStore.logout();
        router.navigate(['/auth/login']);
      }

      return throwError(() => error);
    }),
  );
};
