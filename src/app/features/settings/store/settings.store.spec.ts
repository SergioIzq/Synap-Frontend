import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SettingsService } from '../../../core/services/api/settings.service';
import { AiSettings, CalendarConnection } from '../../../core/models';
import { SettingsStore } from './settings.store';

const NO_KEY: AiSettings = {
  hasGroqKey: false,
  groqKeyMasked: null,
  groqKeyUpdatedAt: null,
  groqModel: null,
  defaultGroqModel: 'default-model',
};
const MODELS = [
  { id: 'model-a', supportsActions: true },
  { id: 'model-b', supportsActions: false },
];
const WITH_KEY: AiSettings = { ...NO_KEY, hasGroqKey: true, groqKeyMasked: 'gsk_…a1B2' };

const NO_CALENDAR: CalendarConnection = { connected: false, kind: null, connectedAt: null, googleAvailable: true };
const CALDAV_CONNECTED: CalendarConnection = {
  connected: true,
  kind: 'CalDav',
  connectedAt: '2026-10-07T09:00:00Z',
  googleAvailable: true,
};

function apiError(status: number, message?: string) {
  return new HttpErrorResponse({ status, error: message ? { error: { message } } : null });
}

describe('SettingsStore', () => {
  let service: Record<keyof SettingsService, ReturnType<typeof vi.fn>>;
  let store: SettingsStore;

  beforeEach(() => {
    service = {
      get: vi.fn(() => of({ email: 'a@b.c', ai: NO_KEY })),
      saveGroqKey: vi.fn(() => of(WITH_KEY)),
      deleteGroqKey: vi.fn(() => of(NO_KEY)),
      listModels: vi.fn(() => of(MODELS)),
      setModel: vi.fn((model: string | null) => of({ ...WITH_KEY, groqModel: model })),
      setBriefing: vi.fn(() => of({ enabled: false, hour: null, canBeDelivered: true })),
      sendBriefingNow: vi.fn(() => of(undefined)),
      calendar: vi.fn(() => of(NO_CALENDAR)),
      connectCalDavCalendar: vi.fn(() => of(CALDAV_CONNECTED)),
      beginGoogleCalendarAuthorization: vi.fn(() => of({ authorizationUrl: 'https://accounts.google.test/auth', state: 'abc' })),
      connectGoogleCalendar: vi.fn(() => of({ ...CALDAV_CONNECTED, kind: 'Google' })),
      disconnectCalendar: vi.fn(() => of(NO_CALENDAR)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: service }] });
    store = TestBed.inject(SettingsStore);
  });

  it('load() exposes settings and hasGroqKey', async () => {
    expect(store.loaded()).toBe(false);
    await store.load();
    expect(store.loaded()).toBe(true);
    expect(store.hasGroqKey()).toBe(false);
    expect(store.settings()?.email).toBe('a@b.c');
  });

  it('load() failure sets a Spanish error', async () => {
    service.get.mockReturnValue(throwError(() => apiError(500)));
    await store.load();
    expect(store.error()).toBe('No se pudo cargar tu configuración.');
  });

  it('saveGroqKey() updates hasGroqKey and loads the models', async () => {
    await store.load();
    await store.saveGroqKey('gsk_valid');
    expect(service.saveGroqKey).toHaveBeenCalledWith('gsk_valid');
    expect(store.hasGroqKey()).toBe(true);
    expect(store.models()).toEqual(MODELS);
    expect(store.saving()).toBe(false);
  });

  it('saveGroqKey() rejects with the backend message and keeps the previous state', async () => {
    await store.load();
    service.saveGroqKey.mockReturnValue(throwError(() => apiError(400, 'La API key de Groq no es válida.')));
    await expect(store.saveGroqKey('bad')).rejects.toThrow('La API key de Groq no es válida.');
    expect(store.hasGroqKey()).toBe(false);
  });

  it('deleteGroqKey() clears the key and the models', async () => {
    service.get.mockReturnValue(of({ email: 'a@b.c', ai: WITH_KEY }));
    await store.load();
    await store.loadModels();
    await store.deleteGroqKey();
    expect(store.hasGroqKey()).toBe(false);
    expect(store.models()).toEqual([]);
  });

  it('loadModels() does not call the API without a key', async () => {
    await store.load();
    await store.loadModels();
    expect(service.listModels).not.toHaveBeenCalled();
  });

  it('setModel() stores the chosen model', async () => {
    service.get.mockReturnValue(of({ email: 'a@b.c', ai: WITH_KEY }));
    await store.load();
    await store.setModel('model-b');
    expect(store.settings()?.ai.groqModel).toBe('model-b');
  });

  it('rate limiting gets its own message', async () => {
    await store.load();
    service.saveGroqKey.mockReturnValue(throwError(() => apiError(429)));
    await expect(store.saveGroqKey('k')).rejects.toThrow(/Demasiadas peticiones/);
  });

  // ---- The calendar (calendar-integration task 8.2) ----

  it('loadCalendar() exposes the connection state', async () => {
    await store.loadCalendar();
    expect(store.calendarConnected()).toBe(false);
    expect(store.calendar()).toEqual(NO_CALENDAR);
  });

  it('connectCalDavCalendar() reports it as connected, and with which form', async () => {
    await store.loadCalendar();
    await store.connectCalDavCalendar('https://cal.example.test/dav/', 'sergio', 'secreto');
    expect(service.connectCalDavCalendar).toHaveBeenCalledWith('https://cal.example.test/dav/', 'sergio', 'secreto');
    expect(store.calendarConnected()).toBe(true);
    expect(store.calendar()?.kind).toBe('CalDav');
  });

  /** specs/calendar-integration "Credentials the calendar rejects": nothing changed on the server. */
  it('a rejected connection throws and leaves the previous state untouched', async () => {
    service.calendar.mockReturnValue(of(CALDAV_CONNECTED));
    await store.loadCalendar();
    service.connectCalDavCalendar.mockReturnValue(
      throwError(() => apiError(400, 'El servidor ha rechazado esas credenciales. Revísalas e inténtalo de nuevo.')));

    await expect(store.connectCalDavCalendar('https://otro.test/', 'x', 'y')).rejects.toThrow(/rechazado esas credenciales/);
    expect(store.calendar()).toEqual(CALDAV_CONNECTED);
  });

  it('beginGoogleCalendarAuthorization() returns where to send the user and stores nothing', async () => {
    await store.loadCalendar();
    const authorization = await store.beginGoogleCalendarAuthorization();
    expect(authorization.authorizationUrl).toContain('accounts.google.test');
    expect(store.calendarConnected()).toBe(false);
  });

  it('connectGoogleCalendar() reports the Google form as connected', async () => {
    await store.loadCalendar();
    await store.connectGoogleCalendar('code-from-google', 'abc');
    expect(service.connectGoogleCalendar).toHaveBeenCalledWith('code-from-google', 'abc');
    expect(store.calendar()?.kind).toBe('Google');
  });

  it('disconnectCalendar() reports it as not connected', async () => {
    service.calendar.mockReturnValue(of(CALDAV_CONNECTED));
    await store.loadCalendar();
    await store.disconnectCalendar();
    expect(store.calendarConnected()).toBe(false);
    expect(store.calendar()?.kind).toBeNull();
  });
});
