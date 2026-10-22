import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
 * Settings > Calendario: connecting the calendar Synap reads (specs/calendar-integration
 * "Connecting a calendar from the web app"). Two ways in, one state out: once connected, nothing
 * here or anywhere else cares which of the two it is beyond saying so.
 *
 * No credential is ever displayed, not even masked - the API does not return one to display.
 *
 * The Google way leaves the app and comes back to this same page with a code in the query string,
 * which is why this component also finishes that flow on init.
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

    .ways { display: grid; gap: 1.1rem; margin-top: 0.9rem; }

    .way h4 { margin: 0 0 0.4rem; font-size: 0.875rem; font-weight: 600; }

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
          <p-tag severity="success" [value]="'Conectado · ' + kindLabel()" icon="pi pi-check" />
          @if (store.calendar()?.connectedAt; as connectedAt) {
            <span class="since">desde el {{ since(connectedAt) }}</span>
          }
        } @else {
          <p-tag severity="secondary" value="Sin conectar" />
        }
      </div>

      @if (store.calendarConnected()) {
        <p class="intro">Synap lee este calendario para preparar tu briefing y responder sobre tu día.</p>
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
          Conecta tu calendario y Synap sabrá qué tienes cada día. Solo lo lee: no guarda ningún evento ni los
          indexa, y nunca escribe en él.
        </p>

        <div class="ways">
          <div class="way">
            <h4>Google Calendar</h4>
            @if (store.calendar()?.googleAvailable) {
              <div class="buttons">
                <p-button
                  label="Conectar con Google"
                  icon="pi pi-google"
                  size="small"
                  [disabled]="store.saving()"
                  (onClick)="connectGoogle()"
                />
              </div>
            } @else {
              <p-message severity="secondary" styleClass="w-full">
                <span>La conexión con Google Calendar no está disponible en este despliegue.</span>
              </p-message>
            }
          </div>

          <div class="way">
            <h4>Calendario CalDAV</h4>
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
          </div>
        </div>
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
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
    }

    await this.finishGoogleIfComingBack();
    this.loading.set(false);
  }

  protected kindLabel(): string {
    return this.store.calendar()?.kind === 'Google' ? 'Google Calendar' : 'CalDAV';
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

  /** Leaves for Google; the user comes back to this page with a code in the query string. */
  protected async connectGoogle(): Promise<void> {
    await this.run(async () => {
      const authorization = await this.store.beginGoogleCalendarAuthorization();
      sessionStorage.setItem(GOOGLE_STATE_KEY, authorization.state);
      window.location.href = authorization.authorizationUrl;
    });
  }

  /**
   * specs/calendar-integration "Authorization refused" and "Google calendar connected": whichever
   * way it went, the query string is cleaned afterwards so a reload does not replay it.
   */
  private async finishGoogleIfComingBack(): Promise<void> {
    const parameters = this.route.snapshot.queryParamMap;
    const code = parameters.get('code');
    const state = parameters.get('state') ?? sessionStorage.getItem(GOOGLE_STATE_KEY);
    const refused = parameters.get('error');

    if (!code && !refused) {
      return;
    }

    sessionStorage.removeItem(GOOGLE_STATE_KEY);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { code: null, state: null, error: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    if (refused || !code || !state) {
      this.error.set('No se ha completado la autorización con Google. No se ha conectado ningún calendario.');
      return;
    }

    await this.run(async () => {
      await this.store.connectGoogleCalendar(code, state);
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

  /** The server's own Spanish message is what the user reads: it says which of the two went wrong. */
  private async run(action: () => Promise<void>): Promise<void> {
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo completar la acción.');
    }
  }
}

/** Survives the round trip to Google, for the case where it does not hand the state back. */
const GOOGLE_STATE_KEY = 'synap.calendar.google.state';
