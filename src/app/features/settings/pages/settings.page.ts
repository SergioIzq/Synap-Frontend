import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/api/auth.service';
import { ApiTokenStatus } from '../../../core/models';
import { SettingsStore } from '../store/settings.store';

const GROQ_KEYS_URL = 'https://console.groq.com/keys';
const IOS_SHORTCUT_DOCS_URL = 'https://github.com/SergioIzq/Synap-Workspace/blob/main/docs/ios-shortcut-setup.md';

interface ModelOption {
  label: string;
  value: string | null;
}

@Component({
  selector: 'app-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    CardModule,
    MessageModule,
    PasswordModule,
    SelectModule,
    SkeletonModule,
    TagModule,
    InputTextModule,
  ],
  styles: [`
    :host { display: block; max-width: 760px; }

    h2 { margin: 0 0 0.35rem; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; }

    .page-subtitle {
      margin: 0 0 1.5rem;
      color: var(--p-text-muted-color);
      font-size: 0.925rem;
    }

    .sections {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.25rem;

      h3 { margin: 0; font-size: 1rem; font-weight: 650; flex: 1; }
      i { color: var(--p-primary-color); font-size: 1.1rem; }
    }

    .section-description {
      margin: 0 0 1.25rem;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
      line-height: 1.55;

      a { color: var(--p-primary-color); }
    }

    .field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }

    .field-label { font-size: 0.8rem; font-weight: 600; color: var(--p-text-muted-color); }

    .key-status {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border: 1px solid var(--p-content-border-color, var(--p-surface-200));
      border-radius: var(--p-border-radius, 6px);
      background: var(--p-surface-50);

      code { font-size: 0.9rem; }
      .muted { color: var(--p-text-muted-color); font-size: 0.8rem; }
      .spacer { flex: 1; }
    }

    .key-form {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
      flex-wrap: wrap;

      .key-input { flex: 1; min-width: 220px; }
    }

    .privacy-note {
      display: flex;
      gap: 0.5rem;
      margin: 0.75rem 0 0;
      font-size: 0.8rem;
      color: var(--p-text-muted-color);

      i { margin-top: 0.1rem; }
    }

    .token-reveal {
      display: flex;
      gap: 0.5rem;
      margin: 1rem 0 0.5rem;

      input { flex: 1; font-family: var(--p-font-family-mono, monospace); font-size: 0.85rem; }
    }

    .account-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.925rem;

      .muted { color: var(--p-text-muted-color); }
    }

    .inline-error { margin-top: 0.5rem; }
  `],
  template: `
    <h2>Configuración</h2>
    <p class="page-subtitle">Tu asistente, tus accesos y tu cuenta.</p>

    @if (settingsStore.error()) {
      <p-message severity="error" styleClass="w-full" style="margin-bottom: 1rem">{{ settingsStore.error() }}</p-message>
    }

    @if (!settingsStore.loaded() && settingsStore.loading()) {
      <p-skeleton height="220px" borderRadius="12px" styleClass="mb-3" />
      <p-skeleton height="160px" borderRadius="12px" styleClass="mb-3" />
    } @else if (settingsStore.settings(); as settings) {
      <div class="sections">
        <!-- ─── Asistente IA ─────────────────────────────────────────── -->
        <p-card id="ai">
          <div class="section-header">
            <i class="pi pi-sparkles"></i>
            <h3>Asistente IA</h3>
            @if (settings.ai.hasGroqKey) {
              <p-tag severity="success" value="Configurado" icon="pi pi-check" />
            } @else {
              <p-tag severity="warn" value="Sin configurar" icon="pi pi-exclamation-triangle" />
            }
          </div>
          <p class="section-description">
            El asistente usa <strong>tu propia API key de Groq</strong>, así que su uso corre por tu cuenta (Groq ofrece un
            plan gratuito). Consíguela en
            <a [href]="groqKeysUrl" target="_blank" rel="noopener">console.groq.com/keys</a> y pégala aquí.
          </p>

          @if (settings.ai.hasGroqKey && !editingKey()) {
            <div class="key-status">
              <i class="pi pi-key"></i>
              <code>{{ settings.ai.groqKeyMasked }}</code>
              @if (settings.ai.groqKeyUpdatedAt) {
                <span class="muted">Actualizada el {{ formatDate(settings.ai.groqKeyUpdatedAt) }}</span>
              }
              <span class="spacer"></span>
              <p-button label="Cambiar" icon="pi pi-pencil" size="small" severity="secondary" [outlined]="true" (onClick)="startEditingKey()" />
              <p-button
                label="Eliminar"
                icon="pi pi-trash"
                size="small"
                severity="danger"
                [text]="true"
                [loading]="settingsStore.saving() && pendingAction() === 'delete'"
                (onClick)="confirmDeleteKey()"
              />
            </div>
          } @else {
            <form class="key-form" [formGroup]="keyForm" (ngSubmit)="saveKey()">
              <div class="key-input">
                <p-password
                  formControlName="apiKey"
                  [feedback]="false"
                  [toggleMask]="true"
                  placeholder="gsk_…"
                  autocomplete="off"
                  inputStyleClass="w-full"
                  styleClass="w-full"
                  [fluid]="true"
                />
              </div>
              <p-button
                type="submit"
                label="Guardar"
                icon="pi pi-check"
                [disabled]="keyForm.invalid"
                [loading]="settingsStore.saving() && pendingAction() === 'save'"
              />
              @if (settings.ai.hasGroqKey) {
                <p-button type="button" label="Cancelar" severity="secondary" [text]="true" (onClick)="cancelEditingKey()" />
              }
            </form>
            @if (keyError()) {
              <p-message severity="error" size="small" styleClass="inline-error">{{ keyError() }}</p-message>
            }
          }

          <p class="privacy-note">
            <i class="pi pi-lock"></i>
            <span>Se valida con Groq antes de guardarse, se almacena cifrada y nunca se vuelve a mostrar completa.</span>
          </p>

          @if (settings.ai.hasGroqKey) {
            <div class="field" style="margin: 1.25rem 0 0">
              <label class="field-label" for="model-select">Modelo</label>
              <p-select
                inputId="model-select"
                [options]="modelOptions()"
                [ngModel]="settings.ai.groqModel"
                (ngModelChange)="changeModel($event)"
                optionLabel="label"
                optionValue="value"
                [loading]="settingsStore.modelsLoading()"
                [disabled]="settingsStore.saving()"
                [filter]="modelOptions().length > 8"
                filterBy="label"
                placeholder="Selecciona un modelo"
                styleClass="w-full"
              />
              @if (settingsStore.modelsError()) {
                <p-message severity="warn" size="small">{{ settingsStore.modelsError() }}</p-message>
              } @else if (selectedModelUnavailable()) {
                <p-message severity="warn" size="small">
                  El modelo guardado ya no está disponible para tu key. Elige otro o vuelve al modelo por defecto.
                </p-message>
              }
            </div>
          }
        </p-card>

        <!-- ─── Atajo de iOS ─────────────────────────────────────────── -->
        <p-card id="ios">
          <div class="section-header">
            <i class="pi pi-mobile"></i>
            <h3>Atajo de iOS</h3>
            @if (tokenStatus()?.hasToken) {
              <p-tag severity="success" value="Token activo" />
            } @else if (tokenStatus()) {
              <p-tag severity="secondary" value="Sin token" />
            }
          </div>
          <p class="section-description">
            Un token personal permite capturar notas desde el menú Compartir del iPhone sin iniciar sesión.
            <a [href]="iosDocsUrl" target="_blank" rel="noopener">Cómo configurar el atajo</a>.
          </p>

          @if (tokenStatus()?.hasToken && tokenStatus()?.createdAt) {
            <p class="section-description" style="margin-bottom: 1rem">
              Generado el {{ formatDate(tokenStatus()!.createdAt!) }}. Por seguridad no se puede volver a mostrar.
            </p>
          }

          <p-button
            [label]="tokenStatus()?.hasToken ? 'Regenerar token' : 'Generar token'"
            icon="pi pi-refresh"
            [severity]="tokenStatus()?.hasToken ? 'secondary' : 'primary'"
            [outlined]="!!tokenStatus()?.hasToken"
            [loading]="generatingToken()"
            (onClick)="requestToken()"
          />

          @if (revealedToken()) {
            <div class="token-reveal">
              <input pInputText [value]="revealedToken()" readonly aria-label="Token personal" (focus)="$any($event.target).select()" />
              <p-button icon="pi pi-copy" label="Copiar" (onClick)="copyToken()" />
            </div>
            <p-message severity="warn" size="small">Cópialo ahora: es la única vez que se muestra.</p-message>
          }
        </p-card>

        <!-- ─── Cuenta ──────────────────────────────────────────────── -->
        <p-card id="account">
          <div class="section-header">
            <i class="pi pi-user"></i>
            <h3>Cuenta</h3>
          </div>
          <div class="account-row">
            <span class="muted">Correo electrónico</span>
            <span>{{ settings.email }}</span>
          </div>
        </p-card>
      </div>
    }
  `,
})
export class SettingsPage implements OnInit {
  protected readonly settingsStore = inject(SettingsStore);
  private readonly authService = inject(AuthService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly groqKeysUrl = GROQ_KEYS_URL;
  protected readonly iosDocsUrl = IOS_SHORTCUT_DOCS_URL;

  protected readonly keyForm = this.formBuilder.nonNullable.group({
    apiKey: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly editingKey = signal(false);
  protected readonly keyError = signal<string | null>(null);
  protected readonly pendingAction = signal<'save' | 'delete' | null>(null);

  protected readonly tokenStatus = signal<ApiTokenStatus | null>(null);
  protected readonly revealedToken = signal<string | null>(null);
  protected readonly generatingToken = signal(false);

  protected readonly modelOptions = computed<ModelOption[]>(() => {
    const ai = this.settingsStore.settings()?.ai;
    if (!ai) return [];

    const options: ModelOption[] = [
      { label: `Por defecto (${ai.defaultGroqModel})`, value: null },
      ...this.settingsStore.models().map((model) => ({ label: model, value: model })),
    ];

    // Keep the saved model selectable/visible even if Groq stopped listing it.
    if (ai.groqModel && !this.settingsStore.models().includes(ai.groqModel)) {
      options.push({ label: `${ai.groqModel} (no disponible)`, value: ai.groqModel });
    }
    return options;
  });

  protected readonly selectedModelUnavailable = computed(() => {
    const model = this.settingsStore.settings()?.ai.groqModel;
    return (
      !!model &&
      !this.settingsStore.modelsLoading() &&
      this.settingsStore.models().length > 0 &&
      !this.settingsStore.models().includes(model)
    );
  });

  async ngOnInit(): Promise<void> {
    void this.loadTokenStatus();
    await this.settingsStore.load();
    void this.settingsStore.loadModels();
    this.scrollToFragment();
  }

  protected startEditingKey(): void {
    this.keyForm.reset();
    this.keyError.set(null);
    this.editingKey.set(true);
  }

  protected cancelEditingKey(): void {
    this.keyForm.reset();
    this.keyError.set(null);
    this.editingKey.set(false);
  }

  async saveKey(): Promise<void> {
    if (this.keyForm.invalid) return;

    this.keyError.set(null);
    this.pendingAction.set('save');
    try {
      await this.settingsStore.saveGroqKey(this.keyForm.getRawValue().apiKey.trim());
      this.keyForm.reset();
      this.editingKey.set(false);
      this.messageService.add({ severity: 'success', summary: 'API key guardada', detail: 'Ya puedes usar el asistente.' });
    } catch (err) {
      this.keyError.set((err as Error).message);
    } finally {
      this.pendingAction.set(null);
    }
  }

  protected confirmDeleteKey(): void {
    this.confirmationService.confirm({
      header: 'Eliminar API key',
      message: 'El asistente dejará de funcionar hasta que guardes una nueva key. ¿Continuar?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => void this.deleteKey(),
    });
  }

  private async deleteKey(): Promise<void> {
    this.pendingAction.set('delete');
    try {
      await this.settingsStore.deleteGroqKey();
      this.messageService.add({ severity: 'success', summary: 'API key eliminada' });
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: (err as Error).message });
    } finally {
      this.pendingAction.set(null);
    }
  }

  async changeModel(model: string | null): Promise<void> {
    if (model === (this.settingsStore.settings()?.ai.groqModel ?? null)) return;

    try {
      await this.settingsStore.setModel(model);
      this.messageService.add({ severity: 'success', summary: 'Modelo actualizado', detail: model ?? 'Modelo por defecto' });
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: (err as Error).message });
    }
  }

  protected requestToken(): void {
    if (!this.tokenStatus()?.hasToken) {
      void this.generateToken();
      return;
    }

    this.confirmationService.confirm({
      header: 'Regenerar token',
      message: 'El token actual dejará de funcionar y tendrás que actualizar el Atajo de iOS. ¿Continuar?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Regenerar',
      rejectLabel: 'Cancelar',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => void this.generateToken(),
    });
  }

  private async generateToken(): Promise<void> {
    this.generatingToken.set(true);
    try {
      this.revealedToken.set(await firstValueFrom(this.authService.generateApiToken()));
      await this.loadTokenStatus();
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el token.' });
    } finally {
      this.generatingToken.set(false);
    }
  }

  async copyToken(): Promise<void> {
    const token = this.revealedToken();
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      this.messageService.add({ severity: 'success', summary: 'Token copiado' });
    } catch {
      this.messageService.add({ severity: 'warn', summary: 'No se pudo copiar', detail: 'Selecciónalo y cópialo manualmente.' });
    }
  }

  /**
   * Both dates shown here are stored with DateTime.UtcNow, but come back from a
   * "timestamp without time zone" column with no offset - which the browser would otherwise
   * read as local time (hours off). Timestamps without an explicit offset are treated as UTC.
   */
  protected formatDate(value: string): string {
    const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
    return new Date(hasOffset ? value : `${value}Z`).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  }

  private async loadTokenStatus(): Promise<void> {
    try {
      this.tokenStatus.set(await firstValueFrom(this.authService.getApiTokenStatus()));
    } catch {
      this.tokenStatus.set(null);
    }
  }

  /** The content area scrolls, not the window, so router anchor scrolling can't do this. */
  private scrollToFragment(): void {
    const fragment = this.route.snapshot.fragment;
    if (!fragment) return;

    setTimeout(() => {
      this.host.nativeElement.querySelector(`#${CSS.escape(fragment)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}
