import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '../stores/auth.store';

/**
 * Attaches the session JWT as a Bearer header. Unlike Kash's cookie-based web session, Synap's
 * interactive login stays token-in-header/localStorage - simpler, and consistent with the
 * personal-access-token flow (design.md Decision 3) which is already a plain Bearer token with
 * no cookie involved.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const token = authStore.token();

  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
