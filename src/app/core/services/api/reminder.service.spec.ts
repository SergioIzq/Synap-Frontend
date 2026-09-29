import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ReminderService } from './reminder.service';
import { browserTimezone } from '../../utils/dates';

const REMINDER = {
  id: 'r1',
  text: 'Renovar el certificado SSL',
  dueAt: '2026-10-03T07:00:00Z',
  recurrence: null,
  noteId: null,
  noteTitle: null,
};

describe('ReminderService', () => {
  let service: ReminderService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/reminders`;
  const telegram = `${environment.apiUrl}/settings/telegram`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReminderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() unwraps the reminders, the connection state and the limit', async () => {
    const promise = firstValueFrom(service.list());
    const body = { reminders: [REMINDER], telegramConnected: true, maxTextLength: 500 };
    http.expectOne({ method: 'GET', url: base }).flush({ value: body });
    expect(await promise).toEqual(body);
  });

  it("forNote() asks for that note's reminders", async () => {
    const promise = firstValueFrom(service.forNote('n1'));
    http.expectOne({ method: 'GET', url: `${base}/note/n1` }).flush({ value: [REMINDER] });
    expect(await promise).toEqual([REMINDER]);
  });

  it('create() posts the reminder with the browser timezone', async () => {
    const promise = firstValueFrom(
      service.create({ text: 'Renovar el certificado SSL', dueAtUtc: '2026-10-03T07:00:00Z' }),
    );
    const req = http.expectOne({ method: 'POST', url: base });
    expect(req.request.body.text).toBe('Renovar el certificado SSL');
    expect(req.request.body.dueAtUtc).toBe('2026-10-03T07:00:00Z');
    expect(req.request.body.timezone).toBe(browserTimezone());
    req.flush({ value: REMINDER });
    expect(await promise).toEqual(REMINDER);
  });

  it('create() passes a recurrence and a note link through', async () => {
    const promise = firstValueFrom(
      service.create({ text: 'Revisar copias', dueAtUtc: '2026-10-05T07:00:00Z', recurrence: 'weekly:0', noteId: 'n1' }),
    );
    const req = http.expectOne({ method: 'POST', url: base });
    expect(req.request.body.recurrence).toBe('weekly:0');
    expect(req.request.body.noteId).toBe('n1');
    req.flush({ value: REMINDER });
    await promise;
  });

  it('update() puts the new text, moment and recurrence', async () => {
    const promise = firstValueFrom(
      service.update('r1', { text: 'Otro', dueAtUtc: '2026-10-09T07:00:00Z', recurrence: 'daily' }),
    );
    const req = http.expectOne({ method: 'PUT', url: `${base}/r1` });
    expect(req.request.body.text).toBe('Otro');
    expect(req.request.body.recurrence).toBe('daily');
    expect(req.request.body.timezone).toBe(browserTimezone());
    req.flush({ value: null });
    expect(await promise).toBeUndefined();
  });

  it('cancel() deletes the reminder', async () => {
    const promise = firstValueFrom(service.cancel('r1'));
    http.expectOne({ method: 'DELETE', url: `${base}/r1` }).flush({ value: null });
    expect(await promise).toBeUndefined();
  });

  it('telegramStatus() unwraps the connection state', async () => {
    const promise = firstValueFrom(service.telegramStatus());
    http.expectOne({ method: 'GET', url: telegram }).flush({ value: { connected: false, timezone: null } });
    expect(await promise).toEqual({ connected: false, timezone: null });
  });

  it('startTelegramLink() posts and returns the code once', async () => {
    const promise = firstValueFrom(service.startTelegramLink());
    const body = { code: 'ABC123', botUsername: 'SynapBot', expiresAtUtc: '2026-09-29T12:15:00Z' };
    http.expectOne({ method: 'POST', url: `${telegram}/link` }).flush({ value: body });
    expect(await promise).toEqual(body);
  });

  it('disconnectTelegram() deletes the link', async () => {
    const promise = firstValueFrom(service.disconnectTelegram());
    http.expectOne({ method: 'DELETE', url: telegram }).flush({ value: null });
    expect(await promise).toBeUndefined();
  });
});
