import { HttpErrorResponse } from '@angular/common/http';
import { ApiResult } from '../models';

/**
 * Network failures and 5xx are announced once, globally, by errorInterceptor; stores only
 * report the business (4xx) errors they understand - so the user never gets two toasts for
 * the same failure.
 */
export function isHandledGlobally(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500);
}

/** The backend's Spanish Result message when there is one, otherwise `fallback`. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const apiResult = err.error as ApiResult | undefined;
    return apiResult?.error?.message || fallback;
  }
  return fallback;
}
