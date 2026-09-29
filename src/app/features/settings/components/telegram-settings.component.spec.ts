import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ReminderService } from '../../../core/services/api/reminder.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TelegramSettingsComponent } from './telegram-settings.component';

describe('TelegramSettingsComponent', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let confirm: ReturnType<typeof vi.fn>;
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  async function render() {
    const fixture = TestBed.createComponent(TelegramSettingsComponent);
    fixture.detectChanges();
    // The status load in ngOnInit is a promise chain: let the microtask queue drain first.
    await flush();
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: Awaited<ReturnType<typeof render>>) {
    await flush();
    fixture.detectChanges();
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  const el = (fixture: Awaited<ReturnType<typeof render>>) => fixture.nativeElement as HTMLElement;
  const button = (fixture: Awaited<ReturnType<typeof render>>, label: string) =>
    [...el(fixture).querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
    );

  beforeEach(() => {
    service = {
      list: vi.fn(() => of({ reminders: [], telegramConnected: false, maxTextLength: 500 })),
      forNote: vi.fn(() => of([])),
      create: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
      telegramStatus: vi.fn(() => of({ connected: false, timezone: null })),
      startTelegramLink: vi.fn(() =>
        of({ code: 'ABC123', botUsername: 'SynapBot', expiresAtUtc: '2026-09-29T12:15:00Z' }),
      ),
      disconnectTelegram: vi.fn(() => of(undefined)),
    };
    confirm = vi.fn();
    notifications = { success: vi.fn(), error: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: ReminderService, useValue: service },
        { provide: ConfirmationService, useValue: { confirm } },
        { provide: NotificationService, useValue: notifications },
      ],
    });
  });

  it('shows the disconnected state with a way to connect', async () => {
    const fixture = await render();

    expect(el(fixture).textContent).toContain('Sin conectar');
    expect(button(fixture, 'Conectar Telegram')).toBeTruthy();
    expect(button(fixture, 'Desconectar')).toBeFalsy();
  });

  it('shows the code and the bot username once a link is started', async () => {
    const fixture = await render();

    button(fixture, 'Conectar Telegram')!.click();
    await settle(fixture);

    expect(el(fixture).textContent).toContain('@SynapBot');
    expect(el(fixture).textContent).toContain('/start ABC123');
    expect(el(fixture).textContent).toContain('caduca en 15 minutos');
  });

  it('says the message has not arrived when the status is still disconnected', async () => {
    const fixture = await render();
    button(fixture, 'Conectar Telegram')!.click();
    await settle(fixture);

    button(fixture, 'Ya lo he enviado')!.click();
    await settle(fixture);

    expect(el(fixture).textContent).toContain('Todavía no me ha llegado tu mensaje');
  });

  it('switches to the connected state once the chat is linked', async () => {
    const fixture = await render();
    button(fixture, 'Conectar Telegram')!.click();
    await settle(fixture);

    service['telegramStatus'] = vi.fn(() => of({ connected: true, timezone: 'Europe/Madrid' }));
    button(fixture, 'Ya lo he enviado')!.click();
    await settle(fixture);

    expect(el(fixture).textContent).toContain('Conectado');
    expect(el(fixture).textContent).toContain('llegan a este chat');
    expect(notifications.success).toHaveBeenCalled();
  });

  it('shows the connected state from the start when already linked', async () => {
    service['telegramStatus'] = vi.fn(() => of({ connected: true, timezone: 'Europe/Madrid' }));
    const fixture = await render();

    expect(el(fixture).textContent).toContain('Conectado');
    expect(button(fixture, 'Desconectar')).toBeTruthy();
    expect(button(fixture, 'Conectar Telegram')).toBeFalsy();
  });

  it('asks before disconnecting and goes back to the disconnected state', async () => {
    service['telegramStatus'] = vi.fn(() => of({ connected: true, timezone: 'Europe/Madrid' }));
    const fixture = await render();

    button(fixture, 'Desconectar')!.click();
    await settle(fixture);
    expect(confirm).toHaveBeenCalled();
    expect(service['disconnectTelegram']).not.toHaveBeenCalled();

    confirm.mock.calls[0][0].accept();
    await settle(fixture);

    expect(service['disconnectTelegram']).toHaveBeenCalled();
    expect(el(fixture).textContent).toContain('Sin conectar');
  });

  it('can generate a fresh code when the first one expires', async () => {
    const fixture = await render();
    button(fixture, 'Conectar Telegram')!.click();
    await settle(fixture);

    service['startTelegramLink'] = vi.fn(() =>
      of({ code: 'NEW999', botUsername: 'SynapBot', expiresAtUtc: '2026-09-29T12:45:00Z' }),
    );
    button(fixture, 'Generar otro código')!.click();
    await settle(fixture);

    expect(el(fixture).textContent).toContain('/start NEW999');
  });
});
