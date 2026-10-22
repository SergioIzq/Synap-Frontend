import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService } from 'primeng/api';
import { SettingsService } from '../../../core/services/api/settings.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CalendarSettingsComponent } from './calendar-settings.component';

const NO_CALENDAR = { connected: false, kind: null, connectedAt: null, googleAvailable: true };
const CALDAV = { connected: true, kind: 'CalDav', connectedAt: '2026-10-07T09:00:00Z', googleAvailable: true };
const GOOGLE = { connected: true, kind: 'Google', connectedAt: '2026-10-07T09:00:00Z', googleAvailable: true };

/**
 * calendar-integration task 8.3 - specs/calendar-integration "Connecting a calendar from the web
 * app". Every message is in Spanish, and no credential is ever on screen.
 */
describe('CalendarSettingsComponent', () => {
  let service: {
    get: ReturnType<typeof vi.fn>;
    calendar: ReturnType<typeof vi.fn>;
    connectCalDavCalendar: ReturnType<typeof vi.fn>;
    beginGoogleCalendarAuthorization: ReturnType<typeof vi.fn>;
    connectGoogleCalendar: ReturnType<typeof vi.fn>;
    disconnectCalendar: ReturnType<typeof vi.fn>;
  };
  let confirm: ReturnType<typeof vi.fn>;
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  let queryParams: Record<string, string>;

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  async function render() {
    const fixture = TestBed.createComponent(CalendarSettingsComponent);
    fixture.detectChanges();
    await flush();
    await flush();
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: Awaited<ReturnType<typeof render>>) => fixture.nativeElement as HTMLElement;
  const text = (fixture: Awaited<ReturnType<typeof render>>) => el(fixture).textContent ?? '';
  const button = (fixture: Awaited<ReturnType<typeof render>>, label: string) =>
    [...el(fixture).querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === label);

  beforeEach(() => {
    queryParams = {};
    service = {
      get: vi.fn(() => of({ email: 'a@b.c', ai: {}, briefing: {} })),
      calendar: vi.fn(() => of(NO_CALENDAR)),
      connectCalDavCalendar: vi.fn(() => of(CALDAV)),
      beginGoogleCalendarAuthorization: vi.fn(() => of({ authorizationUrl: 'https://accounts.google.test/auth', state: 'abc' })),
      connectGoogleCalendar: vi.fn(() => of(GOOGLE)),
      disconnectCalendar: vi.fn(() => of(NO_CALENDAR)),
    };
    confirm = vi.fn();
    notifications = { success: vi.fn(), error: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: SettingsService, useValue: service },
        { provide: ConfirmationService, useValue: { confirm } },
        { provide: NotificationService, useValue: notifications },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
        { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      ],
    });
  });

  /** specs/calendar-integration "No calendar connected yet". */
  it('offers both ways and explains that Synap only reads the calendar', async () => {
    const fixture = await render();

    expect(text(fixture)).toContain('Sin conectar');
    expect(text(fixture)).toContain('Google Calendar');
    expect(text(fixture)).toContain('CalDAV');
    expect(text(fixture)).toContain('no guarda ningún evento');
  });

  it('does not offer Google on a deployment with no OAuth client', async () => {
    service.calendar.mockReturnValue(of({ ...NO_CALENDAR, googleAvailable: false }));

    const fixture = await render();

    expect(button(fixture, 'Conectar con Google')).toBeUndefined();
    expect(text(fixture)).toContain('no está disponible en este despliegue');
  });

  /** specs/calendar-integration "Connection state shown" - for each of the two forms. */
  it('says a CalDAV calendar is connected, since when, and offers to disconnect', async () => {
    service.calendar.mockReturnValue(of(CALDAV));

    const fixture = await render();

    expect(text(fixture)).toContain('Conectado · CalDAV');
    expect(text(fixture)).toContain('desde el');
    expect(button(fixture, 'Desconectar')).toBeDefined();
  });

  it('says a Google calendar is connected, by its own name', async () => {
    service.calendar.mockReturnValue(of(GOOGLE));

    const fixture = await render();

    expect(text(fixture)).toContain('Conectado · Google Calendar');
  });

  it('never shows a credential of any kind', async () => {
    service.calendar.mockReturnValue(of(CALDAV));

    const fixture = await render();

    const shown = text(fixture);
    expect(shown).not.toContain('contraseña');
    expect(shown).not.toContain('Contraseña');
    expect(shown).not.toContain('http');
  });

  it('connects a CalDAV calendar from the form', async () => {
    const fixture = await render();
    const component = fixture.componentInstance as unknown as {
      form: { setValue: (v: Record<string, string>) => void };
      connectCalDav: () => Promise<void>;
    };
    component.form.setValue({ serverUrl: 'https://cal.example.test/dav/', username: 'sergio', password: 'secreto' });

    await component.connectCalDav();
    fixture.detectChanges();

    expect(service.connectCalDavCalendar).toHaveBeenCalledWith('https://cal.example.test/dav/', 'sergio', 'secreto');
    expect(notifications.success).toHaveBeenCalledWith('Calendario conectado');
    expect(text(fixture)).toContain('Conectado · CalDAV');
  });

  /** specs/calendar-integration "Credentials the calendar rejects" - the server's message, in Spanish. */
  it('shows the server message when the connection is refused, and stays unconnected', async () => {
    service.connectCalDavCalendar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { error: { message: 'El servidor ha rechazado esas credenciales. Revísalas e inténtalo de nuevo.' } },
          }),
      ),
    );
    const fixture = await render();
    const component = fixture.componentInstance as unknown as {
      form: { setValue: (v: Record<string, string>) => void };
      connectCalDav: () => Promise<void>;
    };
    component.form.setValue({ serverUrl: 'https://cal.example.test/dav/', username: 'sergio', password: 'mala' });

    await component.connectCalDav();
    fixture.detectChanges();

    expect(text(fixture)).toContain('El servidor ha rechazado esas credenciales');
    expect(text(fixture)).toContain('Sin conectar');
  });

  /** specs/calendar-integration "Disconnecting from the web app". */
  it('disconnects and offers to connect one again', async () => {
    service.calendar.mockReturnValue(of(CALDAV));
    const fixture = await render();
    confirm.mockImplementation((options: { accept: () => void }) => options.accept());

    button(fixture, 'Desconectar')?.click();
    await flush();
    fixture.detectChanges();

    expect(service.disconnectCalendar).toHaveBeenCalled();
    expect(text(fixture)).toContain('Sin conectar');
    expect(button(fixture, 'Conectar')).toBeDefined();
  });

  /** specs/calendar-integration "Authorization refused". */
  it('reports a Google authorization the user did not grant, and stores nothing', async () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: convertToParamMap({ error: 'access_denied' }) } },
    });

    const fixture = await render();

    expect(text(fixture)).toContain('No se ha completado la autorización con Google');
    expect(service.connectGoogleCalendar).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('Sin conectar');
  });

  it('finishes the Google flow when the user comes back with a code', async () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: convertToParamMap({ code: 'code-from-google', state: 'abc' }) } },
    });

    const fixture = await render();

    expect(service.connectGoogleCalendar).toHaveBeenCalledWith('code-from-google', 'abc');
    expect(text(fixture)).toContain('Conectado · Google Calendar');
  });
});
