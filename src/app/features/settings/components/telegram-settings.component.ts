import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { NotificationService } from '../../../core/services/notification.service';
import { TelegramLinkInstructions } from '../../../core/models';
import { isHandledGlobally } from '../../../core/utils/http-errors';
import { RemindersStore } from '../../reminders/store/reminders.store';

/**
 * Settings > Telegram: connecting the chat reminders are delivered to (specs/reminders
 * "Connecting a Telegram account"). The code is single use and lives 15 minutes; it is shown here
 * because it only ever links a chat, it never signs anyone into Synap.
 */
@Component({
  selector: 'app-telegram-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ButtonModule, MessageModule, SkeletonModule, TagModule],
  styles: [`
    .status { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }

    .intro { margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--p-text-muted-color); }

    .steps { margin: 0.75rem 0 0; padding-left: 1.1rem; font-size: 0.875rem; line-height: 1.7; }

    code {
      display: inline-block;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      background: var(--synap-page-bg);
      border: 1px solid var(--p-content-border-color);
      font-size: 0.8rem;
      overflow-wrap: anywhere;
    }

    .code-row { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.3rem; }

    .expiry { display: block; margin-top: 0.5rem; font-size: 0.75rem; color: var(--p-text-muted-color); }

    .buttons { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
  `],
  template: `
    @if (loading()) {
      <p-skeleton height="2.5rem" />
    } @else {
      <div class="status">
        @if (store.telegramConnected()) {
          <p-tag severity="success" value="Conectado" icon="pi pi-check" />
        } @else {
          <p-tag severity="secondary" value="Sin conectar" />
        }
      </div>

      @if (store.telegramConnected()) {
        <p class="intro">Tus recordatorios llegan a este chat de Telegram.</p>
        <div class="buttons">
          <p-button
            label="Desconectar"
            icon="pi pi-times"
            size="small"
            severity="danger"
            [text]="true"
            [disabled]="busy()"
            (onClick)="confirmDisconnect()"
          />
        </div>
      } @else {
        <p class="intro">Conecta Telegram para recibir ahí tus recordatorios.</p>

        @if (instructions(); as link) {
          <ol class="steps">
            <li>Abre Telegram y busca <code>&#64;{{ link.botUsername }}</code>.</li>
            <li>
              Envíale este mensaje:
              <div class="code-row">
                <code>/start {{ link.code }}</code>
                <p-button
                  icon="pi pi-copy"
                  size="small"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  ariaLabel="Copiar el código"
                  (onClick)="copy(link)"
                />
              </div>
            </li>
            <li>El bot te confirmará que está listo.</li>
          </ol>
          <small class="expiry">El código caduca en 15 minutos y solo sirve una vez.</small>
          <div class="buttons">
            <p-button label="Ya lo he enviado" icon="pi pi-refresh" size="small" [disabled]="busy()" (onClick)="check()" />
            <p-button label="Generar otro código" size="small" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="startLink()" />
          </div>
        } @else {
          <div class="buttons">
            <p-button label="Conectar Telegram" icon="pi pi-send" size="small" [disabled]="busy()" (onClick)="startLink()" />
          </div>
        }
      }

      @if (notLinkedYet()) {
        <p-message severity="warn" styleClass="w-full">
          <span>Todavía no me ha llegado tu mensaje. Envíaselo al bot y vuelve a comprobarlo.</span>
        </p-message>
      }
    }
  `,
})
export class TelegramSettingsComponent implements OnInit {
  protected readonly store = inject(RemindersStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notifications = inject(NotificationService);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly instructions = signal<TelegramLinkInstructions | null>(null);
  protected readonly notLinkedYet = signal(false);

  async ngOnInit(): Promise<void> {
    await this.run(() => this.store.refreshTelegram());
    this.loading.set(false);
  }

  protected async startLink(): Promise<void> {
    this.notLinkedYet.set(false);
    await this.run(async () => {
      this.instructions.set(await this.store.startTelegramLink());
    });
  }

  /** The user says they have sent the code; the status is the only way to know it worked. */
  protected async check(): Promise<void> {
    await this.run(async () => {
      await this.store.refreshTelegram();
      if (this.store.telegramConnected()) {
        this.instructions.set(null);
        this.notLinkedYet.set(false);
        this.notifications.success('Telegram conectado');
      } else {
        this.notLinkedYet.set(true);
      }
    });
  }

  protected confirmDisconnect(): void {
    this.confirmationService.confirm({
      header: 'Desconectar Telegram',
      message: 'Dejarás de recibir recordatorios, pero no se borrará ninguno. ¿Continuar?',
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
      await this.store.disconnectTelegram();
      this.instructions.set(null);
      this.notifications.success('Telegram desconectado');
    });
  }

  protected async copy(link: TelegramLinkInstructions): Promise<void> {
    try {
      await navigator.clipboard.writeText(`/start ${link.code}`);
      this.notifications.success('Código copiado');
    } catch {
      // Clipboard blocked (insecure context, denied permission): the code is on screen anyway.
    }
  }

  /** Network and 5xx failures are already announced by errorInterceptor. */
  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (err) {
      if (!isHandledGlobally(err)) {
        this.notifications.error('Error', err instanceof Error ? err.message : 'No se pudo completar la acción.');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
