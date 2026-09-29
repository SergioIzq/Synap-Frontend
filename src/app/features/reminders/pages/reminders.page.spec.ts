import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ReminderService } from '../../../core/services/api/reminder.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Reminder } from '../../../core/models';
import { RemindersPage } from './reminders.page';

const reminder = (id: string, text: string, dueAt: string, extra: Partial<Reminder> = {}): Reminder => ({
  id,
  text,
  dueAt,
  recurrence: null,
  noteId: null,
  noteTitle: null,
  ...extra,
});

/** Far enough ahead that the form's "must be in the future" check always passes. */
const SOON = new Date(Date.now() + 86_400_000).toISOString();
const LATER = new Date(Date.now() + 3 * 86_400_000).toISOString();

describe('RemindersPage', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let confirm: ReturnType<typeof vi.fn>;
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  function list(reminders: Reminder[], telegramConnected = true) {
    return of({ reminders, telegramConnected, maxTextLength: 500 });
  }

  async function render() {
    const fixture = TestBed.createComponent(RemindersPage);
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
  const texts = (fixture: Awaited<ReturnType<typeof render>>) =>
    [...el(fixture).querySelectorAll('.reminder .text')].map((p) => p.textContent?.trim());
  const button = (fixture: Awaited<ReturnType<typeof render>>, label: string, index = 0) =>
    [...el(fixture).querySelectorAll<HTMLButtonElement>('button')].filter(
      (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
    )[index];

  beforeEach(() => {
    service = {
      list: vi.fn(() => list([reminder('r1', 'Antes', SOON), reminder('r2', 'Más tarde', LATER)])),
      forNote: vi.fn(() => of([])),
      create: vi.fn((input: { text: string; dueAtUtc: string }) => of(reminder('r3', input.text, input.dueAtUtc))),
      update: vi.fn(() => of(undefined)),
      cancel: vi.fn(() => of(undefined)),
      telegramStatus: vi.fn(() => of({ connected: true, timezone: 'Europe/Madrid' })),
      startTelegramLink: vi.fn(),
      disconnectTelegram: vi.fn(() => of(undefined)),
    };
    confirm = vi.fn();
    notifications = { success: vi.fn(), error: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ReminderService, useValue: service },
        { provide: ConfirmationService, useValue: { confirm } },
        { provide: NotificationService, useValue: notifications },
      ],
    });
  });

  it('lists the pending reminders soonest first with their moment', async () => {
    const fixture = await render();

    expect(texts(fixture)).toEqual(['Antes', 'Más tarde']);
    expect(el(fixture).querySelector('.reminder .meta')?.textContent?.trim()).not.toBe('');
  });

  it('shows a recurrence and a linked note when there are any', async () => {
    service['list'] = vi.fn(() =>
      list([reminder('r1', 'Revisar copias', SOON, { recurrence: 'weekly:0', noteId: 'n1', noteTitle: 'Backups' })]),
    );
    const fixture = await render();

    const meta = el(fixture).querySelector('.reminder .meta')!.textContent!;
    expect(meta).toContain('Todos los lunes');
    expect(meta).toContain('Backups');
  });

  it('says so when there is nothing pending', async () => {
    service['list'] = vi.fn(() => list([]));
    const fixture = await render();

    expect(el(fixture).textContent).toContain('No tienes recordatorios pendientes');
  });

  it('warns when reminders cannot be delivered because Telegram is not connected', async () => {
    service['list'] = vi.fn(() => list([reminder('r1', 'Antes', SOON)], false));
    const fixture = await render();

    expect(el(fixture).textContent).toContain('no llegarán hasta que conectes Telegram');
  });

  it('does not warn when there is nothing pending, even without Telegram', async () => {
    service['list'] = vi.fn(() => list([], false));
    const fixture = await render();

    expect(el(fixture).textContent).not.toContain('no llegarán hasta que conectes Telegram');
  });

  it('creates a reminder from the form and adds it to the list', async () => {
    const fixture = await render();
    const text = el(fixture).querySelector<HTMLInputElement>('input[aria-label="Texto del recordatorio"]')!;
    text.value = 'Renovar el certificado SSL';
    text.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    button(fixture, 'Añadir recordatorio').click();
    await settle(fixture);

    expect(service['create']).toHaveBeenCalled();
    expect(service['create'].mock.calls[0][0].text).toBe('Renovar el certificado SSL');
    expect(texts(fixture)).toContain('Renovar el certificado SSL');
    expect(notifications.success).toHaveBeenCalled();
  });

  it('asks before cancelling and removes the reminder once confirmed', async () => {
    const fixture = await render();

    button(fixture, 'Cancelar recordatorio').click();
    await settle(fixture);

    expect(confirm).toHaveBeenCalled();
    expect(service['cancel']).not.toHaveBeenCalled();

    // Accept the confirmation the page put up.
    confirm.mock.calls[0][0].accept();
    await settle(fixture);

    expect(service['cancel']).toHaveBeenCalledWith('r1');
    expect(texts(fixture)).toEqual(['Más tarde']);
  });

  it('opens the edit form on a reminder and saves the change', async () => {
    const fixture = await render();

    button(fixture, 'Editar recordatorio').click();
    fixture.detectChanges();

    const text = el(fixture).querySelector<HTMLInputElement>('.reminder input[aria-label="Texto del recordatorio"]')!;
    expect(text.value).toBe('Antes');
    text.value = 'Renombrado';
    text.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    button(fixture, 'Guardar').click();
    await settle(fixture);

    expect(service['update']).toHaveBeenCalled();
    expect(service['update'].mock.calls[0][0]).toBe('r1');
    expect(service['update'].mock.calls[0][1].text).toBe('Renombrado');
    expect(texts(fixture)).toContain('Renombrado');
  });
});
