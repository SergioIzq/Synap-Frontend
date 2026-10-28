import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { formatDateTime } from '../../../core/utils/dates';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsStore } from '../store/settings.store';

/**
 * Settings > Calendario: connecting the CalDAV calendar Synap reads (specs/calendar-integration
 * "Connecting a calendar from the web app").
 *
 * No credential is ever displayed, not even masked - the API does not return one to display.
 */
@Component({
  selector: 'app-calendar-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, PasswordModule, SkeletonModule, TagModule],
  styles: [`
    .status { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; flex-wrap: wrap; }

    .intro { margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--p-text-muted-color); }

    .since { font-size: 0.8125rem; color: var(--p-text-muted-color); }

    .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.6rem; }

    .field label { font-size: 0.8125rem; color: var(--p-text-muted-color); }

    .buttons { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }

    .error { margin-top: 0.75rem; }
  `],
  template: `
    @if (loading()) {
      <p-skeleton height="2.5rem" />
    } @else {
      <div class="status">
        @if (store.calendarConnected()) {
          <p-tag severity="success" value="Conectado · CalDAV" icon="pi pi-check" />
          @if (store.calendar()?.connection?.connectedAt; as connectedAt) {
            <span class="since">desde el {{ since(connectedAt) }}</span>
          }
        } @else {
          <p-tag severity="secondary" value="Sin conectar" />
        }
      </div>

      @if (store.calendarConnected()) {
        <p class="intro">Synap lee este calendario para preparar tu briefing y responder sobre tu día.</p>
        @if (store.calendar()?.connection?.needsReconnect) {
          <p-message severity="warn" styleClass="w-full" style="margin-bottom: 0.75rem">
            <span>La conexión necesita ser renovada. Vuelve a introducir tus credenciales.</span>
          </p-message>
        }
        <div class="buttons">
          <p-button
            label="Desconectar"
            icon="pi pi-times"
            size="small"
            severity="danger"
            [text]="true"
            [disabled]="store.saving()"
            (onClick)="confirmDisconnect()"
          />
        </div>
      } @else {
        <p class="intro">
          Conecta tu calendario CalDAV y Synap sabrá qué tienes cada día. Solo lo lee: no guarda ningún evento ni los
          indexa, y nunca escribe en él.
        </p>

        <form [formGroup]="form" (ngSubmit)="connectCalDav()">
          <div class="field">
            <label for="caldav-url">Dirección del servidor</label>
            <input
              pInputText
              id="caldav-url"
              formControlName="serverUrl"
              placeholder="https://calendario.ejemplo.com/dav/"
              autocomplete="off"
            />
          </div>
          <div class="field">
            <label for="caldav-user">Usuario</label>
            <input pInputText id="caldav-user" formControlName="username" autocomplete="off" />
          </div>
          <div class="field">
            <label for="caldav-password">Contraseña</label>
            <p-password
              inputId="caldav-password"
              formControlName="password"
              [feedback]="false"
              [toggleMask]="true"
              autocomplete="new-password"
            />
          </div>
          <div class="buttons">
            <p-button
              type="submit"
              label="Conectar"
              icon="pi pi-calendar"
              size="small"
              [disabled]="form.invalid || store.saving()"
            />
          </div>
        </form>
      }

      @if (error(); as message) {
        <p-message severity="error" styleClass="w-full error">
          <span>{{ message }}</span>
        </p-message>
      }
    }
  `,
})
export class CalendarSettingsComponent implements OnInit {
  protected readonly store = inject(SettingsStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notifications = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    serverUrl: ['', [Validators.required]],
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.store.loadCalendar();
    } catch {
      this.error.set('No se pudo consultar el estado de tu calendario.');
    } finally {
      this.loading.set(false);
    }
  }

  protected since(value: string): string {
    return formatDateTime(value);
  }

  protected async connectCalDav(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    const { serverUrl, username, password } = this.form.getRawValue();
    await this.run(async () => {
      await this.store.connectCalDavCalendar(serverUrl.trim(), username.trim(), password);
      // The password never stays in the page longer than the request that used it.
      this.form.reset();
      this.notifications.success('Calendario conectado');
    });
  }

  protected confirmDisconnect(): void {
    this.confirmationService.confirm({
      header: 'Desconectar el calendario',
      message: 'Synap dejará de leer tu calendario y tu briefing ya no incluirá tus eventos. ¿Continuar?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desconectar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => void this.disconnect(),
    });
  }

  private async disconnect(): Promise<void> {
    await this.run(async () => {
      await this.store.disconnectCalendar();
      this.notifications.success('Calendario desconectado');
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo completar la acción.');
    }
  }
}
