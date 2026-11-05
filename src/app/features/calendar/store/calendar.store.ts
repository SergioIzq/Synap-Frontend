import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CalendarService } from '../services/calendar.service';
import { CalendarDto, CalendarEventDto, CalendarScope } from '../services/calendar.models';
import { apiErrorMessage } from '../../../core/utils/http-errors';

const SCOPE_KEY = 'calendar_scope';
const HIDDEN_KEY = 'calendar_hidden';

function readLocalScope(): CalendarScope {
  try {
    const v = localStorage.getItem(SCOPE_KEY);
    if (v === 'personal' || v === 'work' || v === 'all') return v;
  } catch {
    // ignore
  }
  return 'all';
}

function readHiddenCalendars(): Set<string> {
  try {
    const v = localStorage.getItem(HIDDEN_KEY);
    if (v) return new Set<string>(JSON.parse(v) as string[]);
  } catch {
    // ignore
  }
  return new Set<string>();
}

function saveLocalScope(scope: CalendarScope): void {
  try { localStorage.setItem(SCOPE_KEY, scope); } catch { /* ignore */ }
}

function saveHiddenCalendars(hidden: Set<string>): void {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden])); } catch { /* ignore */ }
}

export interface VisibleRange {
  from: Date;
  to: Date;
}

@Injectable({ providedIn: 'root' })
export class CalendarStore {
  private readonly service = inject(CalendarService);

  private readonly _calendars = signal<CalendarDto[]>([]);
  private readonly _events = signal<CalendarEventDto[]>([]);
  private readonly _range = signal<VisibleRange | null>(null);
  private readonly _syncing = signal(false);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _syncError = signal<string | null>(null);
  private readonly _scope = signal<CalendarScope>(readLocalScope());
  private readonly _hiddenCalendars = signal<Set<string>>(readHiddenCalendars());

  readonly calendars = this._calendars.asReadonly();
  readonly events = this._events.asReadonly();
  readonly range = this._range.asReadonly();
  readonly syncing = this._syncing.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly syncError = this._syncError.asReadonly();
  readonly scope = this._scope.asReadonly();
  readonly hiddenCalendars = this._hiddenCalendars.asReadonly();

  readonly hasCalendar = computed(() => this._calendars().length > 0);

  readonly visibleEvents = computed(() => {
    const hidden = this._hiddenCalendars();
    const scope = this._scope();
    return this._events().filter(
      (e) =>
        !hidden.has(e.calendarId) && (scope === 'all' || e.scope === scope),
    );
  });

  async loadCalendars(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await firstValueFrom(this.service.listCalendars());
      if (res.isSuccess) this._calendars.set(res.value.calendars);
    } catch (err) {
      this._error.set(apiErrorMessage(err, 'No se pudieron cargar tus calendarios.'));
    } finally {
      this._loading.set(false);
    }
  }

  async loadEvents(from: Date, to: Date): Promise<void> {
    this._range.set({ from, to });
    try {
      const res = await firstValueFrom(this.service.listEvents(from, to));
      if (res.isSuccess) this._events.set(res.value.events);
    } catch {
      // keep last events on error
    }
  }

  async patchCalendar(id: string, patch: { scope?: 'personal' | 'work'; color?: string; enabled?: boolean }): Promise<void> {
    await firstValueFrom(this.service.patchCalendar(id, patch));
    this._calendars.update((cals) =>
      cals.map((c) =>
        c.id === id
          ? { ...c, ...patch, color: patch.color ?? c.color }
          : c,
      ),
    );
  }

  async requestSync(): Promise<void> {
    this._syncing.set(true);
    this._syncError.set(null);
    try {
      await firstValueFrom(this.service.requestSync());
      const range = this._range();
      if (range) await this.loadEvents(range.from, range.to);
      await this.loadCalendars();
    } catch (err) {
      this._syncError.set(apiErrorMessage(err, 'No se pudo sincronizar.'));
    } finally {
      this._syncing.set(false);
    }
  }

  setScope(scope: CalendarScope): void {
    this._scope.set(scope);
    saveLocalScope(scope);
  }

  toggleCalendarVisibility(id: string): void {
    this._hiddenCalendars.update((hidden) => {
      const next = new Set(hidden);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveHiddenCalendars(next);
      return next;
    });
  }

  reset(): void {
    this._calendars.set([]);
    this._events.set([]);
    this._range.set(null);
    this._error.set(null);
    this._syncError.set(null);
  }
}
