import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
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
    CardModule,
    InputGroupModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
  ],
  styles: [`
    h2 { margin: 0 0 1.5rem; font-size: 1.2rem; }

    .empty-hint {
      color: var(--p-text-muted-color);
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
    }

    .chat-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .question-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--p-text-muted-color);
      margin: 0 0 0.4rem;
    }

    .question-text {
      margin: 0;
      font-weight: 500;
    }

    .answer-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--p-primary-color);
      margin: 0.75rem 0 0.4rem;
    }

    .answer-pending {
      color: var(--p-text-muted-color);
      font-style: italic;
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
    <h2>Ask Synap</h2>

    @if (assistantStore.messages().length === 0) {
      <p class="empty-hint">Ask about anything you've captured — "I hit this error before, what did I do?"</p>
    }

    <div class="chat-list" #chatList>
      @for (message of assistantStore.messages(); track $index) {
        <p-card>
          <p class="question-label">You</p>
          <p class="question-text">{{ message.question }}</p>

          <p class="answer-label">Synap</p>
          @if (message.pending) {
            <p class="answer-pending">Thinking…</p>
          } @else if (message.answer) {
            <!-- Markdown rendered via MarkdownService; content is from our own trusted backend -->
            <div class="markdown-body" [innerHTML]="renderMarkdown(message.answer.answer)"></div>
            @if (message.answer.grounded) {
              <p class="grounded-note">
                <i class="pi pi-book"></i>
                Grounded in {{ message.answer.sourceNoteIds.length }} of your notes.
              </p>
            }
          }
        </p-card>
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
          placeholder="Ask a question…"
          autocomplete="off"
          (keyup.enter)="submit()"
        />
        <p-button
          icon="pi pi-send"
          label="Ask"
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
