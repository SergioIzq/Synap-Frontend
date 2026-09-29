import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ReminderService } from '../../../core/services/api/reminder.service';
import { Reminder, ReminderInput, TelegramLinkInstructions } from '../../../core/models';
import { apiErrorMessage } from '../../../core/utils/http-errors';

/**
 * Plain signals, same shape as the other stores (see AuthStore's comment). Root-provided because
 * both the "Recordatorios" page and the selector on a note read from it. Pages call `load()` on
 * entry rather than trusting a cached value: after a logout/login on the same device the cache
 * would belong to the previous user.
 */
@Injectable({ providedIn: 'root' })
export class RemindersStore {
  private readonly reminderService = inject(ReminderService);

  private readonly _reminders = signal<Reminder[]>([]);
  private readonly _telegramConnected = signal(false);
  private readonly _maxTextLength = signal(500);
  private readonly _loaded = signal(false);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly reminders = this._reminders.asReadonly();
  readonly telegramConnected = this._telegramConnected.asReadonly();
  readonly maxTextLength = this._maxTextLength.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  /** specs/reminders "No chat linked": pending reminders that cannot be delivered yet. */
  readonly undeliverable = computed(() => !this._telegramConnected() && this._reminders().length > 0);

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const list = await firstValueFrom(this.reminderService.list());
      this._reminders.set(list.reminders);
      this._telegramConnected.set(list.telegramConnected);
      this._maxTextLength.set(list.maxTextLength);
      this._loaded.set(true);
    } catch (err) {
      this._error.set(apiErrorMessage(err, 'No se pudieron cargar tus recordatorios.'));
    } finally {
      this._loading.set(false);
    }
  }

  /** Throws with a user-facing message on failure, so the form can show it in place. */
  async create(input: ReminderInput): Promise<Reminder> {
    return await this.mutate(async () => {
      const created = await firstValueFrom(this.reminderService.create(input));
      this._reminders.update((reminders) => sortByDueAt([...reminders, created]));
      return created;
    }, 'No se pudo crear el recordatorio.');
  }

  async update(id: string, input: ReminderInput): Promise<void> {
    await this.mutate(async () => {
      await firstValueFrom(this.reminderService.update(id, input));
      this._reminders.update((reminders) =>
        sortByDueAt(
          reminders.map((reminder) =>
            reminder.id === id
              ? { ...reminder, text: input.text, dueAt: input.dueAtUtc, recurrence: input.recurrence ?? null }
              : reminder,
          ),
        ),
      );
    }, 'No se pudo guardar el recordatorio.');
  }

  async cancel(id: string): Promise<void> {
    await this.mutate(async () => {
      await firstValueFrom(this.reminderService.cancel(id));
      this._reminders.update((reminders) => reminders.filter((reminder) => reminder.id !== id));
    }, 'No se pudo cancelar el recordatorio.');
  }

  /** The reminders on one note, for the selector shown there; not kept in the store's own list. */
  async forNote(noteId: string): Promise<Reminder[]> {
    return await firstValueFrom(this.reminderService.forNote(noteId));
  }

  // ---- Telegram ----

  async refreshTelegram(): Promise<void> {
    const status = await firstValueFrom(this.reminderService.telegramStatus());
    this._telegramConnected.set(status.connected);
  }

  async startTelegramLink(): Promise<TelegramLinkInstructions> {
    return await this.mutate(
      () => firstValueFrom(this.reminderService.startTelegramLink()),
      'No se pudo generar el código de conexión.',
    );
  }

  async disconnectTelegram(): Promise<void> {
    await this.mutate(async () => {
      await firstValueFrom(this.reminderService.disconnectTelegram());
      this._telegramConnected.set(false);
    }, 'No se pudo desconectar Telegram.');
  }

  private async mutate<T>(request: () => Promise<T>, fallback: string): Promise<T> {
    this._saving.set(true);
    try {
      return await request();
    } catch (err) {
      throw new Error(apiErrorMessage(err, fallback));
    } finally {
      this._saving.set(false);
    }
  }
}

/** Soonest first, like the server's own ordering, so a new or edited reminder lands in place. */
function sortByDueAt(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
