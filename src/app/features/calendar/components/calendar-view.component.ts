import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Calendar as FullCalendar, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import luxon3Plugin from '@fullcalendar/luxon3';
import { CalendarStore } from '../store/calendar.store';
import { CalendarDto, CalendarEventDto, CalendarScope } from '../services/calendar.models';
import { browserTimezone } from '../../../core/utils/dates';

const MOBILE_BREAKPOINT = 768;

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styles: [`
    :host { display: block; height: 100%; }

    .no-calendar {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 3rem 1rem;
      text-align: center;
      color: var(--p-text-secondary-color, #666);

      i { font-size: 3rem; opacity: .5; }
      a { color: var(--p-primary-color, #2563eb); text-decoration: none; font-weight: 600; }
    }

    .toolbar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .btn {
      padding: 0.35rem 0.75rem;
      border: 1px solid var(--p-border-color, #ccc);
      border-radius: 6px;
      background: none;
      cursor: pointer;
      font-size: 0.85rem;
      transition: background .15s;
      &:hover { background: var(--p-surface-hover, #f5f5f5); }
      &.active { background: var(--p-primary-color, #2563eb); color: #fff; border-color: transparent; }
    }

    .scope-btn { font-size: 0.8rem; }

    .sync-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: var(--p-text-secondary-color, #666);
      margin-bottom: 0.5rem;
      flex-wrap: wrap;
    }

    .sync-err { color: var(--p-danger-color, #dc2626); }

    .cal-toggles {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .cal-toggle {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      user-select: none;
      font-size: 0.82rem;
      opacity: 1;
      &.hidden { opacity: .45; }
    }

    .cal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .fc-container {
      height: calc(100vh - 220px);
      min-height: 400px;
    }

    @media (max-width: 767px) {
      .fc-container { height: calc(100dvh - 240px); }
    }

    .event-panel {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 200;
      background: var(--p-surface-overlay, #fff);
      border-top: 1px solid var(--p-border-color, #ccc);
      border-radius: 12px 12px 0 0;
      padding: 1.25rem 1rem 2rem;
      max-height: 60dvh;
      overflow-y: auto;
      box-shadow: 0 -4px 24px rgba(0,0,0,.12);

      h4 { margin: 0 0 0.5rem; font-size: 1.05rem; }
      .event-meta { font-size: 0.85rem; color: var(--p-text-secondary-color, #666); margin-bottom: 0.25rem; }
      .event-desc { font-size: 0.9rem; margin-top: 0.75rem; white-space: pre-wrap; }
      .close-btn { float: right; background: none; border: none; cursor: pointer; font-size: 1.1rem; }

      @media (min-width: 768px) {
        inset: auto 1rem 1rem auto;
        width: 340px;
        border-radius: 10px;
        border: 1px solid var(--p-border-color, #ccc);
        max-height: 50vh;
      }
    }
  `],
  template: `
    @if (!store.hasCalendar() && !store.loading()) {
      <div class="no-calendar">
        <i class="pi pi-calendar"></i>
        <p>No tienes ningún calendario conectado.</p>
        <a routerLink="/app/settings">Conectar en Configuración →</a>
      </div>
    }

    @if (store.hasCalendar()) {
      <div class="toolbar">
        <div class="toolbar-group">
          <button class="btn" (click)="fc?.prev()">‹</button>
          <button class="btn" (click)="fc?.today()">Hoy</button>
          <button class="btn" (click)="fc?.next()">›</button>
        </div>

        <div class="toolbar-group">
          <button class="btn" [class.active]="currentView() === 'timeGridDay'" (click)="changeView('timeGridDay')">Día</button>
          <button class="btn" [class.active]="currentView() === 'timeGridWeek'" (click)="changeView('timeGridWeek')">Semana</button>
          <button class="btn" [class.active]="currentView() === 'dayGridMonth'" (click)="changeView('dayGridMonth')">Mes</button>
          <button class="btn" [class.active]="currentView() === 'listWeek'" (click)="changeView('listWeek')">Agenda</button>
        </div>

        <div class="toolbar-group" style="margin-left: auto">
          <button class="btn scope-btn" [class.active]="store.scope() === 'personal'" (click)="store.setScope('personal')">Personal</button>
          <button class="btn scope-btn" [class.active]="store.scope() === 'work'" (click)="store.setScope('work')">Trabajo</button>
          <button class="btn scope-btn" [class.active]="store.scope() === 'all'" (click)="store.setScope('all')">Ambos</button>
        </div>
      </div>

      <div class="cal-toggles">
        @for (cal of store.calendars(); track cal.id) {
          <span class="cal-toggle" [class.hidden]="store.hiddenCalendars().has(cal.id)" (click)="store.toggleCalendarVisibility(cal.id)">
            <span class="cal-dot" [style.background]="cal.color"></span>
            {{ cal.name }}
          </span>
        }
      </div>

      <div class="sync-row">
        @if (lastSyncedAt()) {
          <span>Última sincronización: {{ lastSyncedAt() }}</span>
        }
        @if (store.syncError()) {
          <span class="sync-err">{{ store.syncError() }}</span>
        }
        <button class="btn" [disabled]="store.syncing()" (click)="sync()">
          {{ store.syncing() ? 'Sincronizando…' : 'Sincronizar ahora' }}
        </button>
      </div>

      <div #calEl class="fc-container"></div>
    }

    @if (selectedEvent()) {
      <div class="event-panel">
        <button class="close-btn" (click)="selectedEvent.set(null)" aria-label="Cerrar">✕</button>
        <h4>{{ selectedEvent()!.title }}</h4>
        <p class="event-meta">{{ formatEventDate(selectedEvent()!) }}</p>
        @if (selectedEvent()!.recurring) {
          <p class="event-meta"><i class="pi pi-refresh"></i> Evento recurrente</p>
        }
        @if (selectedEvent()!.location) {
          <p class="event-meta"><i class="pi pi-map-marker"></i> {{ selectedEvent()!.location }}</p>
        }
        @if (selectedEvent()!.description) {
          <p class="event-desc">{{ selectedEvent()!.description }}</p>
        }
        <p class="event-meta" style="margin-top:.5rem">
          <span class="cal-dot" [style.background]="calendarColor(selectedEvent()!.calendarId)" style="display:inline-block"></span>
          {{ calendarName(selectedEvent()!.calendarId) }} · {{ selectedEvent()!.scope === 'work' ? 'Trabajo' : 'Personal' }}
        </p>
      </div>
    }
  `,
})
export class CalendarViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('calEl') private calEl!: ElementRef<HTMLDivElement>;

  protected readonly store = inject(CalendarStore);

  protected fc: FullCalendar | null = null;
  protected readonly currentView = signal<string>('');
  protected readonly selectedEvent = signal<CalendarEventDto | null>(null);

  constructor() {
    effect(() => {
      const events = this.store.visibleEvents();
      this.fc?.removeAllEventSources();
      this.fc?.addEventSource(events.map(toFcEvent));
    });
  }

  ngAfterViewInit(): void {
    if (!this.store.hasCalendar()) return;
    this.initCalendar();
    void this.loadRange();
  }

  protected initCalendar(): void {
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    const tz = browserTimezone() ?? 'UTC';

    this.fc = new FullCalendar(this.calEl.nativeElement, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, luxon3Plugin],
      initialView: isMobile ? 'listWeek' : 'timeGridWeek',
      timeZone: tz,
      locale: 'es',
      headerToolbar: false,
      height: '100%',
      firstDay: 1,
      allDayText: 'Todo el día',
      noEventsText: 'Sin eventos',
      eventClick: (arg: EventClickArg) => {
        const id = arg.event.id;
        const ev = this.store.events().find((e) => e.id === id) ?? null;
        this.selectedEvent.set(ev);
      },
      datesSet: (info) => {
        this.currentView.set(info.view.type);
        void this.store.loadEvents(info.start, info.end);
      },
    });

    this.fc.render();
    this.currentView.set(this.fc.view.type);
  }

  private async loadRange(): Promise<void> {
    await this.store.loadCalendars();
    // FullCalendar fires datesSet after render; initial events loaded there
  }

  changeView(view: string): void {
    this.fc?.changeView(view);
  }

  async sync(): Promise<void> {
    await this.store.requestSync();
    // Refresh event sources after sync
    const events = this.store.visibleEvents();
    this.fc?.removeAllEventSources();
    this.fc?.addEventSource(events.map(toFcEvent));
  }

  protected lastSyncedAt(): string | null {
    const dates = this.store.calendars()
      .map((c) => c.lastSyncedAt)
      .filter((d): d is string => d !== null)
      .map((d) => new Date(d).getTime());
    if (!dates.length) return null;
    const latest = new Date(Math.max(...dates));
    return latest.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected formatEventDate(e: CalendarEventDto): string {
    if (e.allDay) return e.date ?? 'Todo el día';
    const start = new Date(e.start).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    const end = new Date(e.end).toLocaleString('es-ES', { timeStyle: 'short' });
    return `${start} – ${end}`;
  }

  protected calendarName(calId: string): string {
    return this.store.calendars().find((c) => c.id === calId)?.name ?? '';
  }

  protected calendarColor(calId: string): string {
    return this.store.calendars().find((c) => c.id === calId)?.color ?? '#888';
  }

  ngOnDestroy(): void {
    this.fc?.destroy();
  }
}

function toFcEvent(e: CalendarEventDto): object {
  return {
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    backgroundColor: e.color,
    borderColor: e.color,
  };
}
