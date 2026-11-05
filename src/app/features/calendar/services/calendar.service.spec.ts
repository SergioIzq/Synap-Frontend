import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CalendarService } from './calendar.service';
import { environment } from '../../../../environments/environment';

describe('CalendarService', () => {
  let service: CalendarService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/calendar`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CalendarService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listCalendars GETs /calendar/calendars', () => {
    const payload = { isSuccess: true, isFailure: false, value: { calendars: [] } };
    service.listCalendars().subscribe((res) => expect(res.value.calendars).toEqual([]));
    http.expectOne(`${base}/calendars`).flush(payload);
  });

  it('listEvents includes scope param when not all', () => {
    const from = new Date('2026-11-14T00:00:00Z');
    const to = new Date('2026-11-21T00:00:00Z');
    const payload = { isSuccess: true, isFailure: false, value: { events: [] } };
    service.listEvents(from, to, 'work').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/events`);
    expect(req.request.params.get('scope')).toBe('work');
    req.flush(payload);
  });

  it('listEvents omits scope param when all', () => {
    const from = new Date('2026-11-14T00:00:00Z');
    const to = new Date('2026-11-21T00:00:00Z');
    const payload = { isSuccess: true, isFailure: false, value: { events: [] } };
    service.listEvents(from, to, 'all').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/events`);
    expect(req.request.params.has('scope')).toBe(false);
    req.flush(payload);
  });

  it('requestSync POSTs /calendar/sync', () => {
    service.requestSync().subscribe();
    http.expectOne({ method: 'POST', url: `${base}/sync` }).flush(null);
  });

  it('patchCalendar PATCHes /calendar/calendars/:id', () => {
    service.patchCalendar('cal-1', { scope: 'work' }).subscribe();
    const req = http.expectOne(`${base}/calendars/cal-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ scope: 'work' });
    req.flush(null);
  });
});
