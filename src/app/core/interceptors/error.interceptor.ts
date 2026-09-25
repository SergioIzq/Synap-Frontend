import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../stores/auth.store';
import { NotificationService } from '../services/notification.service';

/**
 * Cross-cutting HTTP error handling:
 * - an expired/invalid session logs out instead of leaving the user stuck;
 * - network failures and 5xx get one global Spanish toast (specs/web-experience "Operation
 *   feedback"). 4xx are business errors - each store shows its own message for those.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/login') && !req.url.includes('/auth/register')) {
        authStore.logout();
        router.navigate(['/auth/login']);
      } else if (error.status === 0) {
        notifications.error('Sin conexión con el servidor', 'Comprueba tu conexión e inténtalo de nuevo.');
      } else if (error.status >= 500) {
        notifications.error('Algo ha fallado en el servidor', 'Inténtalo de nuevo en unos segundos.');
      }

      return throwError(() => error);
    }),
  );
};
