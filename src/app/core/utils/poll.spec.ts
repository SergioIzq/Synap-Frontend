import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollUntilReady } from './poll';

describe('pollUntilReady', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emite inmediatamente cuando el primer resultado no es pending', async () => {
    const emitted: string[] = [];
    const cancel$ = new Subject<void>();

    pollUntilReady(
      () => of('ready'),
      (v) => v === 'pending',
      cancel$,
      { intervalMs: 2000 },
    ).subscribe({ next: (v) => emitted.push(v) });

    await vi.runAllTimersAsync();
    expect(emitted).toEqual(['ready']);
    cancel$.complete();
  });

  it('reintenta hasta que el resultado deja de ser pending', async () => {
    let calls = 0;
    const emitted: string[] = [];
    const cancel$ = new Subject<void>();

    pollUntilReady(
      () => {
        calls++;
        return of(calls < 3 ? 'pending' : 'ready');
      },
      (v) => v === 'pending',
      cancel$,
      { intervalMs: 100 },
    ).subscribe({ next: (v) => emitted.push(v) });

    await vi.runAllTimersAsync();

    expect(emitted).toEqual(['pending', 'pending', 'ready']);
    expect(calls).toBe(3);
    cancel$.complete();
  });

  it('se detiene al agotar maxAttempts aunque siga siendo pending', async () => {
    let completed = false;
    const emitted: string[] = [];
    const cancel$ = new Subject<void>();

    pollUntilReady(
      () => of('pending'),
      (v) => v === 'pending',
      cancel$,
      { intervalMs: 100, maxAttempts: 3 },
    ).subscribe({ next: (v) => emitted.push(v), complete: () => (completed = true) });

    await vi.runAllTimersAsync();

    expect(emitted.length).toBe(3);
    expect(emitted.every((v) => v === 'pending')).toBe(true);
    expect(completed).toBe(true);
    cancel$.complete();
  });

  it('se cancela cuando cancel$ emite', async () => {
    let calls = 0;
    let completed = false;
    const cancel$ = new Subject<void>();

    pollUntilReady(
      () => { calls++; return of('pending'); },
      (v) => v === 'pending',
      cancel$,
      { intervalMs: 100 },
    ).subscribe({ complete: () => (completed = true) });

    await vi.advanceTimersByTimeAsync(0); // primer intento
    cancel$.next();
    await vi.advanceTimersByTimeAsync(300); // no debe haber más intentos

    expect(calls).toBe(1);
    expect(completed).toBe(true);
    cancel$.complete();
  });

  it('propaga el error del primer intento sin reintentar', async () => {
    let errorReceived: unknown;
    const cancel$ = new Subject<void>();

    pollUntilReady<string>(
      () => throwError(() => new Error('fallo de red')),
      (v) => v === 'pending',
      cancel$,
      { intervalMs: 100 },
    ).subscribe({ error: (e) => (errorReceived = e) });

    await vi.runAllTimersAsync();

    expect(errorReceived).toBeInstanceOf(Error);
    cancel$.complete();
  });
});
