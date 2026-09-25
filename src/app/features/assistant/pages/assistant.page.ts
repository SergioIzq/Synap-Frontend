import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, computed, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ChipModule } from 'primeng/chip';
import { NotificationService } from '../../../core/services/notification.service';
import { MarkdownService } from '../../../core/services/markdown.service';
import { AssistantAnswer, SETTINGS_FIXABLE_STATUSES } from '../../../core/models';
import { SettingsStore } from '../../settings/store/settings.store';
import { AssistantStore } from '../store/assistant.store';

@Component({
  selector: 'app-assistant-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputGroupModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    ChipModule,
  ],
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 1.5rem;

      h2 { margin: 0; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; }
    }

    .suggestions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .sources {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.6rem;

      a { text-decoration: none; }
      ::ng-deep .p-chip { cursor: pointer; font-size: 0.8rem; }
    }

    .answer-actions { display: flex; justify-content: flex-end; margin-top: 0.25rem; }

    .chat-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    /* Each exchange: user bubble then Synap bubble */
    .msg-exchange {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      animation: msgIn 0.2s ease-out;
    }

    @keyframes msgIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .msg-user {
      align-self: flex-end;
      max-width: 75%;
      background: var(--synap-bubble-user-bg);
      color: var(--synap-bubble-user-text);
      border-radius: 16px 16px 4px 16px;
      padding: 0.625rem 1rem;
      font-size: 0.925rem;
      line-height: 1.5;
    }

    .msg-synap-wrap {
      align-self: flex-start;
      max-width: 85%;
    }

    .msg-synap-label {
      font-size: 0.675rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--p-primary-color);
      margin: 0 0 0.3rem 0.75rem;
    }

    .msg-synap {
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 16px 16px 16px 4px;
      padding: 0.75rem 1rem;
      font-size: 0.925rem;
      line-height: 1.55;
    }

    /* Typing indicator */
    .typing-dots {
      display: flex;
      gap: 5px;
      align-items: center;
      padding: 0.25rem 0;
    }

    .typing-dots span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--p-text-muted-color);
      animation: dotPulse 1.2s ease-in-out infinite;
    }

    .typing-dots span:nth-child(2) { animation-delay: 0.16s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.32s; }

    @keyframes dotPulse {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40%           { transform: scale(1);   opacity: 1; }
    }

    .grounded-note {
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }

    .input-row {
      display: flex;
      gap: 0.5rem;
    }

    /* Answers that are a problem (no key, invalid key, quota, outage) rather than content */
    .msg-synap.is-problem {
      background: color-mix(in srgb, var(--synap-warn) 8%, var(--p-content-background));
      border-color: color-mix(in srgb, var(--synap-warn) 35%, transparent);
    }

    .problem-body {
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;

      > i { color: var(--synap-warn); margin-top: 0.2rem; }
    }

    .problem-action { margin-top: 0.6rem; }

    .key-warning {
      margin-bottom: 1.5rem;

      .key-warning-body {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        align-items: flex-start;
      }

      strong { display: block; margin-bottom: 0.15rem; }
      p { margin: 0; line-height: 1.5; }
    }
  `],
  template: `
    <div class="page-header">
      <h2>Pregunta a Synap</h2>
      @if (assistantStore.messages().length > 0) {
        <p-button
          label="Nueva conversación"
          icon="pi pi-plus"
          size="small"
          severity="secondary"
          [text]="true"
          [disabled]="isPending()"
          (onClick)="assistantStore.clear()"
        />
      }
    </div>

    @if (needsKey()) {
      <div class="key-warning">
      <p-message severity="warn" styleClass="w-full">
        <div class="key-warning-body">
          <div>
            <strong>Configura tu API key de Groq para usar el asistente</strong>
            <p>
              Cada usuario usa su propia key (Groq tiene un plan gratuito), así el asistente responde con tu cuenta.
              Solo tardas un minuto.
            </p>
          </div>
          <p-button label="Configurar API key" icon="pi pi-key" size="small" routerLink="/app/settings" fragment="ai" />
        </div>
      </p-message>
      </div>
    }

    @if (assistantStore.messages().length === 0 && !needsKey()) {
      <div class="empty-block">
        <i class="pi pi-sparkles"></i>
        <h3>Pregunta sobre lo que has guardado</h3>
        <p>Synap responde a partir de tus propias notas y te dice en cuáles se ha basado.</p>
        <div class="suggestions">
          @for (suggestion of suggestions; track suggestion) {
            <p-button [label]="suggestion" size="small" severity="secondary" [outlined]="true" [rounded]="true" (onClick)="askSuggestion(suggestion)" />
          }
        </div>
      </div>
    }

    <div class="chat-list" #chatList>
      @for (message of assistantStore.messages(); track $index) {
        <div class="msg-exchange">
          <div class="msg-user">{{ message.question }}</div>

          <div class="msg-synap-wrap">
            <p class="msg-synap-label">Synap</p>
            <div class="msg-synap" [class.is-problem]="isProblem(message.answer)">
              @if (message.pending) {
                <div class="typing-dots">
                  <span></span><span></span><span></span>
                </div>
              } @else if (message.answer && isProblem(message.answer)) {
                <div class="problem-body">
                  <i class="pi pi-exclamation-triangle"></i>
                  <div>
                    <div>{{ message.answer.answer }}</div>
                    @if (needsSettingsLink(message.answer)) {
                      <p-button
                        styleClass="problem-action"
                        label="Ir a Configuración"
                        icon="pi pi-cog"
                        size="small"
                        [outlined]="true"
                        routerLink="/app/settings"
                        fragment="ai"
                      />
                    }
                  </div>
                </div>
              } @else if (message.answer) {
                <!-- Markdown rendered via MarkdownService; content is from our own trusted backend -->
                <div class="markdown-body" [innerHTML]="renderMarkdown(message.answer.answer)"></div>
                @if (message.answer.grounded) {
                  @if (message.answer.sources?.length) {
                    <div class="sources">
                      <span class="grounded-note" style="margin: 0">Fuentes:</span>
                      @for (source of message.answer.sources; track source.id) {
                        <a [routerLink]="['/app/notes', source.id]" [attr.aria-label]="'Abrir nota ' + source.title">
                          <p-chip [label]="source.title" icon="pi pi-file" />
                        </a>
                      }
                    </div>
                  } @else {
                    <p class="grounded-note">
                      <i class="pi pi-book"></i>
                      Basado en {{ message.answer.sourceNoteIds.length }} de tus notas.
                    </p>
                  }
                }
                <div class="answer-actions">
                  <p-button
                    icon="pi pi-copy"
                    size="small"
                    severity="secondary"
                    [text]="true"
                    [rounded]="true"
                    ariaLabel="Copiar respuesta"
                    (onClick)="copyAnswer(message.answer.answer)"
                  />
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>

    <div class="input-row">
      <p-inputgroup style="flex: 1">
        <input
          #questionInput
          pInputText
          [formControl]="questionControl"
          [placeholder]="needsKey() ? 'Configura tu API key para preguntar' : 'Haz una pregunta…'"
          autocomplete="off"
          (keyup.enter)="submit()"
        />
        <p-button
          icon="pi pi-send"
          label="Preguntar"
          [disabled]="!questionControl.value?.trim() || needsKey() || !settingsStore.loaded()"
          [loading]="isPending()"
          (onClick)="submit()"
        />
      </p-inputgroup>
    </div>
  `,
})
export class AssistantPage implements OnInit {
  protected readonly assistantStore = inject(AssistantStore);
  protected readonly settingsStore = inject(SettingsStore);
  private readonly markdownService = inject(MarkdownService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);

  protected readonly suggestions = [
    '¿Cómo resolví el último error que anoté?',
    '¿Qué enlaces guardé sobre Angular?',
    'Resume mis notas de esta semana',
  ];

  protected readonly isPending = computed(() => !!this.assistantStore.messages().at(-1)?.pending);

  @ViewChild('chatList') private chatList?: ElementRef<HTMLElement>;

  protected readonly questionControl = this.formBuilder.nonNullable.control('');

  /** Only once settings are actually loaded - never flash the warning for a user who has a key. */
  protected readonly needsKey = computed(() => this.settingsStore.loaded() && !this.settingsStore.hasGroqKey());

  constructor() {
    // specs/ai-assistant "Warning shown on entering the assistant": input disabled without a key.
    effect(() => {
      if (this.needsKey()) {
        this.questionControl.disable({ emitEvent: false });
      } else {
        this.questionControl.enable({ emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    // Always reload: a cached value may belong to a previous session on this device.
    void this.settingsStore.load();
  }

  protected isProblem(answer: AssistantAnswer | null): boolean {
    return !!answer && answer.status !== 'ok' && answer.status !== 'noRelevantNotes';
  }

  protected needsSettingsLink(answer: AssistantAnswer): boolean {
    return SETTINGS_FIXABLE_STATUSES.includes(answer.status);
  }

  // toSafeHtml already calls bypassSecurityTrustHtml; content is from our own trusted backend
  protected renderMarkdown(text: string) {
    return this.markdownService.toSafeHtml(text);
  }

  protected askSuggestion(suggestion: string): void {
    this.questionControl.setValue(suggestion);
    void this.submit();
  }

  async copyAnswer(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notifications.success('Copiado');
    } catch {
      this.notifications.warn('No se pudo copiar', 'Selecciona el texto y cópialo manualmente.');
    }
  }

  async submit(): Promise<void> {
    const question = this.questionControl.value.trim();
    if (!question || this.needsKey()) return;

    this.questionControl.reset('');
    await this.assistantStore.ask(question);

    // Scroll to latest answer after render
    setTimeout(() => {
      this.chatList?.nativeElement.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }
}
