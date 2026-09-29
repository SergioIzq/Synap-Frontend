import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ReminderService } from '../../../core/services/api/reminder.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Reminder } from '../../../core/models';
import { NoteRemindersComponent } from './note-reminders.component';

const reminder = (id: string, text: string, dueAt: string, extra: Partial<Reminder> = {}): Reminder => ({
  id,
  text,
  dueAt,
  recurrence: null,
  noteId: 'n1',
  noteTitle: 'Volúmenes de Docker',
  ...extra,
});

const SOON = new Date(Date.now() + 86_400_000).toISOString();
const LATER = new Date(Date.now() + 3 * 86_400_000).toISOString();

describe('NoteRemindersComponent', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  async function render(noteId = 'n1') {
    const fixture = TestBed.createComponent(NoteRemindersComponent);
    fixture.componentRef.setInput('noteId', noteId);
    fixture.detectChanges();
    // Two cycles: the effect that loads the note's reminders runs after the first one.
    await fixture.whenStable();
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
    [...el(fixture).querySelectorAll('li .text')].map((p) => p.textContent?.trim());
  const button = (fixture: Awaited<ReturnType<typeof render>>, label: string, index = 0) =>
    [...el(fixture).querySelectorAll<HTMLButtonElement>('button')].filter(
      (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
    )[index];

  beforeEach(() => {
    service = {
      list: vi.fn(() => of({ reminders: [], telegramConnected: true, maxTextLength: 500 })),
      forNote: vi.fn(() => of([reminder('r1', 'Primero', SOON)])),
      create: vi.fn((input: { text: string; dueAtUtc: string; noteId?: string | null }) =>
        of(reminder('r2', input.text, input.dueAtUtc, { noteId: input.noteId ?? null })),
      ),
      update: vi.fn(() => of(undefined)),
      cancel: vi.fn(() => of(undefined)),
      telegramStatus: vi.fn(() => of({ connected: true, timezone: 'Europe/Madrid' })),
      startTelegramLink: vi.fn(),
      disconnectTelegram: vi.fn(() => of(undefined)),
    };
    notifications = { success: vi.fn(), error: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ReminderService, useValue: service },
        { provide: NotificationService, useValue: notifications },
      ],
    });
  });

  it("lists that note's reminders", async () => {
    const fixture = await render();

    expect(service['forNote']).toHaveBeenCalledWith('n1');
    expect(texts(fixture)).toEqual(['Primero']);
  });

  it('says so when the note has none', async () => {
    service['forNote'] = vi.fn(() => of([]));
    const fixture = await render();

    expect(el(fixture).textContent).toContain('Ninguno en esta nota');
  });

  it('adds a second reminder to a note that already has one', async () => {
    const fixture = await render();
    button(fixture, 'Añadir recordatorio').click();
    fixture.detectChanges();

    const text = el(fixture).querySelector<HTMLInputElement>('input[aria-label="Texto del recordatorio"]')!;
    text.value = 'Segundo';
    text.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    button(fixture, 'Añadir recordatorio').click();
    await settle(fixture);

    // A note can hold more than one at a time (specs/reminders).
    expect(service['create'].mock.calls[0][0].noteId).toBe('n1');
    // Both are listed, soonest first - the form defaults to 09:00 tomorrow.
    expect(texts(fixture)).toHaveLength(2);
    expect(texts(fixture)).toContain('Primero');
    expect(texts(fixture)).toContain('Segundo');
  });

  it('cancels a reminder from the note', async () => {
    const fixture = await render();

    button(fixture, 'Cancelar recordatorio').click();
    await settle(fixture);

    expect(service['cancel']).toHaveBeenCalledWith('r1');
    expect(texts(fixture)).toEqual([]);
  });

  it('warns when the note has reminders and Telegram is not connected', async () => {
    service['telegramStatus'] = vi.fn(() => of({ connected: false, timezone: null }));
    const fixture = await render();

    expect(el(fixture).textContent).toContain('No llegarán hasta que conectes Telegram');
  });

  it('shows a recurring reminder with how it repeats', async () => {
    service['forNote'] = vi.fn(() => of([reminder('r1', 'Revisar copias', LATER, { recurrence: 'weekly:0' })]));
    const fixture = await render();

    expect(el(fixture).querySelector('li .meta')?.textContent).toContain('Todos los lunes');
  });
});
