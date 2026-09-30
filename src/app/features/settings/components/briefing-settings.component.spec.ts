import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SettingsService } from '../../../core/services/api/settings.service';
import { NotificationService } from '../../../core/services/notification.service';
import { BriefingSettings, UserSettings } from '../../../core/models';
import { SettingsStore } from '../store/settings.store';
import { BriefingSettingsComponent } from './briefing-settings.component';

/** daily-briefing tasks 6.1 and 6.2 - specs/briefing, the settings surface. */
describe('BriefingSettingsComponent', () => {
  let service: { get: ReturnType<typeof vi.fn>; setBriefing: ReturnType<typeof vi.fn>; sendBriefingNow: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  const settings = (briefing: BriefingSettings): UserSettings => ({
    email: 'me@example.com',
    ai: { hasGroqKey: true, groqKeyMasked: 'gsk_…aaaa', groqKeyUpdatedAt: null, groqModel: null, defaultGroqModel: 'default' },
    briefing,
  });

  const off: BriefingSettings = { enabled: false, hour: null, canBeDelivered: true };

  async function render(briefing: BriefingSettings = off) {
    service.get.mockReturnValue(of(settings(briefing)));
    const store = TestBed.inject(SettingsStore);
    await store.load();

    const fixture = TestBed.createComponent(BriefingSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: Awaited<ReturnType<typeof render>>) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = (fixture: Awaited<ReturnType<typeof render>>) => fixture.nativeElement as HTMLElement;

  const toggle = (fixture: Awaited<ReturnType<typeof render>>) =>
    el(fixture).querySelector<HTMLInputElement>('p-toggleswitch input')!;

  const button = (fixture: Awaited<ReturnType<typeof render>>, label: string) =>
    [...el(fixture).querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(label))!;

  beforeEach(() => {
    service = {
      get: vi.fn(() => of(settings(off))),
      setBriefing: vi.fn((enabled: boolean, hour: number | null) =>
        of({ enabled, hour: enabled ? (hour ?? 8) : null, canBeDelivered: true } as BriefingSettings)),
      sendBriefingNow: vi.fn(() => of(undefined)),
    };
    notifications = { success: vi.fn(), error: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: SettingsService, useValue: service },
        { provide: NotificationService, useValue: notifications },
      ],
    });
  });

  // ---- 6.1 The setting ----

  it('shows the briefing off, with no hour, for an account that never turned it on', async () => {
    const fixture = await render();

    expect(toggle(fixture).checked).toBe(false);
    // The hour only makes sense once it is on.
    expect(el(fixture).querySelector('p-select')).toBeNull();
  });

  it('reflects the stored state when it is on', async () => {
    const fixture = await render({ enabled: true, hour: 7, canBeDelivered: true });

    expect(toggle(fixture).checked).toBe(true);
    expect(el(fixture).querySelector('p-select')).not.toBeNull();
    expect(el(fixture).textContent).toContain('07:00');
  });

  it('saves turning it on, with an hour', async () => {
    const fixture = await render();

    toggle(fixture).click();
    await settle(fixture);

    expect(service.setBriefing).toHaveBeenCalledWith(true, 8);
    expect(toggle(fixture).checked).toBe(true);
  });

  it('saves turning it off', async () => {
    const fixture = await render({ enabled: true, hour: 7, canBeDelivered: true });

    toggle(fixture).click();
    await settle(fixture);

    expect(service.setBriefing).toHaveBeenCalledWith(false, null);
  });

  it('says what the briefing will contain', async () => {
    const text = el(await render()).textContent ?? '';

    expect(text).toContain('recordatorios');
    expect(text).toContain('sin etiquetar');
    expect(text).toContain('TODO');
  });

  it('shows the error when saving fails, and leaves the switch as it was', async () => {
    service.setBriefing.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const fixture = await render();

    toggle(fixture).click();
    await settle(fixture);

    expect(el(fixture).textContent).toContain('No se pudo guardar el briefing.');
    expect(toggle(fixture).checked).toBe(false);
  });

  // ---- The button that asks for one now ----

  it('asks for the briefing now and says it went out', async () => {
    const fixture = await render();

    button(fixture, 'Enviármelo ahora').click();
    await settle(fixture);

    expect(service.sendBriefingNow).toHaveBeenCalled();
    expect(notifications.success).toHaveBeenCalled();
  });

  it('offers the button even with the briefing off, because asking is not subscribing', async () => {
    const fixture = await render();

    expect(toggle(fixture).checked).toBe(false);
    expect(button(fixture, 'Enviármelo ahora').disabled).toBe(false);
  });

  it('shows the server message when the briefing cannot be sent', async () => {
    service.sendBriefingNow.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { error: { message: 'Conecta Telegram en Configuración…' } } })),
    );
    const fixture = await render();

    button(fixture, 'Enviármelo ahora').click();
    await settle(fixture);

    expect(el(fixture).textContent).toContain('Conecta Telegram');
  });

  // ---- 6.2 The warning that only the user can act on ----

  it('warns to connect Telegram when it is on and no chat is linked', async () => {
    const fixture = await render({ enabled: true, hour: 8, canBeDelivered: false });

    expect(el(fixture).textContent).toContain('Conecta Telegram');
  });

  it('does not warn when it is on and a chat is linked', async () => {
    const fixture = await render({ enabled: true, hour: 8, canBeDelivered: true });

    expect(el(fixture).textContent).not.toContain('Conecta Telegram');
  });

  it('does not warn when the briefing is off, whatever Telegram is doing', async () => {
    const fixture = await render({ enabled: false, hour: null, canBeDelivered: false });

    expect(el(fixture).textContent).not.toContain('Conecta Telegram');
  });
});
