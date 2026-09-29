import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { NotificationService } from '../../../core/services/notification.service';
import { Reminder, ReminderInput, describeRecurrence } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/dates';
import { isHandledGlobally } from '../../../core/utils/http-errors';
import { ReminderFormComponent } from './reminder-form.component';
import { RemindersStore } from '../store/reminders.store';

/**
 * The reminders on one note, shown on the note itself (specs/reminders "Reminders created from a
 * note"). A note can hold more than one at a time, so this lists them all and always offers to add
 * another.
 */
@Component({
  selector: 'app-note-reminders',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ButtonModule, ReminderFormComponent, RouterLink],
  styles: [`
    section {
      margin-top: 1.25rem;
      padding: 1rem 1.15rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius-lg, 10px);
      background: var(--p-content-background);
    }

    h3 { margin: 0 0 0.6rem; font-size: 0.95rem; }

    ul { list-style: none; margin: 0 0 0.75rem; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }

    li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;

      .body { flex: 1; min-width: 0; }
      .text { margin: 0; overflow-wrap: anywhere; }
      .meta { display: block; margin-top: 0.1rem; font-size: 0.75rem; color: var(--p-text-muted-color); }
    }

    .empty { margin: 0 0 0.75rem; font-size: 0.8rem; color: var(--p-text-muted-color); }

    .warning { margin: 0 0 0.75rem; font-size: 0.8rem; color: var(--p-text-muted-color); }
  `],
  template: `
    <section>
      <h3>Recordatorios</h3>

      @if (reminders().length === 0) {
        <p class="empty">Ninguno en esta nota.</p>
      } @else {
        <ul>
          @for (reminder of reminders(); track reminder.id) {
            <li>
              <div class="body">
                <p class="text">{{ reminder.text }}</p>
                <small class="meta">
                  {{ formatDate(reminder.dueAt) }}
                  @if (reminder.recurrence) {
                    · {{ describe(reminder.recurrence) }}
                  }
                </small>
              </div>
              <p-button
                icon="pi pi-trash"
                size="small"
                severity="danger"
                [text]="true"
                [rounded]="true"
                ariaLabel="Cancelar recordatorio"
                [disabled]="store.saving()"
                (onClick)="cancel(reminder)"
              />
            </li>
          }
        </ul>
      }

      @if (adding()) {
        <app-reminder-form
          [maxTextLength]="store.maxTextLength()"
          [saving]="store.saving()"
          (saved)="create($event)"
          (cancelled)="adding.set(false)"
        />
      } @else {
        <p-button
          icon="pi pi-bell"
          label="Añadir recordatorio"
          size="small"
          severity="secondary"
          [text]="true"
          (onClick)="adding.set(true)"
        />
      }

      @if (reminders().length > 0 && !store.telegramConnected()) {
        <p class="warning">
          No llegarán hasta que conectes Telegram en <a routerLink="/app/settings">Configuración</a>.
        </p>
      }
    </section>
  `,
})
export class NoteRemindersComponent {
  readonly noteId = input.required<string>();

  protected readonly store = inject(RemindersStore);
  private readonly notifications = inject(NotificationService);

  protected readonly reminders = signal<Reminder[]>([]);
  protected readonly adding = signal(false);

  constructor() {
    effect(() => {
      const noteId = this.noteId();
      void this.load(noteId);
    });
  }

  private async load(noteId: string): Promise<void> {
    try {
      this.reminders.set(await this.store.forNote(noteId));
      // Only for the "connect Telegram" warning; the list itself is the note's own.
      if (!this.store.loaded()) {
        await this.store.refreshTelegram();
      }
    } catch (err) {
      if (!isHandledGlobally(err)) {
        this.reminders.set([]);
      }
    }
  }

  protected async create(input: ReminderInput): Promise<void> {
    await this.run(async () => {
      const created = await this.store.create({ ...input, noteId: this.noteId() });
      // A note can hold several: the new one joins the list rather than replacing it.
      this.reminders.update((reminders) => [...reminders, created].sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
      this.adding.set(false);
      this.notifications.success('Recordatorio creado');
    });
  }

  protected async cancel(reminder: Reminder): Promise<void> {
    await this.run(async () => {
      await this.store.cancel(reminder.id);
      this.reminders.update((reminders) => reminders.filter((r) => r.id !== reminder.id));
    });
  }

  protected formatDate(value: string): string {
    return formatDateTime(value);
  }

  protected describe(recurrence: string): string {
    return describeRecurrence(recurrence);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (err) {
      if (!isHandledGlobally(err)) {
        this.notifications.error('Error', err instanceof Error ? err.message : 'No se pudo completar la acción.');
      }
    }
  }
}
