import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssistantStore } from '../store/assistant.store';

@Component({
  selector: 'app-assistant-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="assistant-page">
      <a routerLink="/notes">&larr; Back to notes</a>
      <h1>Ask Synap</h1>

      @if (assistantStore.messages().length === 0) {
        <p>Ask about anything you've captured - "I hit this error before, what did I do?"</p>
      }

      @for (message of assistantStore.messages(); track $index) {
        <div class="chat-turn">
          <p class="question"><strong>You:</strong> {{ message.question }}</p>
          @if (message.pending) {
            <p class="answer pending">Thinking...</p>
          } @else if (message.answer) {
            <p class="answer">{{ message.answer.answer }}</p>
            @if (message.answer.grounded) {
              <p class="grounded-note">Grounded in {{ message.answer.sourceNoteIds.length }} of your notes.</p>
            }
          }
        </div>
      }

      @if (assistantStore.error()) {
        <p class="error" role="alert">{{ assistantStore.error() }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()">
        <input type="text" formControlName="question" placeholder="Ask a question..." autocomplete="off" />
        <button type="submit" [disabled]="form.invalid">Ask</button>
      </form>
    </main>
  `,
})
export class AssistantPage {
  protected readonly assistantStore = inject(AssistantStore);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({ question: [''] });

  async submit(): Promise<void> {
    const question = this.form.getRawValue().question.trim();
    if (!question) {
      return;
    }

    this.form.reset({ question: '' });
    await this.assistantStore.ask(question);
  }
}
