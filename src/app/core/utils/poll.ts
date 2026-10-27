import { Observable, Subject, defer, switchMap, takeUntil, timer } from 'rxjs';

export interface PollOptions {
  /** Intervalo entre intentos en ms (por defecto 2000). */
  intervalMs?: number;
  /** Número máximo de intentos (por defecto 6). */
  maxAttempts?: number;
}

/**
 * Sondeo acotado: repite `fn` cada `intervalMs` hasta que deje de devolver `pending`,
 * o hasta agotar `maxAttempts`. Si se emite en `cancel$`, el sondeo se cancela.
 *
 * smart-resurfacing, Decisiones 2 y 3: cancelable al cambiar de nota o salir.
 */
export function pollUntilReady<T>(
  fn: () => Observable<T>,
  isPending: (value: T) => boolean,
  cancel$: Observable<unknown>,
  { intervalMs = 2000, maxAttempts = 6 }: PollOptions = {},
): Observable<T> {
  return new Observable<T>((subscriber) => {
    let attempts = 0;
    const stop$ = new Subject<void>();

    const run = () => {
      attempts++;
      defer(fn).subscribe({
        next: (value) => {
          subscriber.next(value);
          if (!isPending(value) || attempts >= maxAttempts) {
            subscriber.complete();
            stop$.next();
          } else {
            // Esperar el intervalo antes del siguiente intento.
            // `next` (no `complete`) porque takeUntil dispara complete al cancelar
            // y no queremos que eso arrange otro intento.
            timer(intervalMs)
              .pipe(takeUntil(stop$))
              .subscribe({ next: () => run() });
          }
        },
        error: (err) => {
          subscriber.error(err);
          stop$.next();
        },
      });
    };

    const cancelSub = cancel$.pipe(switchMap(() => [])).subscribe({
      complete: () => {
        stop$.next();
        subscriber.complete();
      },
    });

    const cancelSub2 = cancel$.subscribe(() => {
      stop$.next();
      subscriber.complete();
    });

    run();

    return () => {
      stop$.next();
      cancelSub.unsubscribe();
      cancelSub2.unsubscribe();
    };
  });
}
