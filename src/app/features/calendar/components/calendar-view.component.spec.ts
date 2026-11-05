import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { CalendarViewComponent } from './calendar-view.component';
import { CalendarStore } from '../store/calendar.store';
import { signal, computed } from '@angular/core';
import { CalendarDto, CalendarEventDto } from '../services/calendar.models';

const calendarStub = (): CalendarDto => ({
  id: 'cal-1', name: 'Personal', color: '#3b82f6', scope: 'personal', enabled: true, lastSyncedAt: null,
});

function makeStoreSpy(cals: CalendarDto[], events: CalendarEventDto[] = []) {
  return {
    loadCalendars: vi.fn().mockResolvedValue(undefined),
    loadEvents: vi.fn().mockResolvedValue(undefined),
    requestSync: vi.fn().mockResolvedValue(undefined),
    setScope: vi.fn(),
    toggleCalendarVisibility: vi.fn(),
    reset: vi.fn(),
    calendars: signal(cals).asReadonly(),
    events: signal(events).asReadonly(),
    visibleEvents: computed(() => events),
    hasCalendar: computed(() => cals.length > 0),
    scope: signal<'all' | 'personal' | 'work'>('all').asReadonly(),
    hiddenCalendars: signal(new Set<string>()).asReadonly(),
    syncing: signal(false).asReadonly(),
    loading: signal(false).asReadonly(),
    error: signal<string | null>(null).asReadonly(),
    syncError: signal<string | null>(null).asReadonly(),
  };
}

describe('CalendarViewComponent', () => {
  it('shows no-calendar message when user has no calendars', async () => {
    TestBed.configureTestingModule({
      imports: [CalendarViewComponent],
      providers: [provideRouter([]), { provide: CalendarStore, useValue: makeStoreSpy([]) }],
    });
    const fixture = TestBed.createComponent(CalendarViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const noCalEl = fixture.debugElement.query(By.css('.no-calendar'));
    expect(noCalEl).toBeTruthy();
    expect(noCalEl.nativeElement.textContent).toContain('Configuración');
  });

  it('shows the toolbar when user has calendars', async () => {
    const spy = makeStoreSpy([calendarStub()]);
    TestBed.configureTestingModule({
      imports: [CalendarViewComponent],
      providers: [provideRouter([]), { provide: CalendarStore, useValue: spy }],
    });
    const fixture = TestBed.createComponent(CalendarViewComponent);
    // Avoid FullCalendar DOM rendering in unit tests (needs a real DOM)
    vi.spyOn(fixture.componentInstance as unknown as { initCalendar(): void }, 'initCalendar').mockImplementation(() => undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    const toolbar = fixture.debugElement.query(By.css('.toolbar'));
    expect(toolbar).toBeTruthy();
  });

  it('shows calendar toggles for each calendar', async () => {
    const twoCalendars = [calendarStub(), { ...calendarStub(), id: 'cal-2', name: 'Trabajo', scope: 'work' as const }];
    const spy = makeStoreSpy(twoCalendars);
    TestBed.configureTestingModule({
      imports: [CalendarViewComponent],
      providers: [provideRouter([]), { provide: CalendarStore, useValue: spy }],
    });
    const fixture = TestBed.createComponent(CalendarViewComponent);
    vi.spyOn(fixture.componentInstance as unknown as { initCalendar(): void }, 'initCalendar').mockImplementation(() => undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    const toggles = fixture.debugElement.queryAll(By.css('.cal-toggle'));
    expect(toggles.length).toBe(2);
  });
});
