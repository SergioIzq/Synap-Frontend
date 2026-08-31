import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AssistantService } from '../../../core/services/api/assistant.service';
import { ApiResult, ChatMessage } from '../../../core/models';

/** Plain signals, not @ngrx/signals - see design.md Decision 10. */
@Injectable({ providedIn: 'root' })
export class AssistantStore {
  private readonly assistantService = inject(AssistantService);

  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly error = this._error.asReadonly();

  async ask(question: string): Promise<void> {
    this._error.set(null);
    this._messages.update((messages) => [...messages, { question, answer: null, pending: true }]);

    try {
      const answer = await firstValueFrom(this.assistantService.ask(question));
      this.updateLastMessage({ question, answer, pending: false });
    } catch (err) {
      this._error.set(this.extractErrorMessage(err));
      this.updateLastMessage({
        question,
        answer: { answer: 'Something went wrong asking the assistant.', sourceNoteIds: [], grounded: false },
        pending: false,
      });
    }
  }

  private updateLastMessage(message: ChatMessage): void {
    this._messages.update((messages) => [...messages.slice(0, -1), message]);
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const apiResult = err.error as ApiResult | undefined;
      return apiResult?.error?.message ?? 'Could not reach the assistant.';
    }
    return 'Could not reach the assistant.';
  }
}
