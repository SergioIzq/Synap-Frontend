import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Reminder, ReminderInput, WEEKDAYS } from '../../../core/models';
import { localInputToUtcIso, utcIsoToLocalInput } from '../../../core/utils/dates';

/** The recurrence options offered, in the server's own vocabulary (specs/reminders). */
interface RecurrenceOption {
  label: string;
  value: string | null;
}

/**
 * Creates or edits one reminder: the text, the moment and how it repeats. Used by the
 * "Recordatorios" page and by the selector on a note, so both get the same options and the same
 * client-side checks.
 */
@Component({
  selector: 'app-reminder-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ButtonModule, FormsModule, InputTextModule, SelectModule],
  styles: [`
    form { display: flex; flex-direction: column; gap: 0.6rem; }

    .row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .row > * { flex: 1; min-width: 11rem; }

    input, p-select { width: 100%; }

    .char-count {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
      text-align: right;
    }

    .buttons { display: flex; gap: 0.5rem; justify-content: flex-end; }

    .field-error { margin: 0; font-size: 0.8rem; color: var(--p-red-500, #ef4444); }
  `],
  template: `
    <form (submit)="$event.preventDefault(); submit()">
      <div>
        <input
          pInputText
          [value]="text()"
          (input)="text.set($any($event.target).value)"
          [attr.maxlength]="maxTextLength()"
          placeholder="Ej.: Renovar el certificado SSL"
          aria-label="Texto del recordatorio"
        />
        <small class="char-count">{{ text().length }}/{{ maxTextLength() }}</small>
      </div>

      <div class="row">
        <input
          type="datetime-local"
          pInputText
          [value]="moment()"
          (input)="moment.set($any($event.target).value)"
          aria-label="Fecha y hora"
        />
        <p-select
          [options]="recurrenceOptions"
          [ngModel]="recurrence()"
          (ngModelChange)="recurrence.set($event)"
          [ngModelOptions]="{ standalone: true }"
          optionLabel="label"
          optionValue="value"
          ariaLabel="Repetición"
        />
      </div>

      @if (validationError()) {
        <p class="field-error">{{ validationError() }}</p>
      }

      <div class="buttons">
        @if (editing()) {
          <p-button label="Cancelar" size="small" severity="secondary" [text]="true" (onClick)="cancelled.emit()" />
        }
        <p-button
          type="submit"
          size="small"
          [icon]="editing() ? 'pi pi-check' : 'pi pi-plus'"
          [label]="editing() ? 'Guardar' : 'Añadir recordatorio'"
          [disabled]="!canSubmit() || saving()"
        />
      </div>
    </form>
  `,
})
export class ReminderFormComponent {
  /** The reminder being edited, or null to create a new one. */
  readonly reminder = input<Reminder | null>(null);
  readonly maxTextLength = input(500);
  readonly saving = input(false);

  readonly saved = output<ReminderInput>();
  readonly cancelled = output<void>();

  protected readonly recurrenceOptions: RecurrenceOption[] = [
    { label: 'Una vez', value: null },
    { label: 'Todos los días', value: 'daily' },
    ...WEEKDAYS.map((day, index) => ({ label: `Todos los ${day}`, value: `weekly:${index}` })),
    // Only up to 28: the later days don't exist in every month (specs/reminders).
    ...Array.from({ length: 28 }, (_, i) => ({ label: `El día ${i + 1} de cada mes`, value: `monthly:${i + 1}` })),
  ];

  protected readonly text = signal('');
  protected readonly moment = signal('');
  protected readonly recurrence = signal<string | null>(null);

  protected readonly editing = computed(() => this.reminder() !== null);

  protected readonly validationError = computed(() => {
    if (!this.moment()) {
      return null;
    }

    // Checked here as well as server-side, so the user is told before a round trip.
    return new Date(this.moment()).getTime() <= Date.now() ? 'El momento tiene que estar en el futuro.' : null;
  });

  protected readonly canSubmit = computed(
    () => this.text().trim().length > 0 && this.moment().length > 0 && this.validationError() === null,
  );

  constructor() {
    // Fills the form from the reminder being edited, and blanks it again for a new one.
    effect(() => {
      const reminder = this.reminder();
      this.text.set(reminder?.text ?? '');
      this.moment.set(reminder ? utcIsoToLocalInput(reminder.dueAt) : defaultMoment());
      this.recurrence.set(reminder?.recurrence ?? null);
    });
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      return;
    }

    this.saved.emit({
      text: this.text().trim(),
      dueAtUtc: localInputToUtcIso(this.moment()),
      recurrence: this.recurrence(),
      noteId: this.reminder()?.noteId ?? null,
    });
  }

  /** Resets to a blank form after a successful create. */
  reset(): void {
    this.text.set('');
    this.moment.set(defaultMoment());
    this.recurrence.set(null);
  }
}

/** 09:00 tomorrow, the same default the assistant uses for a day with no time. */
function defaultMoment(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return utcIsoToLocalInput(tomorrow.toISOString());
}
