import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MarkdownService } from '../../../core/services/markdown.service';
import { AssistantStore } from '../store/assistant.store';

@Component({
  selector: 'app-assistant-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    ReactiveFormsModule,
    InputGroupModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
  ],
  styles: [`
    h2 { margin: 0 0 1.5rem; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; }

    .empty-hint {
      color: var(--p-text-muted-color);
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
    }

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
      background: #6366f1;
      color: white;
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
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
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
  `],
  template: `
    <h2>Pregunta a Synap</h2>

    @if (assistantStore.messages().length === 0) {
      <p class="empty-hint">Pregunta sobre cualquier cosa que hayas guardado — "¿Cómo resolví ese error la última vez?"</p>
    }

    <div class="chat-list" #chatList>
      @for (message of assistantStore.messages(); track $index) {
        <div class="msg-exchange">
          <div class="msg-user">{{ message.question }}</div>

          <div class="msg-synap-wrap">
            <p class="msg-synap-label">Synap</p>
            <div class="msg-synap">
              @if (message.pending) {
                <div class="typing-dots">
                  <span></span><span></span><span></span>
                </div>
              } @else if (message.answer) {
                <!-- Markdown rendered via MarkdownService; content is from our own trusted backend -->
                <div class="markdown-body" [innerHTML]="renderMarkdown(message.answer.answer)"></div>
                @if (message.answer.grounded) {
                  <p class="grounded-note">
                    <i class="pi pi-book"></i>
                    Basado en {{ message.answer.sourceNoteIds.length }} de tus notas.
                  </p>
                }
              }
            </div>
          </div>
        </div>
      }
    </div>

    @if (assistantStore.error()) {
      <p-message severity="error" styleClass="w-full" style="margin-bottom: 1rem">
        {{ assistantStore.error() }}
      </p-message>
    }

    <div class="input-row">
      <p-inputgroup style="flex: 1">
        <input
          #questionInput
          pInputText
          [formControl]="questionControl"
          placeholder="Haz una pregunta…"
          autocomplete="off"
          (keyup.enter)="submit()"
        />
        <p-button
          icon="pi pi-send"
          label="Preguntar"
          [disabled]="!questionControl.value?.trim()"
          [loading]="!!assistantStore.messages()[assistantStore.messages().length - 1]?.pending"
          (onClick)="submit()"
        />
      </p-inputgroup>
    </div>
  `,
})
export class AssistantPage {
  protected readonly assistantStore = inject(AssistantStore);
  private readonly markdownService = inject(MarkdownService);
  private readonly formBuilder = inject(FormBuilder);

  @ViewChild('chatList') private chatList?: ElementRef<HTMLElement>;

  protected readonly questionControl = this.formBuilder.nonNullable.control('');

  // toSafeHtml already calls bypassSecurityTrustHtml; content is from our own trusted backend
  protected renderMarkdown(text: string) {
    return this.markdownService.toSafeHtml(text);
  }

  async submit(): Promise<void> {
    const question = this.questionControl.value.trim();
    if (!question) return;

    this.questionControl.reset('');
    await this.assistantStore.ask(question);

    // Scroll to latest answer after render
    setTimeout(() => {
      this.chatList?.nativeElement.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }
}
