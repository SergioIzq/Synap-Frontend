import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsStore } from '../store/settings.store';

const DEFAULT_HOUR = 8;

/**
 * Settings > Briefing: the morning summary and the hour it arrives (specs/briefing "The briefing
 * is off until the user turns it on"). It travels over the same Telegram chat as the reminders,
 * which is why a user without one is told here - that is the only part of a briefing not arriving
 * that they can fix themselves (daily-briefing design.md Decision 6).
 */
@Component({
  selector: 'app-briefing-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormsModule, ButtonModule, MessageModule, SelectModule, SkeletonModule, ToggleSwitchModule],
  styles: [`
    .intro { margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--p-text-muted-color); }

    .row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

    .row + .row { margin-top: 0.9rem; }

    label { font-size: 0.875rem; }

    .contents { margin: 0.9rem 0 0; padding-left: 1.1rem; font-size: 0.8125rem; line-height: 1.7; color: var(--p-text-muted-color); }

    .buttons { display: flex; gap: 0.5rem; margin-top: 1rem; }

    .warning { margin-top: 0.9rem; }
  `],
  template: `
    @if (store.loading()) {
      <p-skeleton height="2.5rem" />
    } @else {
      <p class="intro">Cada mañana, por Telegram, un resumen de lo que tienes ese día.</p>

      <div class="row">
        <p-toggleswitch
          inputId="briefing-enabled"
          [(ngModel)]="enabled"
          [disabled]="store.saving()"
          (onChange)="toggle($event.checked)"
          ariaLabel="Recibir el briefing cada mañana"
        />
        <label for="briefing-enabled">Recibirlo cada mañana</label>
      </div>

      @if (enabled()) {
        <div class="row">
          <label for="briefing-hour">A las</label>
          <p-select
            inputId="briefing-hour"
            [options]="hours"
            [(ngModel)]="hour"
            [disabled]="store.saving()"
            (onChange)="changeHour($event.value)"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
          />
          <span class="hint">hora local</span>
        </div>
      }

      <ul class="contents">
        <li>Los recordatorios que vencen ese día.</li>
        <li>Las notas recientes que se quedaron sin etiquetar.</li>
        <li>Las notas con algo sin cerrar: «pendiente», «revisar», «TODO».</li>
      </ul>

      @if (enabled() && !canBeDelivered()) {
        <p-message class="warning" severity="warn" size="small">
          Conecta Telegram aquí abajo: el briefing se envía por ahí y, hasta entonces, no te llegará.
        </p-message>
      }

      <div class="buttons">
        <p-button
          label="Enviármelo ahora"
          icon="pi pi-send"
          size="small"
          severity="secondary"
          [outlined]="true"
          [disabled]="store.saving()"
          (onClick)="sendNow()"
        />
      </div>

      @if (error(); as message) {
        <p-message class="warning" severity="error" size="small">{{ message }}</p-message>
      }
    }
  `,
})
export class BriefingSettingsComponent {
  readonly store = inject(SettingsStore);
  private readonly notifications = inject(NotificationService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected readonly error = signal<string | null>(null);

  // Two-way bound, and linkedSignal rather than computed, for one reason: a save that fails has
  // to put the control back where it was. With a one-way binding the signal would end on the
  // value it started at, Angular would see no change, and the switch would sit there showing the
  // opposite of what is stored.
  protected readonly enabled = linkedSignal(() => this.store.briefing()?.enabled ?? false);
  protected readonly hour = linkedSignal(() => this.store.briefing()?.hour ?? DEFAULT_HOUR);
  protected readonly canBeDelivered = computed(() => this.store.briefing()?.canBeDelivered ?? false);

  protected readonly hours = Array.from({ length: 24 }, (_, h) => ({
    label: `${h.toString().padStart(2, '0')}:00`,
    value: h,
  }));

  // The new value comes from the event, not from the signal: PrimeNG emits onChange before
  // ngModel has written it, so reading the signal here would give the value before the click.
  protected async toggle(enabled: boolean): Promise<void> {
    this.settle(this.enabled, enabled);
    // Turning it on for the first time needs an hour; the server keeps whatever was chosen before.
    if (!await this.save(enabled, enabled ? this.hour() : null)) {
      this.enabled.set(this.store.briefing()?.enabled ?? false);
    }
  }

  protected async changeHour(hour: number): Promise<void> {
    this.settle(this.hour, hour);
    if (!await this.save(true, hour)) {
      this.hour.set(this.store.briefing()?.hour ?? DEFAULT_HOUR);
    }
  }

  /**
   * Puts the new value into the binding and runs change detection over it, before the save that
   * may undo it. Without this the signal would leave and come back to the same value within one
   * round of detection, Angular would see no change, and the control would be left showing the
   * opposite of what is stored.
   */
  private settle<T>(target: { set(value: T): void }, value: T): void {
    target.set(value);
    this.changeDetector.detectChanges();
  }

  protected async sendNow(): Promise<void> {
    this.error.set(null);
    try {
      await this.store.sendBriefingNow();
      this.notifications.success('Briefing enviado a tu Telegram.');
    } catch (err) {
      this.error.set(message(err, 'No se pudo enviar el briefing.'));
    }
  }

  /** False when it did not save, so the caller puts the control back where it was.</summary> */
  private async save(enabled: boolean, hour: number | null): Promise<boolean> {
    this.error.set(null);
    try {
      await this.store.setBriefing(enabled, hour);
      return true;
    } catch (err) {
      this.error.set(message(err, 'No se pudo guardar el briefing.'));
      return false;
    }
  }
}

function message(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
