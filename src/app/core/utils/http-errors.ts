import { HttpErrorResponse } from '@angular/common/http';
import { ApiResult } from '../models';

/**
 * A "successful" response whose body isn't the API's JSON - e.g. a web server answering
 * /api with the SPA's index.html. HttpClient reports it as a 2xx HttpErrorResponse wrapping
 * the parser's SyntaxError (fix-notes-list design.md Decision 6).
 */
export function isNonApiResponse(err: unknown): boolean {
  return (
    err instanceof HttpErrorResponse &&
    err.status >= 200 &&
    err.status < 300 &&
    (err.error as { error?: unknown } | null)?.error instanceof SyntaxError
  );
}

/**
 * Network failures, 5xx and non-API responses are announced once, globally, by
 * errorInterceptor; stores only report the business (4xx) errors they understand - so the
 * user never gets two toasts for the same failure.
 */
export function isHandledGlobally(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500 || isNonApiResponse(err));
}

/**
 * The backend's Spanish Result message when there is one, otherwise `fallback` - never a
 * parser or transport message such as "Unexpected token '<'".
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse && !isNonApiResponse(err)) {
    const message = (err.error as ApiResult | undefined)?.error?.message;
    return typeof message === 'string' && message ? message : fallback;
  }
  return fallback;
}
