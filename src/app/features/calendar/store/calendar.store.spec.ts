import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CalendarStore } from './calendar.store';
import { CalendarService } from '../services/calendar.service';
import { CalendarDto, CalendarEventDto } from '../services/calendar.models';

const mockCalendar = (): CalendarDto => ({
  id: 'cal-1', name: 'Personal', color: '#3b82f6', scope: 'personal', enabled: true, lastSyncedAt: null,
});

const mockEvent = (): CalendarEventDto => ({
  id: 'evt-1', calendarId: 'cal-1', title: 'Daily', start: '2026-11-14T09:00:00Z',
  end: '2026-11-14T10:00:00Z', allDay: false, date: null, location: null,
  description: null, recurring: false, color: '#3b82f6', scope: 'personal',
});

function mockService() {
  return {
    listCalendars: vi.fn(),
    listEvents: vi.fn(),
    requestSync: vi.fn(),
    patchCalendar: vi.fn(),
  };
}

describe('CalendarStore', () => {
  let store: CalendarStore;
  let service: ReturnType<typeof mockService>;

  beforeEach(() => {
    service = mockService();
    TestBed.configureTestingModule({
      providers: [CalendarStore, { provide: CalendarService, useValue: service }],
    });
    store = TestBed.inject(CalendarStore);
    store.reset();
  });

  it('loadCalendars sets calendars on success', async () => {
    service.listCalendars.mockReturnValue(
      of({ isSuccess: true, isFailure: false, value: { calendars: [mockCalendar()] } }),
    );
    await store.loadCalendars();
    expect(store.calendars().length).toBe(1);
    expect(store.hasCalendar()).toBe(true);
  });

  it('loadCalendars sets error on failure', async () => {
    service.listCalendars.mockReturnValue(throwError(() => new Error('network')));
    await store.loadCalendars();
    expect(store.error()).toBeTruthy();
  });

  it('visibleEvents filters by scope', async () => {
    const workEvent: CalendarEventDto = { ...mockEvent(), id: 'evt-2', scope: 'work' };
    service.listCalendars.mockReturnValue(
      of({ isSuccess: true, isFailure: false, value: { calendars: [mockCalendar()] } }),
    );
    service.listEvents.mockReturnValue(
      of({ isSuccess: true, isFailure: false, value: { events: [mockEvent(), workEvent] } }),
    );

    await store.loadCalendars();
    await store.loadEvents(new Date(), new Date());

    store.setScope('work');
    expect(store.visibleEvents().every((e) => e.scope === 'work')).toBe(true);

    store.setScope('personal');
    expect(store.visibleEvents().every((e) => e.scope === 'personal')).toBe(true);

    store.setScope('all');
    expect(store.visibleEvents().length).toBe(2);
  });

  it('visibleEvents filters out hidden calendars', async () => {
    service.listCalendars.mockReturnValue(
      of({ isSuccess: true, isFailure: false, value: { calendars: [mockCalendar()] } }),
    );
    service.listEvents.mockReturnValue(
      of({ isSuccess: true, isFailure: false, value: { events: [mockEvent()] } }),
    );
    await store.loadCalendars();
    await store.loadEvents(new Date(), new Date());

    store.toggleCalendarVisibility('cal-1');
    expect(store.visibleEvents().length).toBe(0);

    store.toggleCalendarVisibility('cal-1');
    expect(store.visibleEvents().length).toBe(1);
  });

  it('requestSync reloads events and calendars', async () => {
    service.requestSync.mockReturnValue(of(undefined));
    service.listCalendars.mockReturnValue(
      of({ isSuccess: true, isFailure: false, value: { calendars: [mockCalendar()] } }),
    );
    service.listEvents.mockReturnValue(
      of({ isSuccess: true, isFailure: false, value: { events: [] } }),
    );

    // Prime a range so loadEvents is called
    (store as unknown as { _range: { set: (v: unknown) => void } })['_range'].set({
      from: new Date(),
      to: new Date(),
    });

    await store.requestSync();
    expect(service.requestSync).toHaveBeenCalled();
    expect(service.listCalendars).toHaveBeenCalled();
  });
});
