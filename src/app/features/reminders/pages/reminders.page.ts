import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { NotificationService } from '../../../core/services/notification.service';
import { Reminder, ReminderInput, describeRecurrence } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/dates';
import { isHandledGlobally } from '../../../core/utils/http-errors';
import { ReminderFormComponent } from '../components/reminder-form.component';
import { RemindersStore } from '../store/reminders.store';

/**
 * The "Recordatorios" section (specs/reminders "Managing reminders from the web app"): everything
 * pending, soonest first, with its moment in the browser's own timezone.
 */
@Component({
  selector: 'app-reminders-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ButtonModule, MessageModule, ReminderFormComponent, RouterLink, SkeletonModule],
  styles: [`
    .page { max-width: 46rem; margin: 0 auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }

    h2 { margin: 0; font-size: 1.35rem; }

    .intro { margin: 0; font-size: 0.875rem; color: var(--p-text-muted-color); }

    .card {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius, 6px);
      padding: 1rem;
      background: var(--p-content-background);
    }

    .reminders { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }

    .reminder {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.7rem 0.85rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius, 6px);
      background: var(--synap-page-bg);

      .body { flex: 1; min-width: 0; }
      .text { margin: 0; font-size: 0.95rem; line-height: 1.45; overflow-wrap: anywhere; }
      .meta { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.25rem; font-size: 0.78rem; color: var(--p-text-muted-color); }
      .buttons { display: flex; flex-shrink: 0; }
    }

    .empty { margin: 0; font-size: 0.875rem; color: var(--p-text-muted-color); }
  `],
  template: `
    <div class="page">
      <div>
        <h2>Recordatorios</h2>
        <p class="intro">Synap te avisa por Telegram en el momento que le digas.</p>
      </div>

      @if (store.undeliverable()) {
        <p-message severity="warn" styleClass="w-full">
          <span>
            Tienes recordatorios pendientes, pero no llegarán hasta que conectes Telegram.
            <a routerLink="/app/settings">Conectar Telegram</a>
          </span>
        </p-message>
      }

      @if (store.error(); as error) {
        <p-message severity="error" styleClass="w-full">
          <span>{{ error }}</span>
        </p-message>
      }

      <div class="card">
        <app-reminder-form
          #form
          [maxTextLength]="store.maxTextLength()"
          [saving]="store.saving()"
          (saved)="create($event)"
        />
      </div>

      @if (store.loading() && !store.loaded()) {
        <p-skeleton height="3.5rem" />
        <p-skeleton height="3.5rem" />
      } @else if (store.reminders().length === 0) {
        <p class="empty">No tienes recordatorios pendientes. Crea uno arriba o pídeselo al asistente.</p>
      } @else {
        <ul class="reminders">
          @for (reminder of store.reminders(); track reminder.id) {
            <li class="reminder">
              @if (editingId() === reminder.id) {
                <div class="body">
                  <app-reminder-form
                    [reminder]="reminder"
                    [maxTextLength]="store.maxTextLength()"
                    [saving]="store.saving()"
                    (saved)="save(reminder, $event)"
                    (cancelled)="editingId.set(null)"
                  />
                </div>
              } @else {
                <div class="body">
                  <p class="text">{{ reminder.text }}</p>
                  <div class="meta">
                    <span>{{ formatDate(reminder.dueAt) }}</span>
                    @if (reminder.recurrence) {
                      <span>{{ describe(reminder.recurrence) }}</span>
                    }
                    @if (reminder.noteId) {
                      <a [routerLink]="['/app/notes', reminder.noteId]">{{ reminder.noteTitle || 'Ver la nota' }}</a>
                    }
                  </div>
                </div>
                <div class="buttons">
                  <p-button
                    icon="pi pi-pencil"
                    size="small"
                    severity="secondary"
                    [text]="true"
                    [rounded]="true"
                    ariaLabel="Editar recordatorio"
                    [disabled]="store.saving()"
                    (onClick)="editingId.set(reminder.id)"
                  />
                  <p-button
                    icon="pi pi-trash"
                    size="small"
                    severity="danger"
                    [text]="true"
                    [rounded]="true"
                    ariaLabel="Cancelar recordatorio"
                    [disabled]="store.saving()"
                    (onClick)="confirmCancel(reminder)"
                  />
                </div>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class RemindersPage implements OnInit {
  protected readonly store = inject(RemindersStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notifications = inject(NotificationService);

  private readonly form = viewChild<ReminderFormComponent>('form');

  protected readonly editingId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    // Loaded on entry rather than trusting a cached value: after a logout/login on the same
    // device the cache would belong to the previous user.
    await this.store.load();
  }

  protected async create(input: ReminderInput): Promise<void> {
    await this.run(async () => {
      await this.store.create(input);
      this.form()?.reset();
      this.notifications.success('Recordatorio creado');
    });
  }

  protected async save(reminder: Reminder, input: ReminderInput): Promise<void> {
    await this.run(async () => {
      await this.store.update(reminder.id, input);
      this.editingId.set(null);
    });
  }

  protected confirmCancel(reminder: Reminder): void {
    this.confirmationService.confirm({
      header: 'Cancelar recordatorio',
      message: `No volverás a recibir "${reminder.text}". ¿Continuar?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Cancelar recordatorio',
      rejectLabel: 'Volver',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => void this.cancel(reminder),
    });
  }

  private async cancel(reminder: Reminder): Promise<void> {
    await this.run(() => this.store.cancel(reminder.id));
  }

  protected formatDate(value: string): string {
    return formatDateTime(value);
  }

  protected describe(recurrence: string): string {
    return describeRecurrence(recurrence);
  }

  /** Network and 5xx failures are already announced by errorInterceptor. */
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
